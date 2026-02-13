import { describe, expect, it } from "vitest";
import { normalizeLocale } from "@/lib/locale";

describe("locale", () => {
  describe("normalizeLocale", () => {
    it("returns en when locale is missing", () => {
      expect(normalizeLocale()).toBe("en");
      expect(normalizeLocale(null)).toBe("en");
    });

    it("normalizes supported locale prefixes", () => {
      expect(normalizeLocale("nl-NL")).toBe("nl");
      expect(normalizeLocale("fr-CA")).toBe("fr");
      expect(normalizeLocale("de-DE")).toBe("de");
      expect(normalizeLocale("es-MX")).toBe("es");
      expect(normalizeLocale("pt-BR")).toBe("pt");
    });

    it("falls back to en for unsupported locales", () => {
      expect(normalizeLocale("it-IT")).toBe("en");
      expect(normalizeLocale("zh-CN")).toBe("en");
    });
  });
});
