"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ConsentStatus = "unknown" | "accepted" | "rejected";

type ConsentState = {
  status: ConsentStatus;
  adsConsent: boolean;
  draftAdsConsent: boolean;
  policyVersion: string;
  locale: string;
  lastUpdated?: string;
  preferencesOpen: boolean;
  hasHydrated: boolean;
};

type ConsentActions = {
  setConsent: (status: ConsentStatus, adsConsent: boolean) => void;
  applyAndClose: (status: ConsentStatus, adsConsent: boolean) => void;
  setDraftAdsConsent: (adsConsent: boolean) => void;
  setPolicyVersion: (version: string) => void;
  setLocale: (locale: string) => void;
  setHasHydrated: (hydrated: boolean) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  togglePreferences: () => void;
};

export type ConsentStore = ConsentState & ConsentActions;

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set, get) => ({
      status: "unknown",
      adsConsent: false,
      draftAdsConsent: false,
      policyVersion: "1.0.0",
      locale: "en",
      lastUpdated: undefined,
      preferencesOpen: false,
      hasHydrated: false,
      setConsent: (status, adsConsent) => {
        set({
          status,
          adsConsent,
          lastUpdated: new Date().toISOString(),
        });
      },
      applyAndClose: (status, adsConsent) => {
        set({
          status,
          adsConsent,
          lastUpdated: new Date().toISOString(),
          preferencesOpen: false,
        });
      },
      setDraftAdsConsent: (adsConsent) => {
        set({ draftAdsConsent: adsConsent });
      },
      setPolicyVersion: (version) => {
        const current = get();
        if (current.policyVersion !== version) {
          set({ policyVersion: version });
        }
      },
      setLocale: (locale) => {
        const current = get();
        if (current.locale !== locale) {
          set({ locale });
        }
      },
      setHasHydrated: (hydrated) => {
        set({ hasHydrated: hydrated });
      },
      openPreferences: () =>
        set((state) => ({
          preferencesOpen: true,
          draftAdsConsent: state.adsConsent,
        })),
      closePreferences: () => set({ preferencesOpen: false }),
      togglePreferences: () =>
        set((state) => ({
          preferencesOpen: !state.preferencesOpen,
          draftAdsConsent: state.adsConsent,
        })),
    }),
    {
      name: "epstein-consent-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        status: state.status,
        adsConsent: state.adsConsent,
        policyVersion: state.policyVersion,
        locale: state.locale,
        lastUpdated: state.lastUpdated,
      }),
    },
  ),
);
