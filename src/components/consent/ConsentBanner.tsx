"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateConsent, setConsentDefault } from "@/lib/consent";
import { useConsentStore, type ConsentStatus } from "@/store/consent-store";

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
    applyAndClose,
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
    applyAndClose(nextStatus, nextAdsConsent);
    updateConsent({ adsConsent: nextAdsConsent });
    setIsSubmitting(false);
    void logConsent(nextEvent, nextAdsConsent);
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
        {preferencesOpen ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{t("preferencesTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("preferencesDescription")}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => applyConsent(false)}
                aria-label={t("dismiss")}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-foreground"
                checked={draftAdsConsent}
                onChange={(event) => setDraftAdsConsent(event.target.checked)}
              />
              <span>{t("adsLabel")}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => applyConsent(draftAdsConsent)}
                disabled={isSubmitting}
              >
                {t("save")}
              </Button>
              <Button type="button" variant="outline" onClick={closePreferences}>
                {t("close")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{t("title")}</p>
                <p className="text-xs text-muted-foreground">{t("description")}</p>
                <p className="text-xs text-muted-foreground">{t("partnerLabel")}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => applyConsent(false)}
                aria-label={t("dismiss")}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          </>
        )}
      </div>
    </section>
  );
}
