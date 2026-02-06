// API Route: Search DOJ Epstein files
// Strategy: Try direct DOJ API first (fast), fall back to Render worker (Playwright) if Akamai blocks.
import { NextRequest, NextResponse } from "next/server";
import { getCacheKey, deduplicateDocuments } from "@/lib/doj-api";
import type { DOJDocument } from "@/lib/types";
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

const EPSTEIN_REGEX = /\bepstein\b/i;

const ensureEpsteinQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  if (EPSTEIN_REGEX.test(trimmed)) return trimmed;
  return `epstein ${trimmed}`;
};

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

// --- Direct DOJ API fetch (fast path, no Playwright) ---
const DOJ_SEARCH_URL = "https://www.justice.gov/multimedia-search";

interface DOJHit {
  _source: Record<string, unknown>;
  highlight?: { content?: string[] };
  _source_content?: string;
}

interface DOJAPIData {
  hits: {
    total: { value: number };
    hits: DOJHit[];
  };
}

function transformHits(apiData: DOJAPIData): DOJDocument[] {
  return apiData.hits.hits.map((hit: DOJHit): DOJDocument => {
    const source = hit._source;
    const highlights = hit.highlight?.content || [];
    const content =
      highlights.length > 0
        ? highlights.join(" ... ")
        : hit._source_content || "";

    return {
      documentId: source.documentId as string,
      chunkIndex: source.chunkIndex as number,
      totalChunks: source.totalChunks as number,
      startPage: source.startPage as number,
      endPage: source.endPage as number,
      fileName: source.ORIGIN_FILE_NAME as string,
      fileUri: source.ORIGIN_FILE_URI as string,
      fileSize: source.fileSize as number,
      totalWords: source.totalWords as number,
      totalCharacters: source.totalCharacters as number,
      processedAt: source.processedAt as string,
      content: content,
      highlights: highlights,
      bucket: source.bucket as string,
      key: source.key as string,
    };
  });
}

/**
 * Try direct DOJ API call (fast, ~1-3 seconds).
 * Returns null if blocked by Akamai (403 / HTML challenge).
 */
async function fetchDOJDirect(
  query: string,
  from: number,
  size: number,
): Promise<DOJAPIData | null> {
  const url = new URL(DOJ_SEARCH_URL);
  url.searchParams.set("keys", query);
  url.searchParams.set("from", from.toString());
  url.searchParams.set("size", Math.min(size, 100).toString());

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.justice.gov/",
        Origin: "https://www.justice.gov",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: AbortSignal.timeout(15000), // 15s — fast path
    });

    // If Akamai blocks us ⇒ return null so we fall back to the worker
    if (response.status === 403 || response.status === 429) {
      console.warn(
        `[search] Direct DOJ fetch blocked (${response.status}), falling back to worker`,
      );
      return null;
    }

    if (!response.ok) {
      console.warn(
        `[search] Direct DOJ fetch failed (${response.status}), falling back to worker`,
      );
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // Akamai sometimes returns an HTML challenge page with 200
      console.warn(
        "[search] Direct DOJ returned non-JSON (likely Akamai challenge), falling back to worker",
      );
      return null;
    }

    const data: DOJAPIData = await response.json();

    // Sanity check the response structure
    if (!data?.hits?.hits) {
      console.warn(
        "[search] Direct DOJ returned unexpected shape, falling back to worker",
      );
      return null;
    }

    return data;
  } catch (error) {
    console.warn(
      `[search] Direct DOJ fetch error: ${error instanceof Error ? error.message : "unknown"}, falling back to worker`,
    );
    return null;
  }
}

/**
 * Fetch via Render worker (Playwright, slower but bypasses Akamai).
 */
async function fetchViaWorker(
  query: string,
  from: number,
  size: number,
): Promise<DOJAPIData> {
  const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:10000";

  // Enforce HTTPS in production
  if (process.env.NODE_ENV === "production") {
    enforceHttps(workerUrl);
  }

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
    signal: AbortSignal.timeout(55000), // 55s — Playwright needs more time
  });

  if (!workerResponse.ok) {
    let workerErrorDetail = "";
    try {
      const ct = workerResponse.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const errorJson = (await workerResponse.json()) as { error?: string };
        workerErrorDetail = errorJson?.error ? ` - ${errorJson.error}` : "";
      } else {
        const errorText = await workerResponse.text();
        workerErrorDetail = errorText ? ` - ${errorText.slice(0, 300)}` : "";
      }
    } catch {
      workerErrorDetail = "";
    }
    throw new Error(
      `Worker returned ${workerResponse.status}: ${workerResponse.statusText}${workerErrorDetail}`,
    );
  }

  return workerResponse.json();
}

/**
 * Core search logic: direct DOJ first ➜ worker fallback ➜ transform & cache
 */
async function executeSearch(
  query: string,
  effectiveQuery: string,
  from: number,
  size: number,
) {
  const cacheKey = getCacheKey(query, from);
  const cached = await getCachedSearch(cacheKey);

  if (cached) {
    await trackCacheEvent("hit");
    return { data: { ...cached, cached: true }, fromCache: true };
  }

  await trackCacheEvent("miss");

  // 1️⃣ Fast path — direct DOJ API
  let apiData = await fetchDOJDirect(effectiveQuery, from, size);

  // 2️⃣ Slow path — Render worker with Playwright
  if (!apiData) {
    console.log("[search] Using worker fallback for query:", effectiveQuery);
    apiData = await fetchViaWorker(effectiveQuery, from, size);
  }

  const documents = transformHits(apiData);

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

  // Cache the results
  await setCachedSearch(cacheKey, deduplicatedResults);

  return { data: { ...deduplicatedResults, cached: false }, fromCache: false };
}

// ─── GET handler ──────────────────────────────────────────────────────────────

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
    const effectiveQuery = ensureEpsteinQuery(query);

    const { data } = await executeSearch(query, effectiveQuery, from, size);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Search API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const statusCode =
      error instanceof Error && error.name === "TimeoutError"
        ? 504
        : error && typeof error === "object" && "statusCode" in error
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

// ─── POST handler ─────────────────────────────────────────────────────────────

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
    const effectiveQuery = ensureEpsteinQuery(query);

    const { data } = await executeSearch(query, effectiveQuery, from, size);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Search API POST error:", error);

    const isDevelopment = process.env.NODE_ENV === "development";
    const errorBody = sanitizeError(error, isDevelopment);

    const statusCode =
      error instanceof Error && error.name === "TimeoutError"
        ? 504
        : error && typeof error === "object" && "statusCode" in error
          ? (error.statusCode as number)
          : 500;

    return NextResponse.json(errorBody, { status: statusCode });
  }
}
