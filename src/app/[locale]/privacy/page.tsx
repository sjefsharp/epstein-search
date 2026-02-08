import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PrivacyPage" });

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PrivacyPage" });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.15),_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_40%,_#e5e7eb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_50%),linear-gradient(180deg,_#0f172a_0%,_#0b1120_100%)]">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <Breadcrumbs />

        <header className="mb-8 mt-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {t("lastUpdated")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{t("intro")}</p>
        </header>

        <div className="space-y-8 text-sm text-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("dataCollectionTitle")}</h2>
            <p className="text-muted-foreground">{t("dataCollection")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("cookiesTitle")}</h2>
            <p className="text-muted-foreground">{t("cookies")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("consentTitle")}</h2>
            <p className="text-muted-foreground">{t("consent")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("adsenseTitle")}</h2>
            <p className="text-muted-foreground">{t("adsense")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("withdrawTitle")}</h2>
            <p className="text-muted-foreground">{t("withdraw")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("thirdPartyTitle")}</h2>
            <p className="text-muted-foreground">{t("thirdParty")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("gdprTitle")}</h2>
            <p className="text-muted-foreground">{t("gdpr")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("contactTitle")}</h2>
            <p className="text-muted-foreground">{t("contact")}</p>
          </section>
        </div>

        <div className="mt-8">
          <Breadcrumbs />
        </div>
      </div>
    </div>
  );
}
