/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { useConsentStore } from "@/store/consent-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("consent-store", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useConsentStore());

    expect(result.current.status).toBe("unknown");
    expect(result.current.adsConsent).toBe(false);
    expect(result.current.draftAdsConsent).toBe(false);
    expect(result.current.policyVersion).toBe("1.0.0");
    expect(result.current.locale).toBe("en");
    expect(result.current.preferencesOpen).toBe(false);
  });

  it("setConsent updates status and adsConsent", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setConsent("accepted", true);
    });

    expect(result.current.status).toBe("accepted");
    expect(result.current.adsConsent).toBe(true);
    expect(result.current.lastUpdated).toBeDefined();
  });

  it("setDraftAdsConsent updates draft consent", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setDraftAdsConsent(true);
    });

    expect(result.current.draftAdsConsent).toBe(true);
  });

  it("setPolicyVersion updates version if different", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setPolicyVersion("2.0.0");
    });

    expect(result.current.policyVersion).toBe("2.0.0");
  });

  it("setPolicyVersion does not update if version is same", () => {
    const { result } = renderHook(() => useConsentStore());

    const initialVersion = result.current.policyVersion;

    act(() => {
      result.current.setPolicyVersion(initialVersion);
    });

    expect(result.current.policyVersion).toBe(initialVersion);
  });

  it("setLocale updates locale if different", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setLocale("fr");
    });

    expect(result.current.locale).toBe("fr");
  });

  it("setLocale does not update if locale is same", () => {
    const { result } = renderHook(() => useConsentStore());

    const initialLocale = result.current.locale;

    act(() => {
      result.current.setLocale(initialLocale);
    });

    expect(result.current.locale).toBe(initialLocale);
  });

  it("openPreferences sets preferencesOpen to true and copies adsConsent to draftAdsConsent", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setConsent("accepted", true);
    });

    act(() => {
      result.current.openPreferences();
    });

    expect(result.current.preferencesOpen).toBe(true);
    expect(result.current.draftAdsConsent).toBe(true);
  });

  it("closePreferences sets preferencesOpen to false", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.openPreferences();
    });

    expect(result.current.preferencesOpen).toBe(true);

    act(() => {
      result.current.closePreferences();
    });

    expect(result.current.preferencesOpen).toBe(false);
  });

  it("togglePreferences toggles preferencesOpen state", () => {
    const { result } = renderHook(() => useConsentStore());

    expect(result.current.preferencesOpen).toBe(false);

    act(() => {
      result.current.togglePreferences();
    });

    expect(result.current.preferencesOpen).toBe(true);

    act(() => {
      result.current.togglePreferences();
    });

    expect(result.current.preferencesOpen).toBe(false);
  });

  it("togglePreferences copies adsConsent to draftAdsConsent when opening", () => {
    const { result } = renderHook(() => useConsentStore());

    act(() => {
      result.current.setConsent("accepted", true);
    });

    act(() => {
      result.current.togglePreferences();
    });

    expect(result.current.preferencesOpen).toBe(true);
    expect(result.current.draftAdsConsent).toBe(true);
  });
});
