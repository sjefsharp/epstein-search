/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "../utils/renderWithIntl";

// Mock the age store
const mockConfirmAge = vi.fn();
let mockVerified = false;

vi.mock("@/store/age-store", () => ({
  useAgeStore: () => ({
    verified: mockVerified,
    confirmAge: mockConfirmAge,
  }),
}));

vi.mock("lucide-react", () => ({
  ShieldAlert: () => <span data-testid="shield-icon" />,
}));

describe("AgeVerification", () => {
  beforeEach(() => {
    mockVerified = false;
    mockConfirmAge.mockReset();
  });

  it("renders the age gate when not verified", async () => {
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    renderWithIntl(<AgeVerification />);

    expect(screen.getByText(/age verification required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /18/i })).toBeInTheDocument();
  });

  it("returns null when already verified", async () => {
    mockVerified = true;
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    const { container } = renderWithIntl(<AgeVerification />);
    expect(container.innerHTML).toBe("");
  });

  it("calls confirmAge when button is clicked", async () => {
    const user = userEvent.setup();
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    renderWithIntl(<AgeVerification />);

    const button = screen.getByRole("button", { name: /18/i });
    await user.click(button);

    expect(mockConfirmAge).toHaveBeenCalledTimes(1);
  });

  it("has proper ARIA attributes for the dialog", async () => {
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    renderWithIntl(<AgeVerification />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "age-gate-title");
    expect(dialog).toHaveAttribute("aria-describedby", "age-gate-description");
  });

  it("shows underage notice text", async () => {
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    renderWithIntl(<AgeVerification />);

    expect(screen.getByText(/under 18/i)).toBeInTheDocument();
  });

  it("uses absolute positioning to scope the overlay", async () => {
    const { default: AgeVerification } = await import("../../src/components/gates/AgeVerification");

    renderWithIntl(<AgeVerification />);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveClass("absolute");
    expect(dialog).not.toHaveClass("fixed");
  });
});
