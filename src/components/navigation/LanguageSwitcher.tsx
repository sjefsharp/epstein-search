"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  type SupportedLocale = (typeof routing.locales)[number];

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const languageEmojis = new Map<SupportedLocale, string>([
    ["en", "🇬🇧"],
    ["nl", "🇳🇱"],
    ["fr", "🇫🇷"],
    ["de", "🇩🇪"],
    ["es", "🇪🇸"],
    ["pt", "🇵🇹"],
  ]);

  return (
    <div className="relative inline-block">
      <label htmlFor="language-select" className="sr-only">
        {t("label")}
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value)}
        className="appearance-none bg-background border border-border rounded-md px-3 py-3 pr-8 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer min-h-12 hover:bg-muted active:bg-muted"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {languageEmojis.get(loc) ?? ""} {t(`languages.${loc}`)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
        <svg
          className="fill-current h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
}
