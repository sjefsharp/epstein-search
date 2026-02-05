// API Route: Generate AI summary using Groq
import { NextRequest } from "next/server";
import { generateSummary } from "@/lib/groq";

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
  { required: string; summaryFailed: string; unknown: string }
> = {
  en: {
    required: "searchTerm and documents array are required",
    summaryFailed: "Summary generation failed",
    unknown: "Unknown error occurred",
  },
  nl: {
    required: "searchTerm en documents array zijn verplicht",
    summaryFailed: "Samenvatting genereren mislukt",
    unknown: "Onbekende fout opgetreden",
  },
  fr: {
    required: "searchTerm et documents array sont requis",
    summaryFailed: "Échec de la génération du résumé",
    unknown: "Erreur inconnue",
  },
  de: {
    required: "searchTerm und documents array sind erforderlich",
    summaryFailed: "Zusammenfassungserstellung fehlgeschlagen",
    unknown: "Unbekannter Fehler",
  },
  es: {
    required: "searchTerm y documents array son obligatorios",
    summaryFailed: "Fallo al generar el resumen",
    unknown: "Ocurrió un error desconocido",
  },
  pt: {
    required: "searchTerm e documents array são obrigatórios",
    summaryFailed: "Falha na geração do resumo",
    unknown: "Erro desconhecido",
  },
};

export const runtime = "nodejs"; // Node.js runtime for better stability

export async function POST(request: NextRequest) {
  let selectedLocale: SupportedLocale = "en";
  let messages = ERROR_MESSAGES[selectedLocale];

  try {
    const encoder = new TextEncoder();
    const body = await request.json();
    const { searchTerm, documents, locale } = body;
    selectedLocale = normalizeLocale(locale);
    messages = ERROR_MESSAGES[selectedLocale];

    if (!searchTerm || !documents || !Array.isArray(documents)) {
      return new Response(
        JSON.stringify({
          error: messages.required,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await generateSummary(
            searchTerm,
            documents,
            selectedLocale,
            (text) => {
              // Stream each chunk as it arrives
              const chunk = encoder.encode(
                `data: ${JSON.stringify({ text })}\n\n`,
              );
              controller.enqueue(chunk);
            },
          );

          // Send completion signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : messages.summaryFailed;
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
    console.error("Summarize API error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : messages.unknown,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
