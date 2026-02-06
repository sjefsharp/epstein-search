/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CONSENT_DEFAULT,
  ensureGtag,
  setConsentDefault,
  toConsentUpdate,
  updateConsent,
} from "../../src/lib/consent";

describe("consent", () => {
  beforeEach(() => {
    window.dataLayer = [];
    delete window.gtag;
  });

  it("builds consent update for accept/reject", () => {
    expect(toConsentUpdate({ adsConsent: true })).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "denied",
    });

    expect(toConsentUpdate({ adsConsent: false })).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
  });

  it("ensures gtag is available and pushes to dataLayer", () => {
    ensureGtag();

    expect(window.gtag).toBeTypeOf("function");

    window.gtag?.("event", "test");
    expect(window.dataLayer?.length).toBe(1);
  });

  it("sets default consent via gtag", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    setConsentDefault();

    expect(gtag).toHaveBeenCalledWith("consent", "default", CONSENT_DEFAULT);
  });

  it("updates consent via gtag", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    updateConsent({ adsConsent: true });

    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "denied",
    });
  });
});
