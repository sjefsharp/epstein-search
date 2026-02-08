/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  usePathname: () => "/",
}));

vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon" />,
}));

describe("MobileNav", () => {
  it("renders hamburger menu button", async () => {
    const { default: MobileNav } = await import("../../src/components/navigation/MobileNav");

    renderWithIntl(<MobileNav />);

    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).toBeInTheDocument();
  });

  it("opens dropdown and shows navigation links", async () => {
    const user = userEvent.setup();
    const { default: MobileNav } = await import("../../src/components/navigation/MobileNav");

    renderWithIntl(<MobileNav />);

    const button = screen.getByRole("button", { name: /menu/i });
    await user.click(button);

    expect(screen.getByText(/home/i)).toBeInTheDocument();
    expect(screen.getByText(/about/i)).toBeInTheDocument();
    expect(screen.getByText(/faq/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
  });
});
