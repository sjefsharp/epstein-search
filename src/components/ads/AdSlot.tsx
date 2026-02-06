"use client";

import { useEffect, useRef } from "react";
import { useConsentStore } from "@/store/consent-store";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  slotId: string;
  format?: "auto" | "autorelaxed";
  fullWidthResponsive?: boolean;
  className?: string;
};

export default function AdSlot({
  slotId,
  format = "auto",
  fullWidthResponsive = true,
  className,
}: Props) {
  const { adsConsent, status } = useConsentStore();
  const insRef = useRef<HTMLDivElement | null>(null);

  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const clientId = adsenseId
    ? adsenseId.startsWith("ca-")
      ? adsenseId
      : `ca-${adsenseId}`
    : undefined;

  useEffect(() => {
    if (!adsConsent || status !== "accepted") return;
    if (!clientId) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
  }, [adsConsent, status, clientId, slotId]);

  if (!clientId || status !== "accepted" || !adsConsent) return null;

  return (
    <div className={className} ref={insRef}>
      <ins
        className="adsbygoogle block"
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}
