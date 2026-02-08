/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { renderWithIntl } from "../utils/renderWithIntl";

// Mock the consent store
let mockAdsConsent = false;
let mockStatus = "pending";

vi.mock("@/store/consent-store", () => ({
  useConsentStore: () => ({
    adsConsent: mockAdsConsent,
    status: mockStatus,
  }),
}));

describe("AdCard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockAdsConsent = false;
    mockStatus = "pending";
  });

  it("returns null when no adsenseId is configured", async () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_ID;

    const { default: AdCard } = await import("../../src/components/ads/AdCard");

    const { container } = renderWithIntl(<AdCard slotId="1234567890" />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when consent not accepted", async () => {
    process.env.NEXT_PUBLIC_ADSENSE_ID = "ca-test-id";
    mockAdsConsent = false;
    mockStatus = "pending";

    const { default: AdCard } = await import("../../src/components/ads/AdCard");

    const { container } = renderWithIntl(<AdCard slotId="1234567890" />);

    expect(container.innerHTML).toBe("");
  });

  it("renders card with ad slot when consent is accepted", async () => {
    process.env.NEXT_PUBLIC_ADSENSE_ID = "ca-test-id";
    mockAdsConsent = true;
    mockStatus = "accepted";

    const { default: AdCard } = await import("../../src/components/ads/AdCard");

    const { container } = renderWithIntl(<AdCard slotId="1234567890" />);

    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute("data-ad-slot")).toBe("1234567890");
    expect(ins?.getAttribute("data-ad-client")).toBe("ca-test-id");
  });
});
