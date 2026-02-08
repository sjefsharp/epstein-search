/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import AdSlot from "../../src/components/ads/AdSlot";
import { useConsentStore } from "../../src/store/consent-store";

describe("AdSlot", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_ADSENSE_ID: "ca-test" };
    useConsentStore.setState({
      status: "accepted",
      adsConsent: true,
      draftAdsConsent: true,
      policyVersion: "1.0.0",
      locale: "en",
      lastUpdated: undefined,
      preferencesOpen: false,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders ad slot when consented", () => {
    const { container } = render(<AdSlot slotId="123" />);

    expect(container.querySelector("ins[data-ad-slot='123']")).toBeTruthy();
  });

  it("returns null when consent is rejected", () => {
    useConsentStore.setState({ status: "rejected", adsConsent: false });

    const { container } = render(<AdSlot slotId="123" />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when adsense id is missing", () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_ID;

    const { container } = render(<AdSlot slotId="123" />);

    expect(container.firstChild).toBeNull();
  });
});
