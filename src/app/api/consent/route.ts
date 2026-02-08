import { NextRequest, NextResponse } from "next/server";
import { consentLogSchema } from "@/lib/validation";
import { checkRateLimit, consentRatelimit, getClientIp } from "@/lib/ratelimit";
import { runQuery } from "@/lib/db";
import { sanitizeError } from "@/lib/security";

type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

const CONSENT_TABLES: Record<SupportedLocale, string> = {
  en: "consent_events_en",
  nl: "consent_events_nl",
  fr: "consent_events_fr",
  de: "consent_events_de",
  es: "consent_events_es",
  pt: "consent_events_pt",
};

const ERROR_MESSAGES: Record<
  SupportedLocale,
  { rateLimit: string; invalidInput: string; serverError: string }
> = {
  en: {
    rateLimit: "Rate limit exceeded. Please try again later.",
    invalidInput: "Invalid input",
    serverError: "Unable to record consent",
  },
  nl: {
    rateLimit: "Rate limit bereikt. Probeer het later opnieuw.",
    invalidInput: "Ongeldige invoer",
    serverError: "Kan toestemming niet opslaan",
  },
  fr: {
    rateLimit: "Limite de débit dépassée. Veuillez réessayer plus tard.",
    invalidInput: "Entrée invalide",
    serverError: "Impossible d'enregistrer le consentement",
  },
  de: {
    rateLimit: "Rate-Limit überschritten. Bitte später erneut versuchen.",
    invalidInput: "Ungültige Eingabe",
    serverError: "Zustimmung konnte nicht gespeichert werden",
  },
  es: {
    rateLimit: "Límite de velocidad excedido. Por favor intente más tarde.",
    invalidInput: "Entrada inválida",
    serverError: "No se pudo guardar el consentimiento",
  },
  pt: {
    rateLimit: "Limite de taxa excedido. Por favor tente mais tarde.",
    invalidInput: "Entrada inválida",
    serverError: "Não foi possível salvar o consentimento",
  },
};

const getErrorMessages = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return ERROR_MESSAGES.nl;
    case "fr":
      return ERROR_MESSAGES.fr;
    case "de":
      return ERROR_MESSAGES.de;
    case "es":
      return ERROR_MESSAGES.es;
    case "pt":
      return ERROR_MESSAGES.pt;
    case "en":
    default:
      return ERROR_MESSAGES.en;
  }
};

const getConsentTable = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return CONSENT_TABLES.nl;
    case "fr":
      return CONSENT_TABLES.fr;
    case "de":
      return CONSENT_TABLES.de;
    case "es":
      return CONSENT_TABLES.es;
    case "pt":
      return CONSENT_TABLES.pt;
    case "en":
    default:
      return CONSENT_TABLES.en;
  }
};

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, consentRatelimit);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.en.rateLimit },
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
    const selectedLocale = normalizeLocale(body?.locale);
    const messages = getErrorMessages(selectedLocale);
    const validation = consentLogSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: messages.invalidInput,
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { eventType, adsConsent, locale, policyVersion, eventTimestamp } = validation.data;
    const resolvedLocale = locale satisfies SupportedLocale;
    const table = getConsentTable(resolvedLocale);

    const query = `
      INSERT INTO ${table} (
        event_type,
        ads_consent,
        policy_version,
        locale,
        event_timestamp,
        received_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `;

    const result = await runQuery<{ id: string }>(query, [
      eventType,
      adsConsent,
      policyVersion,
      resolvedLocale,
      eventTimestamp,
    ]);

    return NextResponse.json({ ok: true, id: result.rows[0]?.id });
  } catch (error) {
    process.stderr.write(
      `Consent API error: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }\n`,
    );
    const errorBody = sanitizeError(error, process.env.NODE_ENV === "development");
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.en.serverError,
        details: errorBody,
      },
      { status: 500 },
    );
  }
}
