import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FAQPage" });

  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FAQPage" });

  const faqs = [1, 2, 3, 4, 5, 6, 7].map((index) => ({
    question: t(`q${index}`),
    answer: t(`a${index}`),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(17,24,39,0.15),_transparent_55%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_40%,_#e5e7eb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_50%),linear-gradient(180deg,_#0f172a_0%,_#0b1120_100%)]">
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("heading")}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            {t("intro")}
          </p>
        </header>

        <div className="rounded-2xl border border-border/70 bg-card/80 px-6 py-2 text-foreground shadow-sm backdrop-blur">
          <Accordion type="multiple" className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem value={`faq-${index}`} key={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
}
