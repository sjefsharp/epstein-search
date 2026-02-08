"use client";

import { useEffect } from "react";
import { useConsentStore } from "@/store/consent-store";
import { useAgeStore } from "@/store/age-store";

type Props = {
  adsenseId?: string;
};

export default function AdSenseLoader({ adsenseId }: Props) {
  const { adsConsent, status } = useConsentStore();
  const { verified } = useAgeStore();

  useEffect(() => {
    if (!verified) return;
    if (!adsenseId || status !== "accepted" || !adsConsent) return;

    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`;
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.crossOrigin = "anonymous";

    document.head.appendChild(script);
  }, [adsenseId, adsConsent, status, verified]);

  return null;
}
