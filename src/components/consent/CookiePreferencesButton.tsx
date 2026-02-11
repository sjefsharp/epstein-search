"use client";

import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsentStore } from "@/store/consent-store";

export default function CookiePreferencesButton() {
  const t = useTranslations("ConsentBanner");
  const { preferencesOpen, openPreferences } = useConsentStore();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={openPreferences}
      aria-expanded={preferencesOpen}
      className="gap-2"
    >
      <Cookie className="size-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{t("preferencesLink")}</span>
    </Button>
  );
}
