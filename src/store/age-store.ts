"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AgeState = {
  verified: boolean;
  hasHydrated: boolean;
};

type AgeActions = {
  confirmAge: () => void;
  setHasHydrated: (hydrated: boolean) => void;
};

export type AgeStore = AgeState & AgeActions;

export const useAgeStore = create<AgeStore>()(
  persist(
    (set) => ({
      verified: false,
      hasHydrated: false,
      confirmAge: () => set({ verified: true }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: "epstein-age-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        verified: state.verified,
      }),
    },
  ),
);
