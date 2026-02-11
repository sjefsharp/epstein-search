/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "../utils/renderWithIntl";
import { vi, describe, beforeEach, it, expect } from "vitest";

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
  CheckIcon: () => <span data-testid="check-icon" />,
  ChevronRightIcon: () => <span data-testid="chevron-right-icon" />,
  CircleIcon: () => <span data-testid="circle-icon" />,
}));

// Static import — vi.mock is hoisted before imports, so mocks are
// already in place when the module loads. This eliminates the
// per-test dynamic-import overhead that caused flaky timeouts under load.
import ThemeToggle from "../../src/components/navigation/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "system";
    mockSetTheme.mockReset();
  });

  it("renders the toggle button with theme label", () => {
    renderWithIntl(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme/i });
    expect(button).toBeInTheDocument();
  });

  it("shows monitor icon in system mode", () => {
    mockTheme = "system";

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("monitor-icon")).toBeInTheDocument();
  });

  it("shows sun icon in light mode", () => {
    mockTheme = "light";

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
  });

  it("shows moon icon in dark mode", () => {
    mockTheme = "dark";

    renderWithIntl(<ThemeToggle />);

    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
  });

  it("opens dropdown and shows theme options", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    expect(screen.getByText(/light/i)).toBeInTheDocument();
    expect(screen.getByText(/dark/i)).toBeInTheDocument();
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });

  it("changes theme when clicking dropdown options", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    const darkOption = screen.getByText(/dark/i);
    await user.click(darkOption);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("sets up media query listener for system theme changes", () => {
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    }));

    mockTheme = "system";

    const { unmount } = renderWithIntl(<ThemeToggle />);

    // Verify listener was added
    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    // Cleanup
    unmount();

    // Verify listener was removed
    expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
