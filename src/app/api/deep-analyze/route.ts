// API Route: Deep analysis via PDF worker + Groq
import { NextRequest } from "next/server";
import { generateDeepSummary } from "@/lib/groq";
import { analyzeRatelimit, getClientIp, checkRateLimit } from "@/lib/ratelimit";
import { analyzeSchema } from "@/lib/validation";
import { normalizeLocale } from "@/lib/locale";
import { DEEP_ANALYZE_ERROR_MESSAGES } from "@/lib/error-messages";
import { createSSEResponse } from "@/lib/sse";
import { resolveWorkerUrl } from "@/lib/worker-url";
import type { SupportedLocale } from "@/lib/types";
import {
  generateWorkerSignature,
  getWorkerSecret,
  enforceHttps,
  sanitizeError,
} from "@/lib/security";

export const runtime = "nodejs"; // Node.js runtime for worker proxy

const getErrorMessages = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return DEEP_ANALYZE_ERROR_MESSAGES.nl;
    case "fr":
      return DEEP_ANALYZE_ERROR_MESSAGES.fr;
    case "de":
      return DEEP_ANALYZE_ERROR_MESSAGES.de;
    case "es":
      return DEEP_ANALYZE_ERROR_MESSAGES.es;
    case "pt":
      return DEEP_ANALYZE_ERROR_MESSAGES.pt;
    case "en":
    default:
      return DEEP_ANALYZE_ERROR_MESSAGES.en;
  }
};

export async function POST(request: NextRequest) {
  let selectedLocale: SupportedLocale = "en";
  let messages = getErrorMessages(selectedLocale);

  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, analyzeRatelimit);

    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: messages.rateLimit,
          retryAfter: rateLimitResult.reset?.toString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.reset?.toString() || "60",
          },
        },
      );
    }

    const body = await request.json();
    selectedLocale = normalizeLocale(body?.locale);
    messages = getErrorMessages(selectedLocale);

    // Input validation
    const validation = analyzeSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: messages.invalidInput,
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { fileUri, fileName, searchTerm } = validation.data;

    const workerUrl = resolveWorkerUrl();
    if (!workerUrl) {
      return new Response(JSON.stringify({ error: messages.workerMissing }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // HTTPS enforcement
    if (process.env.NODE_ENV === "production") {
      enforceHttps(workerUrl);
    }

    // Worker authentication
    const workerSecret = getWorkerSecret();
    const payload = JSON.stringify({ fileUri });
    const signature = generateWorkerSignature(payload, workerSecret);

    const workerResponse = await fetch(`${workerUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Signature": signature,
        Authorization: `Bearer ${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(60000), // 60s timeout for PDF processing
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(`Worker fout (${workerResponse.status}): ${errorText || "Onbekend"}`);
    }

    const workerData = (await workerResponse.json()) as {
      text: string;
      pages: number;
      metadata: { fileSize: number; extractedAt: string };
    };

    return createSSEResponse(
      async (emitText) => {
        await generateDeepSummary(fileName, workerData.text, searchTerm, selectedLocale, emitText);
      },
      {
        getErrorMessage: (error) =>
          error instanceof Error ? error.message : messages.analyzeFailed,
      },
    );
  } catch (error) {
    process.stderr.write(
      `Deep analyze API error: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }\n`,
    );

    const isDevelopment = process.env.NODE_ENV === "development";
    const errorBody = sanitizeError(error, isDevelopment);

    return new Response(JSON.stringify(errorBody), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
