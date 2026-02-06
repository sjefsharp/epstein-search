'use client';

import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="flex items-center justify-end gap-4 px-4 py-3 sm:px-6 md:gap-6">
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
