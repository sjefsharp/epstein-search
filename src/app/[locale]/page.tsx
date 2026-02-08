"use client";

import { useTranslations } from "next-intl";
import ChatContainer from "@/components/chat/ChatContainer";
import DonationPanel from "@/components/donations/DonationPanel";
import AdCard from "@/components/ads/AdCard";
import { Card } from "@/components/ui/card";

export default function Home() {
  const t = useTranslations("HomePage");
  const tAbout = useTranslations("AboutCard");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.15),_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_40%,_#e5e7eb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_50%),linear-gradient(180deg,_#0f172a_0%,_#0b1120_100%)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t("tagline")}</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{t("subtitle")}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ChatContainer />

          <aside className="space-y-6">
            <DonationPanel />

            <AdCard
              slotId="1473355302"
              format="autorelaxed"
              fullWidthResponsive={false}
              className="min-h-[90px]"
            />

            <AdCard slotId="9328638488" className="min-h-[250px]" />

            <Card className="p-5 space-y-3 border border-border/70 bg-card/80 backdrop-blur">
              <h2 className="text-sm font-semibold">{tAbout("title")}</h2>
              <p className="text-sm text-muted-foreground">{tAbout("description")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {tAbout("feature1")}</li>
                <li>• {tAbout("feature2")}</li>
                <li>• {tAbout("feature3")}</li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
