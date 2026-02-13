import type { BrowserContextOptions, LaunchOptions } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
] as const;

const CLIENT_HINTS: ReadonlyArray<{ ua: string; platform: string }> = [
  {
    ua: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    platform: '"Windows"',
  },
  {
    ua: '"Chromium";v="132", "Google Chrome";v="132", "Not_A Brand";v="24"',
    platform: '"Windows"',
  },
  {
    ua: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    platform: '"macOS"',
  },
  {
    ua: '"Chromium";v="132", "Google Chrome";v="132", "Not_A Brand";v="24"',
    platform: '"macOS"',
  },
  {
    ua: '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    platform: '"Linux"',
  },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

/** Pick a random element from an array. */
export const pickRandom = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Build a randomised stealth fingerprint for a new session. */
export function buildFingerprint() {
  const ua = pickRandom(USER_AGENTS);
  const hints = pickRandom(CLIENT_HINTS);
  const timezone = pickRandom(TIMEZONES);
  const width = 1900 + Math.floor(Math.random() * 21); // 1900–1920
  const height = 1060 + Math.floor(Math.random() * 21); // 1060–1080

  return {
    userAgent: ua,
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "sec-ch-ua": hints.ua,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": hints.platform,
    } as Record<string, string>,
    viewport: { width, height },
    locale: "en-US" as const,
    timezone,
  };
}

export type StealthFingerprint = ReturnType<typeof buildFingerprint>;

// Legacy export kept for backward-compatibility with tests
export const STEALTH_USER_AGENT = USER_AGENTS[0];
export const PREWARM_WAIT_UNTIL = "networkidle" as const;

const STEALTH_LAUNCH_ARGS = [
  "--headless=new",
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-infobars",
  "--window-size=1920,1080",
] as const;

export const buildAkamaiDelayMs = (): number => 3000 + Math.floor(Math.random() * 3000);

export interface ParsedProxy {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Parse a proxy URL into Playwright's proxy config format.
 * Supports http://, https://, and socks5:// with optional credentials.
 */
export function parseProxyUrl(proxyUrl: string): ParsedProxy {
  const url = new URL(proxyUrl);
  const server = `${url.protocol}//${url.hostname}${url.port ? ":" + url.port : ""}`;
  const result: ParsedProxy = { server };
  if (url.username) result.username = decodeURIComponent(url.username);
  if (url.password) result.password = decodeURIComponent(url.password);
  return result;
}

/** Whether a proxy is configured via PROXY_URL env var. */
export const isProxyEnabled = (): boolean => !!process.env.PROXY_URL;

export const getStealthLaunchOptions = (): LaunchOptions => {
  const opts: LaunchOptions = {
    headless: true,
    channel: "chromium",
    args: [...STEALTH_LAUNCH_ARGS],
  };

  const proxyUrl = process.env.PROXY_URL;
  if (proxyUrl) {
    opts.proxy = parseProxyUrl(proxyUrl);
  }

  return opts;
};

export const getStealthContextOptions = (fp?: StealthFingerprint): BrowserContextOptions => {
  const f = fp ?? buildFingerprint();
  return {
    userAgent: f.userAgent,
    extraHTTPHeaders: f.headers,
    viewport: f.viewport,
    locale: f.locale,
    timezoneId: f.timezone,
  };
};
