// API Route: Generate AI summary using Groq
import { NextRequest } from "next/server";
import { generateSummary } from "@/lib/groq";
import { normalizeLocale } from "@/lib/locale";
import { SUMMARIZE_ERROR_MESSAGES } from "@/lib/error-messages";
import { createSSEResponse } from "@/lib/sse";
import type { SupportedLocale } from "@/lib/types";

const getErrorMessages = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return SUMMARIZE_ERROR_MESSAGES.nl;
    case "fr":
      return SUMMARIZE_ERROR_MESSAGES.fr;
    case "de":
      return SUMMARIZE_ERROR_MESSAGES.de;
    case "es":
      return SUMMARIZE_ERROR_MESSAGES.es;
    case "pt":
      return SUMMARIZE_ERROR_MESSAGES.pt;
    case "en":
    default:
      return SUMMARIZE_ERROR_MESSAGES.en;
  }
};

export const runtime = "nodejs"; // Node.js runtime for better stability

export async function POST(request: NextRequest) {
  let selectedLocale: SupportedLocale = "en";
  let messages = getErrorMessages(selectedLocale);

  try {
    const body = await request.json();
    const { searchTerm, documents, locale } = body;
    selectedLocale = normalizeLocale(locale);
    messages = getErrorMessages(selectedLocale);

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

    return createSSEResponse(
      async (emitText) => {
        await generateSummary(searchTerm, documents, selectedLocale, emitText);
      },
      {
        getErrorMessage: (error) =>
          error instanceof Error ? error.message : messages.summaryFailed,
      },
    );
  } catch (error) {
    process.stderr.write(
      `Summarize API error: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }\n`,
    );

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
