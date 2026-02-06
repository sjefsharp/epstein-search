"use client";

import { useEffect } from "react";
import { useConsentStore } from "@/store/consent-store";

type Props = {
  adsenseId?: string;
};

export default function AdSenseLoader({ adsenseId }: Props) {
  const { adsConsent, status } = useConsentStore();

  useEffect(() => {
    if (!adsenseId || status !== "accepted" || !adsConsent) return;

    const existing = document.querySelector(
      `script[data-adsense-id="${adsenseId}"]`,
    );
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`;
    script.crossOrigin = "anonymous";
    script.dataset.adsenseId = adsenseId;

    document.head.appendChild(script);
  }, [adsenseId, adsConsent, status]);

  return null;
}
