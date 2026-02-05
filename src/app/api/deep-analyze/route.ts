// API Route: Deep analysis via PDF worker + Groq
import { NextRequest } from "next/server";
import { generateDeepSummary } from "@/lib/groq";
import { analyzeRatelimit, getClientIp, checkRateLimit } from "@/lib/ratelimit";
import { analyzeSchema } from "@/lib/validation";
import {
  generateWorkerSignature,
  getWorkerSecret,
  enforceHttps,
  sanitizeError,
} from "@/lib/security";

export const runtime = "nodejs"; // Node.js runtime for worker proxy

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
  {
    rateLimit: string;
    invalidInput: string;
    workerMissing: string;
    analyzeFailed: string;
  }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
    workerMissing: "RENDER_WORKER_URL is not set",
    analyzeFailed: "Analysis failed",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
    workerMissing: "RENDER_WORKER_URL is niet ingesteld",
    analyzeFailed: "Analyse mislukt",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
    workerMissing: "RENDER_WORKER_URL n'est pas défini",
    analyzeFailed: "Échec de l'analyse",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
    workerMissing: "RENDER_WORKER_URL ist nicht gesetzt",
    analyzeFailed: "Analyse fehlgeschlagen",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
    workerMissing: "RENDER_WORKER_URL no está configurado",
    analyzeFailed: "Análisis fallido",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
    workerMissing: "RENDER_WORKER_URL não está definido",
    analyzeFailed: "Análise falhou",
  },
};

export async function POST(request: NextRequest) {
  let selectedLocale: SupportedLocale = "en";
  let messages = ERROR_MESSAGES[selectedLocale];

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
    messages = ERROR_MESSAGES[selectedLocale];

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

    const workerUrl = process.env.RENDER_WORKER_URL;
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

    const workerResponse = await fetch(
      `${workerUrl.replace(/\/$/, "")}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Signature": signature,
          Authorization: `Bearer ${signature}`,
        },
        body: payload,
        signal: AbortSignal.timeout(60000), // 60s timeout for PDF processing
      },
    );

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(
        `Worker fout (${workerResponse.status}): ${errorText || "Onbekend"}`,
      );
    }

    const workerData = (await workerResponse.json()) as {
      text: string;
      pages: number;
      metadata: { fileSize: number; extractedAt: string };
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await generateDeepSummary(
            fileName,
            workerData.text,
            searchTerm,
            selectedLocale,
            (text) => {
              const chunk = encoder.encode(
                `data: ${JSON.stringify({ text })}\n\n`,
              );
              controller.enqueue(chunk);
            },
          );

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : messages.analyzeFailed;
          const errorChunk = encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`,
          );
          controller.enqueue(errorChunk);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Deep analyze API error:", error);

    const isDevelopment = process.env.NODE_ENV === "development";
    const errorBody = sanitizeError(error, isDevelopment);

    return new Response(JSON.stringify(errorBody), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
