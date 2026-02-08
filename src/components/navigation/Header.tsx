"use client";

import CookiePreferencesButton from "@/components/consent/CookiePreferencesButton";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import MainNav from "./MainNav";
import MobileNav from "./MobileNav";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 md:gap-6">
        <div className="flex items-center gap-4">
          <MobileNav />
          <MainNav />
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <ThemeToggle />
          <CookiePreferencesButton />
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}
