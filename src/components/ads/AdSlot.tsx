"use client";

import { useEffect, useRef, useState } from "react";
import { useConsentStore } from "@/store/consent-store";
import { useAgeStore } from "@/store/age-store";

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
  const { verified } = useAgeStore();
  const insRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const clientId = adsenseId
    ? adsenseId.startsWith("ca-")
      ? adsenseId
      : `ca-${adsenseId}`
    : undefined;

  useEffect(() => {
    if (!verified) return;
    if (!adsConsent || status !== "accepted") return;
    if (!clientId) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ignore
    }

    const timeout = window.setTimeout(() => {
      const container = insRef.current;
      const iframe = container?.querySelector("iframe");
      const ins = container?.querySelector("ins.adsbygoogle");
      const adStatus = ins?.getAttribute("data-ad-status");
      if (!iframe && adStatus !== "filled") {
        setIsVisible(false);
      }
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [adsConsent, status, clientId, slotId, verified]);

  if (!verified || !clientId || status !== "accepted" || !adsConsent || !isVisible) {
    return null;
  }

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
