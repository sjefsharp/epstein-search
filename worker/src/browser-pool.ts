import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  buildAkamaiDelayMs,
  buildFingerprint,
  getStealthContextOptions,
  getStealthLaunchOptions,
  isProxyEnabled,
  PREWARM_WAIT_UNTIL,
} from "./stealth";
import type { StealthFingerprint } from "./stealth";

export interface BrowserPool {
  browser: Browser;
  context: BrowserContext;
  fingerprint: StealthFingerprint;
  lastPrewarm: number;
}

type LaunchedBrowser = Awaited<ReturnType<typeof chromium.launch>>;

const createStealthContext = async (browser: LaunchedBrowser, fp?: StealthFingerprint) => {
  const context = await browser.newContext(getStealthContextOptions(fp));
  await context.addInitScript(() => {
    // Hide webdriver property
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    // Spoof plugins array (headless Chrome has empty plugins)
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    // Spoof languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    // Spoof chrome.runtime to look like a real extension environment
    const w = window as unknown as Record<string, unknown>;
    if (!w.chrome) {
      w.chrome = {};
    }
    const c = w.chrome as Record<string, unknown>;
    if (!c.runtime) {
      c.runtime = {};
    }
  });
  return context;
};

export const prewarmAkamai = async (page: Page) => {
  // When proxied, use domcontentloaded and block heavy resources to save bandwidth.
  // Akamai cookies are set by JS execution, not by downloading images/fonts.
  const proxied = isProxyEnabled();
  if (proxied) {
    await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,css}", (route) =>
      route.abort(),
    );
  }

  await page.goto("https://www.justice.gov/", {
    waitUntil: proxied ? "domcontentloaded" : PREWARM_WAIT_UNTIL,
    timeout: 30000,
  });

  // Simulate minimal human interaction to satisfy behavioral checks
  await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 300);
  await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 200));

  await page.waitForTimeout(buildAkamaiDelayMs());
};

/**
 * How often to re-prewarm the shared context (ms).
 * Configurable via PREWARM_INTERVAL_MINUTES env var.
 * Defaults to 0 (disabled) when proxy is active to conserve bandwidth,
 * or 10 minutes when no proxy is set.
 */
export const getPrewarmIntervalMs = (): number => {
  const envMinutes = process.env.PREWARM_INTERVAL_MINUTES;
  if (envMinutes !== undefined) {
    const mins = parseInt(envMinutes, 10);
    if (!isNaN(mins) && mins >= 0) return mins * 60 * 1000;
  }
  // Default: disabled when proxied (saves bandwidth), 10 min otherwise
  return isProxyEnabled() ? 0 : 10 * 60 * 1000;
};

let pool: BrowserPool | null = null;
let prewarmTimer: ReturnType<typeof setInterval> | null = null;

/** Initialise (or re-initialise) the global browser pool. */
export async function initBrowserPool(): Promise<BrowserPool> {
  // Tear down any previous pool
  await destroyBrowserPool();

  const fp = buildFingerprint();
  const browser = await chromium.launch(getStealthLaunchOptions());
  const context = await createStealthContext(browser, fp);

  // Prewarm the context so Akamai cookies are ready
  const page = await context.newPage();
  try {
    await prewarmAkamai(page);
  } finally {
    await page.close().catch(() => {});
  }

  pool = { browser, context, fingerprint: fp, lastPrewarm: Date.now() };

  // Schedule periodic re-prewarm to keep cookies fresh
  // When proxied, periodic prewarm is disabled by default to conserve bandwidth.
  // On-demand prewarm still occurs on 403 retries.
  const intervalMs = getPrewarmIntervalMs();
  if (intervalMs > 0) {
    prewarmTimer = setInterval(async () => {
      if (!pool) return;
      const p = await pool.context.newPage();
      try {
        await prewarmAkamai(p);
        pool.lastPrewarm = Date.now();
      } catch (err) {
        process.stderr.write(
          `[worker] prewarm refresh failed: ${err instanceof Error ? err.message : "unknown"}\n`,
        );
      } finally {
        await p.close().catch(() => {});
      }
    }, intervalMs);
    process.stdout.write(`[worker] periodic prewarm enabled (every ${intervalMs / 60000} min)\n`);
  } else {
    process.stdout.write("[worker] periodic prewarm disabled (on-demand only via retry)\n");
  }

  process.stdout.write(
    `[worker] browser pool initialised (fingerprint: ${fp.userAgent.slice(-30)})\n`,
  );
  return pool;
}

/** Destroy the global browser pool. */
export async function destroyBrowserPool(): Promise<void> {
  if (prewarmTimer) {
    clearInterval(prewarmTimer);
    prewarmTimer = null;
  }
  if (pool) {
    await pool.context.close().catch(() => {});
    await pool.browser.close().catch(() => {});
    pool = null;
  }
}

/**
 * Get a healthy browser pool, re-initialising if necessary.
 * Falls back to a fresh pool if the existing one is unhealthy.
 */
export async function getPool(): Promise<BrowserPool> {
  if (pool) {
    // Check if browser is still connected
    if (pool.browser.isConnected()) {
      return pool;
    }
    process.stderr.write("[worker] browser disconnected — reinitialising pool\n");
  }
  return initBrowserPool();
}
