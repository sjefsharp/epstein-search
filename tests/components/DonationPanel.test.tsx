/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl } from "../utils/renderWithIntl";

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

describe("DonationPanel", () => {
  const originalEnv = process.env;
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("shows empty state when no addresses configured", async () => {
    delete process.env.NEXT_PUBLIC_BTC_ADDRESS;
    delete process.env.NEXT_PUBLIC_ETH_ADDRESS;

    const { default: DonationPanel } = await import("../../src/components/donations/DonationPanel");

    renderWithIntl(<DonationPanel />);

    expect(navigator.clipboard.writeText).toBe(writeTextMock);

    expect(screen.getByText(/add your btc\/eth address/i)).toBeInTheDocument();
  });

  it("renders copy button when BTC address is set", async () => {
    const user = userEvent.setup();
    process.env.NEXT_PUBLIC_BTC_ADDRESS = "btc-address";
    delete process.env.NEXT_PUBLIC_ETH_ADDRESS;

    const { default: DonationPanel } = await import("../../src/components/donations/DonationPanel");

    renderWithIntl(<DonationPanel />);

    const copyButton = screen.getByRole("button", { name: /copy address/i });
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText(/address copied/i)).toBeInTheDocument();
    });
  });
});
