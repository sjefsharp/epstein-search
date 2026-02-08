import { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://epstein-search.vercel.app";
  const pages: Array<{
    path: string;
    priority: number;
    changeFrequency: "daily" | "weekly" | "monthly";
  }> = [
    { path: "", priority: 1.0, changeFrequency: "daily" },
    { path: "/timeline", priority: 0.9, changeFrequency: "weekly" },
    { path: "/key-figures", priority: 0.9, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "weekly" },
    { path: "/faq", priority: 0.8, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.6, changeFrequency: "monthly" },
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Generate entries for all locales and pages
  routing.locales.forEach((locale) => {
    pages.forEach(({ path, priority, changeFrequency }) => {
      const url = `${baseUrl}/${locale}${path}`;

      // Build alternates for hreflang
      const languages: Record<string, string> = {
        "x-default": `${baseUrl}/en${path}`,
      };
      routing.locales.forEach((altLocale) => {
        //eslint-disable-next-line security/detect-object-injection
        languages[altLocale] = `${baseUrl}/${altLocale}${path}`;
      });

      sitemapEntries.push({
        url,
        lastModified: new Date("2026-02-08"),
        changeFrequency,
        priority,
        alternates: {
          languages,
        },
      });
    });
  });

  return sitemapEntries;
}
