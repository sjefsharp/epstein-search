"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateConsent, setConsentDefault } from "@/lib/consent";
import { useConsentStore } from "@/store/consent-store";

const POLICY_VERSION_FALLBACK = "1.0.0";

type ConsentEventType = "accept" | "reject" | "update" | "withdraw";

type Props = {
  locale: string;
  policyVersion?: string;
};

export default function ConsentBanner({ locale, policyVersion }: Props) {
  const t = useTranslations("ConsentBanner");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    status,
    adsConsent,
    draftAdsConsent,
    preferencesOpen,
    hasHydrated,
    setConsent,
    setDraftAdsConsent,
    setLocale,
    setPolicyVersion,
    openPreferences,
    closePreferences,
  } = useConsentStore();

  const effectivePolicyVersion = policyVersion || POLICY_VERSION_FALLBACK;

  const shouldRender = status === "unknown" || preferencesOpen;

  useEffect(() => {
    setLocale(locale);
    setPolicyVersion(effectivePolicyVersion);
    setConsentDefault();
  }, [locale, effectivePolicyVersion, setLocale, setPolicyVersion]);

  useEffect(() => {
    if (status !== "unknown") {
      updateConsent({ adsConsent });
    }
  }, [status, adsConsent]);

  const eventType = (nextAdsConsent: boolean): ConsentEventType => {
    if (status === "unknown") {
      return nextAdsConsent ? "accept" : "reject";
    }

    if (status === "accepted" && !nextAdsConsent) {
      return "withdraw";
    }

    if (status === "rejected" && nextAdsConsent) {
      return "accept";
    }

    return "update";
  };

  const logConsent = async (type: ConsentEventType, nextAdsConsent: boolean) => {
    const payload = {
      eventType: type,
      adsConsent: nextAdsConsent,
      locale,
      policyVersion: effectivePolicyVersion,
      eventTimestamp: new Date().toISOString(),
    };

    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Ignore logging failures to avoid blocking UX
    }
  };

  const applyConsent = async (nextAdsConsent: boolean) => {
    const nextStatus = nextAdsConsent ? "accepted" : "rejected";
    const nextEvent = eventType(nextAdsConsent);

    setIsSubmitting(true);
    setConsent(nextStatus, nextAdsConsent);
    updateConsent({ adsConsent: nextAdsConsent });
    await logConsent(nextEvent, nextAdsConsent);
    closePreferences();
    setIsSubmitting(false);
  };

  const shouldDelayForHydration = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("epstein-consent-storage");
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state?: { status?: ConsentStatus } };
      const storedStatus = parsed?.state?.status;
      return storedStatus !== undefined && storedStatus !== "unknown";
    } catch {
      return false;
    }
  }, []);

  const privacyHref = useMemo(() => `/${locale}/privacy`, [locale]);

  if (!hasHydrated && shouldDelayForHydration) return null;
  if (!shouldRender) return null;

  return (
    <section
      role="region"
      aria-label={t("bannerAriaLabel")}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
          <p className="text-xs text-muted-foreground">{t("partnerLabel")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => applyConsent(true)} disabled={isSubmitting}>
            {t("accept")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => applyConsent(false)}
            disabled={isSubmitting}
          >
            {t("reject")}
          </Button>
          <Button type="button" variant="ghost" onClick={openPreferences}>
            {t("manage")}
          </Button>
          <Link
            href={privacyHref}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("learnMore")}
          </Link>
        </div>

        {preferencesOpen ? (
          <div className="rounded-lg border border-border bg-card/80 p-4 text-sm text-foreground shadow-sm">
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{t("preferencesTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("preferencesDescription")}</p>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={draftAdsConsent}
                  onChange={(event) => setDraftAdsConsent(event.target.checked)}
                />
                <span>{t("adsLabel")}</span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => applyConsent(draftAdsConsent)}
                disabled={isSubmitting}
              >
                {t("save")}
              </Button>
              {status !== "unknown" ? (
                <Button type="button" variant="ghost" onClick={closePreferences}>
                  {t("close")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
