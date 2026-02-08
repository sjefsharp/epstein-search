"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { useAgeStore } from "@/store/age-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AgeVerification() {
  const t = useTranslations("AgeVerification");
  const { verified, confirmAge } = useAgeStore();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!verified && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [verified]);

  if (verified) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
    >
      <Card className="mx-4 max-w-md border-2">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <CardTitle id="age-gate-title" className="text-xl">
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p id="age-gate-description" className="text-sm text-muted-foreground">
            {t("description")}
          </p>
          <Button ref={buttonRef} onClick={confirmAge} size="lg" className="w-full">
            {t("confirmButton")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("underageNotice")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
