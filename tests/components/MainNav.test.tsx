/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { renderWithIntl } from "../utils/renderWithIntl";

let mockPathname = "/";

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
  usePathname: () => mockPathname,
}));

describe("MainNav", () => {
  it("renders all navigation links", async () => {
    const { default: MainNav } = await import("../../src/components/navigation/MainNav");

    renderWithIntl(<MainNav />);

    expect(screen.getByText(/home/i)).toBeInTheDocument();
    expect(screen.getByText(/about/i)).toBeInTheDocument();
    expect(screen.getByText(/faq/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
  });

  it("highlights active home link when on root path", async () => {
    mockPathname = "/";
    const { default: MainNav } = await import("../../src/components/navigation/MainNav");

    renderWithIntl(<MainNav />);

    const homeLink = screen.getByText(/home/i);
    expect(homeLink.className).toContain("font-semibold");
  });

  it("highlights active about link when on about path", async () => {
    mockPathname = "/about";
    const { default: MainNav } = await import("../../src/components/navigation/MainNav");

    renderWithIntl(<MainNav />);

    const aboutLink = screen.getByText(/about/i);
    expect(aboutLink.className).toContain("font-semibold");
  });
});
