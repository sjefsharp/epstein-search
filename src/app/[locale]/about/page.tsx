import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import AdCard from "@/components/ads/AdCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://epstein-search.vercel.app";

  const socialProfiles = t.raw("socialProfiles") as string[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Epstein Files Search",
    url: baseUrl,
    logo: `${baseUrl}/og-image.svg`,
    sameAs: Array.isArray(socialProfiles) ? socialProfiles : [],
    inLanguage: locale,
  };

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.15),_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_40%,_#e5e7eb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_50%),linear-gradient(180deg,_#0f172a_0%,_#0b1120_100%)]">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Breadcrumbs />

        <header className="mb-8 mt-4 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{t("intro")}</p>
        </header>

        <div className="space-y-8 text-sm text-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("missionTitle")}</h2>
            <p className="text-muted-foreground">{t("mission")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("dataSourceTitle")}</h2>
            <p className="text-muted-foreground">{t("dataSource")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("technologyTitle")}</h2>
            <p className="text-muted-foreground">{t("technology")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("privacyTitle")}</h2>
            <p className="text-muted-foreground">{t("privacy")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("howItWorksTitle")}</h2>
            <p className="text-muted-foreground">{t("howItWorks")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("documentTypesTitle")}</h2>
            <p className="text-muted-foreground">{t("documentTypes")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t("openSourceTitle")}</h2>
            <p className="text-muted-foreground">{t("openSource")}</p>
          </section>
        </div>

        <div className="mt-10">
          <AdCard slotId="9328638488" className="min-h-[250px]" />
        </div>
      </div>
    </div>
  );
}
