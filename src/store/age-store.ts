"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AgeState = {
  verified: boolean;
};

type AgeActions = {
  confirmAge: () => void;
};

export type AgeStore = AgeState & AgeActions;

export const useAgeStore = create<AgeStore>()(
  persist(
    (set) => ({
      verified: false,
      confirmAge: () => set({ verified: true }),
    }),
    {
      name: "epstein-age-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        verified: state.verified,
      }),
    },
  ),
);
