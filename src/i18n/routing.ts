import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // All supported locales
  locales: ['en', 'nl', 'fr', 'de', 'es', 'pt'],
  
  // Default locale (English)
  defaultLocale: 'en',
  
  // Enable automatic locale detection from Accept-Language header
  localeDetection: true,
  
  // Always use locale prefix in URLs (/en/*, /nl/*, etc.)
  localePrefix: 'always'
});

// Lightweight wrappers around Next.js' navigation APIs that handle locale automatically
export const { Link, redirect, usePathname, useRouter, permanentRedirect } =
  createNavigation(routing);
