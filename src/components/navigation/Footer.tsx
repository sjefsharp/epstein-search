"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  const tNav = useTranslations("Navigation");
  const tFooter = useTranslations("Footer");

  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <li>
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("home")}
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("about")}
              </Link>
            </li>
            <li>
              <Link
                href="/timeline"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("timeline")}
              </Link>
            </li>
            <li>
              <Link
                href="/key-figures"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("keyFigures")}
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("faq")}
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {tNav("privacy")}
              </Link>
            </li>
          </ul>
        </nav>
        <Separator className="my-4" />
        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <p>{tFooter("copyright")}</p>
          <p>{tFooter("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
