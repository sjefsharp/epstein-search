export type ConsentChoice = {
  adsConsent: boolean;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const CONSENT_DEFAULT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

export const toConsentUpdate = (choice: ConsentChoice) => {
  const status = choice.adsConsent ? "granted" : "denied";
  return {
    ad_storage: status,
    ad_user_data: status,
    ad_personalization: status,
    analytics_storage: "denied",
  } as const;
};

export const ensureGtag = () => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
};

export const setConsentDefault = () => {
  if (typeof window === "undefined") return;
  ensureGtag();
  window.gtag?.("consent", "default", CONSENT_DEFAULT);
};

export const updateConsent = (choice: ConsentChoice) => {
  if (typeof window === "undefined") return;
  ensureGtag();
  window.gtag?.("consent", "update", toConsentUpdate(choice));
};
