/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import AdSenseLoader from "../../src/components/consent/AdSenseLoader";
import { useConsentStore } from "../../src/store/consent-store";

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
});
