// API Route: Search DOJ Epstein files
// Strategy: Redis cache → Neon DB (local cache) → direct DOJ API (fast) → worker w/ proxy (Playwright).
import { NextRequest, NextResponse } from "next/server";
import type { SupportedLocale } from "@/lib/types";
import { searchSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp, searchRatelimit } from "@/lib/ratelimit";
import { normalizeLocale } from "@/lib/locale";
import { SEARCH_ERROR_MESSAGES } from "@/lib/error-messages";
import { sanitizeError } from "@/lib/security";
import { ensureEpsteinQuery, executeSearch } from "@/lib/search-service";
import { createRateLimitResponse, withJsonErrorHandling } from "@/lib/api-handler";

const getErrorMessages = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return SEARCH_ERROR_MESSAGES.nl;
    case "fr":
      return SEARCH_ERROR_MESSAGES.fr;
    case "de":
      return SEARCH_ERROR_MESSAGES.de;
    case "es":
      return SEARCH_ERROR_MESSAGES.es;
    case "pt":
      return SEARCH_ERROR_MESSAGES.pt;
    case "en":
    default:
      return SEARCH_ERROR_MESSAGES.en;
  }
};

export const runtime = "nodejs"; // Use Node.js runtime for Upstash Redis compatibility

// ─── GET handler ──────────────────────────────────────────────────────────────

export const GET = withJsonErrorHandling(
  async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams;
    const queryParam = searchParams.get("q");
    const fromParam = searchParams.get("from");
    const sizeParam = searchParams.get("size");
    const localeParam = searchParams.get("locale");
    const selectedLocale = normalizeLocale(localeParam ?? undefined);
    const messages = getErrorMessages(selectedLocale);

    // Rate limiting check
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, searchRatelimit);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(messages.rateLimit, rateLimitResult);
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
  },
  {
    routeName: "Search",
    buildErrorBody: (error) => ({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    }),
  },
);

// ─── POST handler ─────────────────────────────────────────────────────────────

export const POST = withJsonErrorHandling(
  async (request: NextRequest) => {
    // Rate limiting check
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, searchRatelimit);

    let selectedLocale: SupportedLocale = "en";
    let messages = getErrorMessages(selectedLocale);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(messages.rateLimit, rateLimitResult);
    }

    const body = await request.json();
    selectedLocale = normalizeLocale(body?.locale);
    messages = getErrorMessages(selectedLocale);

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
  },
  {
    routeName: "Search POST",
    buildErrorBody: (error) => sanitizeError(error, process.env.NODE_ENV === "development"),
  },
);
