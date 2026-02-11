"use client";

import { useConsentStore } from "@/store/consent-store";

type ConsentBottomSpacerProps = {
  enabled?: boolean;
};

export default function ConsentBottomSpacer({ enabled = false }: ConsentBottomSpacerProps) {
  const { status, preferencesOpen, hasHydrated } = useConsentStore();

  const isVisible = enabled && hasHydrated && (status === "unknown" || preferencesOpen);
  if (!isVisible) return null;

  const heightClass = preferencesOpen ? "h-52 sm:h-40" : "h-36 sm:h-28";

  return <div role="presentation" aria-hidden="true" className={`w-full ${heightClass}`} />;
}
