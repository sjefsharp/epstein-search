/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { renderWithIntl } from "../utils/renderWithIntl";

let mockPathname = "/about";

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

vi.mock("lucide-react", () => ({
  ChevronRight: () => <span data-testid="chevron" />,
  Home: () => <span data-testid="home-icon" />,
}));

describe("Breadcrumbs", () => {
  it("renders breadcrumbs on about page", async () => {
    mockPathname = "/about";
    const { default: Breadcrumbs } = await import("../../src/components/navigation/Breadcrumbs");

    renderWithIntl(<Breadcrumbs />);

    const nav = screen.getByRole("navigation", {
      name: /breadcrumb/i,
    });
    expect(nav).toBeInTheDocument();

    // Home link should exist
    expect(screen.getByText(/home/i)).toBeInTheDocument();
    // About should be the current page (not a link)
    expect(screen.getByText(/about/i)).toBeInTheDocument();
  });

  it("does not render on home page", async () => {
    mockPathname = "/";
    const { default: Breadcrumbs } = await import("../../src/components/navigation/Breadcrumbs");

    const { container } = renderWithIntl(<Breadcrumbs />);
    expect(container.innerHTML).toBe("");
  });

  it("marks current page with aria-current", async () => {
    mockPathname = "/faq";
    const { default: Breadcrumbs } = await import("../../src/components/navigation/Breadcrumbs");

    renderWithIntl(<Breadcrumbs />);

    const current = screen.getByText(/faq/i);
    expect(current).toHaveAttribute("aria-current", "page");
  });
});
