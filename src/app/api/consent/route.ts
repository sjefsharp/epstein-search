import { NextRequest, NextResponse } from "next/server";
import { consentLogSchema } from "@/lib/validation";
import { checkRateLimit, consentRatelimit, getClientIp } from "@/lib/ratelimit";
import { runQuery } from "@/lib/db";
import { sanitizeError } from "@/lib/security";
import { normalizeLocale } from "@/lib/locale";
import { CONSENT_ERROR_MESSAGES } from "@/lib/error-messages";
import type { SupportedLocale } from "@/lib/types";
import { createRateLimitResponse, withJsonErrorHandling } from "@/lib/api-handler";

const CONSENT_TABLES: Record<SupportedLocale, string> = {
  en: "consent_events_en",
  nl: "consent_events_nl",
  fr: "consent_events_fr",
  de: "consent_events_de",
  es: "consent_events_es",
  pt: "consent_events_pt",
};

const getErrorMessages = (locale: SupportedLocale) => {
  switch (locale) {
    case "nl":
      return CONSENT_ERROR_MESSAGES.nl;
    case "fr":
      return CONSENT_ERROR_MESSAGES.fr;
    case "de":
      return CONSENT_ERROR_MESSAGES.de;
    case "es":
      return CONSENT_ERROR_MESSAGES.es;
    case "pt":
      return CONSENT_ERROR_MESSAGES.pt;
    case "en":
    default:
      return CONSENT_ERROR_MESSAGES.en;
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

export const POST = withJsonErrorHandling(
  async (request: NextRequest) => {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, consentRatelimit);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(CONSENT_ERROR_MESSAGES.en.rateLimit, rateLimitResult);
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
  },
  {
    routeName: "Consent",
    buildErrorBody: (error) => ({
      error: CONSENT_ERROR_MESSAGES.en.serverError,
      details: sanitizeError(error, process.env.NODE_ENV === "development"),
    }),
  },
);
