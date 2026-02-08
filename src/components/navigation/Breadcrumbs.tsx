"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_TO_KEY: Record<string, string> = {
  about: "about",
  faq: "faq",
  privacy: "privacy",
};

export default function Breadcrumbs() {
  const tNav = useTranslations("Navigation");
  const tBreadcrumbs = useTranslations("Breadcrumbs");
  const pathname = usePathname();

  // Split path and filter empty segments
  const segments = pathname.split("/").filter(Boolean);

  // Don't render on home page
  if (segments.length === 0) return null;

  return (
    <nav aria-label={tBreadcrumbs("label")}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
            <span>{tNav("home")}</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const key = SEGMENT_TO_KEY[segment];
          const isLast = index === segments.length - 1;

          return (
            <li key={segment} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5" />
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {key ? tNav(key) : segment}
                </span>
              ) : (
                <Link
                  href={`/${segments.slice(0, index + 1).join("/")}`}
                  className="hover:text-foreground transition-colors"
                >
                  {key ? tNav(key) : segment}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
