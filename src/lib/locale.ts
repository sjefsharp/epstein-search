import type { SupportedLocale } from "@/lib/types";

export const normalizeLocale = (locale?: string | null): SupportedLocale => {
  if (!locale) return "en";

  const normalized = locale.toLowerCase();
  if (normalized.startsWith("nl")) return "nl";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("pt")) return "pt";

  return "en";
};
