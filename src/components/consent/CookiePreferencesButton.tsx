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
      variant="outline"
      size="icon"
      onClick={openPreferences}
      aria-label={t("preferencesLink")}
      aria-expanded={preferencesOpen}
      className="size-10"
    >
      <Cookie className="size-4" aria-hidden="true" />
    </Button>
  );
}
