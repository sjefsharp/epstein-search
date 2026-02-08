"use client";

import { useEffect, useRef, useState } from "react";
import { useConsentStore } from "@/store/consent-store";
import { Card } from "@/components/ui/card";

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
  cardClassName?: string;
};

export default function AdCard({
  slotId,
  format = "auto",
  fullWidthResponsive = true,
  className,
  cardClassName,
}: Props) {
  const { adsConsent, status } = useConsentStore();
  const insRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);

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

    const timeout = window.setTimeout(() => {
      const container = insRef.current;
      const iframe = container?.querySelector("iframe");
      const hasHeight = (container?.offsetHeight ?? 0) > 0;
      if (!iframe && !hasHeight) {
        setIsVisible(false);
      }
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [adsConsent, status, clientId, slotId]);

  if (!clientId || status !== "accepted" || !adsConsent || !isVisible) {
    return null;
  }

  return (
    <Card className={cardClassName ?? "border border-border/70 bg-card/80 p-4 backdrop-blur"}>
      <div className={className} ref={insRef}>
        <ins
          className="adsbygoogle block"
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
        />
      </div>
    </Card>
  );
}
