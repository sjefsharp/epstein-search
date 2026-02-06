/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, render } from "@testing-library/react";
import LanguageSwitcher from "../../src/components/navigation/LanguageSwitcher";

const replaceMock = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "nl", "fr"] },
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/en",
}));

describe("LanguageSwitcher", () => {
  it("renders options for supported locales", () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("replaces route when locale changes", () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "nl" } });

    expect(replaceMock).toHaveBeenCalledWith("/en", { locale: "nl" });
  });
});
