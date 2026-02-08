/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "../utils/renderWithIntl";

// Mock window.matchMedia (not implemented in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the theme store
const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("@/store/theme-store", () => ({
  useThemeStore: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Sun: () => <span data-testid="sun-icon" />,
  Moon: () => <span data-testid="moon-icon" />,
  Monitor: () => <span data-testid="monitor-icon" />,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "system";
    mockSetTheme.mockReset();
  });

  it("renders the toggle button with theme label", async () => {
    const { default: ThemeToggle } = await import("../../src/components/navigation/ThemeToggle");

    renderWithIntl(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme/i });
    expect(button).toBeInTheDocument();
  });

  it("shows monitor icon in system mode", async () => {
    mockTheme = "system";
    const { default: ThemeToggle } = await import("../../src/components/navigation/ThemeToggle");

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("monitor-icon")).toBeInTheDocument();
  });

  it("shows sun icon in light mode", async () => {
    mockTheme = "light";
    const { default: ThemeToggle } = await import("../../src/components/navigation/ThemeToggle");

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
  });

  it("shows moon icon in dark mode", async () => {
    mockTheme = "dark";
    const { default: ThemeToggle } = await import("../../src/components/navigation/ThemeToggle");

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
  });

  it("opens dropdown and shows theme options", async () => {
    const user = userEvent.setup();
    const { default: ThemeToggle } = await import("../../src/components/navigation/ThemeToggle");

    renderWithIntl(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    expect(screen.getByText(/light/i)).toBeInTheDocument();
    expect(screen.getByText(/dark/i)).toBeInTheDocument();
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });
});
