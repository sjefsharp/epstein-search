/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import AdSenseLoader from "../../src/components/consent/AdSenseLoader";
import { useConsentStore } from "../../src/store/consent-store";
import { useAgeStore } from "../../src/store/age-store";

describe("AdSenseLoader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    useConsentStore.setState({
      status: "accepted",
      adsConsent: true,
      draftAdsConsent: true,
      policyVersion: "1.0.0",
      locale: "en",
      lastUpdated: undefined,
      preferencesOpen: false,
    });
    useAgeStore.setState({ verified: true });
  });

  it("injects adsense script when consented", async () => {
    render(<AdSenseLoader adsenseId="ca-test" />);

    await waitFor(() => {
      expect(
        document.querySelector(
          'script[src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-test"]',
        ),
      ).toBeTruthy();
    });
  });

  it("does nothing when adsenseId is missing", async () => {
    render(<AdSenseLoader />);

    await waitFor(() => {
      expect(document.querySelector("script")).toBeNull();
    });
  });

  it("does nothing when age is not verified", async () => {
    useAgeStore.setState({ verified: false });

    render(<AdSenseLoader adsenseId="ca-test" />);

    await waitFor(() => {
      expect(document.querySelector("script")).toBeNull();
    });
  });
});
