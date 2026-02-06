"use client";

import { useTranslations } from "next-intl";
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
    >
      {t("preferencesLink")}
    </Button>
  );
}
