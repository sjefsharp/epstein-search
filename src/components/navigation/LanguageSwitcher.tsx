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

  const currentEmoji = languageEmojis.get(locale as SupportedLocale) ?? "🌐";

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor="language-select" className="sr-only">
        {t("label")}
      </label>
      <span className="pointer-events-none flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-base md:hidden">
        {currentEmoji}
      </span>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value)}
        className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0 md:static md:h-auto md:w-auto md:opacity-100 md:appearance-none md:bg-background md:border md:border-border md:rounded-md md:px-3 md:py-3 md:pr-8 md:text-sm md:font-medium md:transition-colors md:focus:outline-none md:focus:ring-2 md:focus:ring-offset-2 md:focus:ring-primary md:min-h-12 md:hover:bg-muted md:active:bg-muted"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {languageEmojis.get(loc) ?? ""} {t(`languages.${loc}`)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center px-2 text-muted-foreground md:flex">
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
