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
  const t = await getTranslations({ locale, namespace: "TimelinePage" });

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TimelinePage" });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://epstein-search.vercel.app";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t("heading"),
    description: t("metaDescription"),
    datePublished: "2026-02-08T00:00:00Z",
    dateModified: new Date().toISOString(),
    author: {
      "@type": "Organization",
      name: "Epstein Files Search",
    },
    publisher: {
      "@type": "Organization",
      name: "Epstein Files Search",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/og-image.svg`,
      },
    },
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

        <article className="space-y-8 text-sm text-foreground">
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("investigationTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("investigation")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("arrestTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("arrest")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("deathTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("death")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("releasesTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("releases")}</p>
          </section>
        </article>

        <div className="mt-10">
          <AdCard slotId="9328638488" className="min-h-[250px]" />
        </div>
      </div>
    </div>
  );
}
