// API Route: Search DOJ Epstein files
import { NextRequest, NextResponse } from "next/server";
import { getCacheKey, deduplicateDocuments } from "@/lib/doj-api";
import { getCachedSearch, setCachedSearch, trackCacheEvent } from "@/lib/cache";
import { searchSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, searchRatelimit } from "@/lib/ratelimit";
import {
  enforceHttps,
  generateWorkerSignature,
  getWorkerSecret,
  sanitizeError,
} from "@/lib/security";

type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

const normalizeLocale = (locale?: string): SupportedLocale => {
  if (!locale) return "en";
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("nl")) return "nl";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("pt")) return "pt";
  return "en";
};

const ERROR_MESSAGES: Record<
  SupportedLocale,
  { rateLimit: string; invalidInput: string }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
  },
};

export const runtime = "nodejs"; // Use Node.js runtime for Upstash Redis compatibility

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParam = searchParams.get("q");
    const fromParam = searchParams.get("from");
    const sizeParam = searchParams.get("size");
    const localeParam = searchParams.get("locale");
    const selectedLocale = normalizeLocale(localeParam ?? undefined);
    const messages = ERROR_MESSAGES[selectedLocale];

    // Rate limiting check
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, searchRatelimit);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: messages.rateLimit },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    // Validate and sanitize input
    const validation = searchSchema.safeParse({
      query: queryParam,
      from: fromParam ? parseInt(fromParam, 10) : 0,
      size: sizeParam ? parseInt(sizeParam, 10) : 100,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: messages.invalidInput, details: validation.error.issues },
        { status: 400 },
      );
    }

    const { query, from, size } = validation.data;

    // Check cache first
    const cacheKey = getCacheKey(query, from);
    const cached = await getCachedSearch(cacheKey);

    if (cached) {
      await trackCacheEvent("hit");
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Cache miss - fetch from DOJ API via Worker (bypasses Akamai blocking)
    await trackCacheEvent("miss");

    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:10000";

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production") {
      enforceHttps(workerUrl);
    }

    // Generate authentication signature
    const workerSecret = getWorkerSecret();
    const payload = JSON.stringify({ query, from, size });
    const signature = generateWorkerSignature(payload, workerSecret);

    const workerResponse = await fetch(`${workerUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Signature": signature,
        Authorization: `Bearer ${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!workerResponse.ok) {
      throw new Error(
        `Worker returned ${workerResponse.status}: ${workerResponse.statusText}`,
      );
    }

    const apiData = await workerResponse.json();

    // Transform worker response to our format
    const documents = apiData.hits.hits.map(
      (hit: {
        _source: Record<string, unknown>;
        highlight?: { content?: string[] };
        _source_content?: string;
      }) => {
        const source = hit._source;
        const highlights = hit.highlight?.content || [];
        const content =
          highlights.length > 0
            ? highlights.join(" ... ")
            : hit._source_content || "";

        return {
          documentId: source.documentId,
          chunkIndex: source.chunkIndex,
          totalChunks: source.totalChunks,
          startPage: source.startPage,
          endPage: source.endPage,
          fileName: source.ORIGIN_FILE_NAME,
          fileUri: source.ORIGIN_FILE_URI,
          fileSize: source.fileSize,
          totalWords: source.totalWords,
          totalCharacters: source.totalCharacters,
          processedAt: source.processedAt,
          content: content,
          highlights: highlights,
          bucket: source.bucket,
          key: source.key,
        };
      },
    );

    const results = {
      total: apiData.hits.total.value,
      documents,
      searchTerm: query,
      from,
      size,
    };

    // Deduplicate documents by documentId
    const uniqueDocuments = deduplicateDocuments(results.documents);
    const deduplicatedResults = {
      ...results,
      documents: uniqueDocuments,
      uniqueCount: uniqueDocuments.length,
    };

    // Cache the results
    await setCachedSearch(cacheKey, deduplicatedResults);

    return NextResponse.json({
      ...deduplicatedResults,
      cached: false,
    });
  } catch (error) {
    console.error("Search API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error.statusCode as number)
        : 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: statusCode },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, searchRatelimit);

    let selectedLocale: SupportedLocale = "en";
    let messages = ERROR_MESSAGES[selectedLocale];

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: messages.rateLimit },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    const body = await request.json();
    selectedLocale = normalizeLocale(body?.locale);
    messages = ERROR_MESSAGES[selectedLocale];

    // Validate and sanitize input
    const validation = searchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: messages.invalidInput, details: validation.error.issues },
        { status: 400 },
      );
    }

    const { query, from, size } = validation.data;

    // Same logic as GET but with POST body
    const cacheKey = getCacheKey(query, from);
    const cached = await getCachedSearch(cacheKey);

    if (cached) {
      await trackCacheEvent("hit");
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    await trackCacheEvent("miss");

    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:10000";

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production") {
      enforceHttps(workerUrl);
    }

    // Generate authentication signature
    const workerSecret = getWorkerSecret();
    const payload = JSON.stringify({ query, from, size });
    const signature = generateWorkerSignature(payload, workerSecret);

    const workerResponse = await fetch(`${workerUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Signature": signature,
        Authorization: `Bearer ${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!workerResponse.ok) {
      throw new Error(
        `Worker returned ${workerResponse.status}: ${workerResponse.statusText}`,
      );
    }

    const apiData = await workerResponse.json();

    // Transform worker response to our format
    const documents = apiData.hits.hits.map(
      (hit: {
        _source: Record<string, unknown>;
        highlight?: { content?: string[] };
        _source_content?: string;
      }) => {
        const source = hit._source;
        const highlights = hit.highlight?.content || [];
        const content =
          highlights.length > 0
            ? highlights.join(" ... ")
            : hit._source_content || "";

        return {
          documentId: source.documentId,
          chunkIndex: source.chunkIndex,
          totalChunks: source.totalChunks,
          startPage: source.startPage,
          endPage: source.endPage,
          fileName: source.ORIGIN_FILE_NAME,
          fileUri: source.ORIGIN_FILE_URI,
          fileSize: source.fileSize,
          totalWords: source.totalWords,
          totalCharacters: source.totalCharacters,
          processedAt: source.processedAt,
          content: content,
          highlights: highlights,
          bucket: source.bucket,
          key: source.key,
        };
      },
    );

    const results = {
      total: apiData.hits.total.value,
      documents,
      searchTerm: query,
      from,
      size,
    };

    const uniqueDocuments = deduplicateDocuments(results.documents);
    const deduplicatedResults = {
      ...results,
      documents: uniqueDocuments,
      uniqueCount: uniqueDocuments.length,
    };

    await setCachedSearch(cacheKey, deduplicatedResults);

    return NextResponse.json({
      ...deduplicatedResults,
      cached: false,
    });
  } catch (error) {
    // POST endpoint error handling
    console.error("Search API POST error:", error);

    const isDevelopment = process.env.NODE_ENV === "development";
    const errorBody = sanitizeError(error, isDevelopment);

    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error.statusCode as number)
        : 500;

    return NextResponse.json(errorBody, { status: statusCode });
  }
}
