/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { renderWithIntl } from "../utils/renderWithIntl";

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Footer", () => {
  it("renders navigation links", async () => {
    const { default: Footer } = await import("../../src/components/navigation/Footer");

    renderWithIntl(<Footer />);

    expect(screen.getByText(/home/i)).toBeInTheDocument();
    expect(screen.getByText(/about/i)).toBeInTheDocument();
    expect(screen.getByText(/faq/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
  });

  it("renders copyright text", async () => {
    const { default: Footer } = await import("../../src/components/navigation/Footer");

    renderWithIntl(<Footer />);

    expect(screen.getByText(/2026 DOJ Epstein Files Search/i)).toBeInTheDocument();
  });

  it("renders disclaimer", async () => {
    const { default: Footer } = await import("../../src/components/navigation/Footer");

    renderWithIntl(<Footer />);

    expect(
      screen.getByText(/not affiliated with the u\.s\. department of justice/i),
    ).toBeInTheDocument();
  });

  it("has footer navigation with aria-label", async () => {
    const { default: Footer } = await import("../../src/components/navigation/Footer");

    renderWithIntl(<Footer />);

    const nav = screen.getByRole("navigation", { name: /footer navigation/i });
    expect(nav).toBeInTheDocument();
  });
});
