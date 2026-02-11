import express from "express";
import type { Request, Response } from "express";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type LaunchOptions,
  type Page,
} from "playwright";
import * as pdfParseModule from "pdf-parse";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import net from "net";
import rateLimit from "express-rate-limit";

// Handle both ESM and CommonJS imports for pdf-parse
type PdfParseResult = {
  text: string;
  numpages: number;
  info?: unknown;
};

// ---------------------------------------------------------------------------
// Stealth fingerprint pool — rotated per browser session to avoid clustering
// ---------------------------------------------------------------------------

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
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-infobars",
  "--window-size=1920,1080",
] as const;

export const buildAkamaiDelayMs = (): number => 3000 + Math.floor(Math.random() * 3000);

// ---------------------------------------------------------------------------
// Proxy support — route all Chromium traffic through a proxy to avoid
// datacenter IP blocking by Akamai. Set PROXY_URL env var to enable.
// Format: http://username:password@host:port or socks5://host:port
// ---------------------------------------------------------------------------

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

function isIpAddress(hostname: string): boolean {
  return net.isIP(hostname) !== 0;
}

export function isAllowedJusticeGovHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();

  // Explicitly block localhost-style names even if they somehow appear under justice.gov
  if (
    lowerHost === "localhost" ||
    lowerHost === "127.0.0.1" ||
    lowerHost === "::1" ||
    lowerHost.endsWith(".localhost")
  ) {
    return false;
  }

  if (isIpAddress(lowerHost)) {
    return false;
  }

  return lowerHost === "justice.gov" || lowerHost.endsWith(".justice.gov");
}

/**
 * Domain-specific error type for justice.gov URL validation.
 * This allows callers to distinguish between different rejection reasons.
 */
export class JusticeGovUrlError extends Error {
  public readonly reason:
    | "INVALID_URL"
    | "UNSAFE_PROTOCOL"
    | "UNALLOWED_HOST"
    | "DISALLOWED_IP"
    | "DISALLOWED_PORT";

  constructor(message: string, reason: JusticeGovUrlError["reason"]) {
    super(message);
    this.name = "JusticeGovUrlError";
    this.reason = reason;
  }
}

/**
 * Validate and reconstruct a URL from its components to prevent SSRF.
 * Breaks the taint chain by building the URL from validated host + path
 * rather than passing the user-supplied string through directly.
 * Strips any embedded credentials and disallows IP literals, ports, and
 * non-justice.gov hosts.
 */
export function buildSafeJusticeGovUrl(input: string): string {
  const raw = String(input).trim();
  if (!raw) {
    throw new JusticeGovUrlError("URL must not be empty", "INVALID_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new JusticeGovUrlError("Invalid URL", "INVALID_URL");
  }

  if (parsed.protocol !== "https:") {
    throw new JusticeGovUrlError("Only HTTPS URLs are allowed", "UNSAFE_PROTOCOL");
  }

  // Disallow explicit ports to avoid talking to unexpected services.
  if (parsed.port && parsed.port !== "443") {
    throw new JusticeGovUrlError("Explicit ports are not allowed", "DISALLOWED_PORT");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject IP-literal hosts outright (both IPv4 and IPv6).
  const isIPv4 = /^[0-9.]+$/.test(hostname);
  const isBracketedIPv6 = /^\[.*\]$/.test(hostname);
  if (isIPv4 || isBracketedIPv6) {
    throw new JusticeGovUrlError("Only justice.gov hosts are allowed", "DISALLOWED_IP");
  }

  // Ensure the hostname is an allowed justice.gov host.
  if (!isAllowedJusticeGovHost(hostname)) {
    throw new JusticeGovUrlError("Only justice.gov hosts are allowed", "UNALLOWED_HOST");
  }

  // Reconstruct from validated parts — no user-controlled raw string passes through.
  const safe = new URL("https://" + hostname);
  safe.pathname = parsed.pathname;
  safe.search = parsed.search;
  safe.hash = parsed.hash;
  // Credentials intentionally omitted: username/password are not copied.
  safe.username = "";
  safe.password = "";

  return safe.toString();
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

const prewarmAkamai = async (page: Page) => {
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

// ---------------------------------------------------------------------------
// Persistent browser pool — keeps a warm Chromium + Akamai session
// ---------------------------------------------------------------------------

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

interface BrowserPool {
  browser: Browser;
  context: BrowserContext;
  fingerprint: StealthFingerprint;
  lastPrewarm: number;
}

let _pool: BrowserPool | null = null;
let _prewarmTimer: ReturnType<typeof setInterval> | null = null;

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

  _pool = { browser, context, fingerprint: fp, lastPrewarm: Date.now() };

  // Schedule periodic re-prewarm to keep cookies fresh
  // When proxied, periodic prewarm is disabled by default to conserve bandwidth.
  // On-demand prewarm still occurs on 403 retries.
  const intervalMs = getPrewarmIntervalMs();
  if (intervalMs > 0) {
    _prewarmTimer = setInterval(async () => {
      if (!_pool) return;
      const p = await _pool.context.newPage();
      try {
        await prewarmAkamai(p);
        _pool.lastPrewarm = Date.now();
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
  return _pool;
}

/** Destroy the global browser pool. */
export async function destroyBrowserPool(): Promise<void> {
  if (_prewarmTimer) {
    clearInterval(_prewarmTimer);
    _prewarmTimer = null;
  }
  if (_pool) {
    await _pool.context.close().catch(() => {});
    await _pool.browser.close().catch(() => {});
    _pool = null;
  }
}

/**
 * Get a healthy browser pool, re-initialising if necessary.
 * Falls back to a fresh pool if the existing one is unhealthy.
 */
async function getPool(): Promise<BrowserPool> {
  if (_pool) {
    // Check if browser is still connected
    if (_pool.browser.isConnected()) {
      return _pool;
    }
    process.stderr.write("[worker] browser disconnected — reinitialising pool\n");
  }
  return initBrowserPool();
}

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

const pdfParse =
  (pdfParseModule as unknown as { default?: PdfParseFn }).default ??
  (pdfParseModule as unknown as PdfParseFn);

const app = express();

type TrustProxyTarget = {
  set: (setting: string, value: unknown) => unknown;
};

export const applyTrustProxy = (target: TrustProxyTarget) => {
  target.set("trust proxy", 1);
};

applyTrustProxy(app as unknown as TrustProxyTarget);

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 analyze requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
type LoggingMiddleware = (req: Request, res: Response, next: (err?: unknown) => void) => void;

app.use(helmet());
app.use(((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const safeUrl = (req.url || "").replace(/[\r\n]/g, "");
    process.stdout.write(
      `[worker] ${req.method} ${safeUrl} -> ${res.statusCode} (${durationMs}ms)\n`,
    );
  });
  next();
}) as LoggingMiddleware);
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "https://epstein-kappa.vercel.app",
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type", "X-Worker-Signature", "Authorization"],
  }),
);
app.use(express.json({ limit: "2mb" }));

// Authentication helper
const verifySignature = (req: Request, res: Response): boolean => {
  const signatureHeader = req.headers["x-worker-signature"];
  const authHeader = req.headers["authorization"];
  const signatureFromHeader =
    typeof signatureHeader === "string"
      ? signatureHeader
      : Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : undefined;
  const authValue =
    typeof authHeader === "string"
      ? authHeader
      : Array.isArray(authHeader)
        ? authHeader[0]
        : undefined;
  const bearerToken = authValue?.startsWith("Bearer ")
    ? authValue.slice("Bearer ".length)
    : undefined;
  const signature = signatureFromHeader || bearerToken;
  const sharedSecret = process.env.WORKER_SHARED_SECRET;

  if (!sharedSecret) {
    process.stderr.write("WORKER_SHARED_SECRET not configured\n");
    res.status(500).json({ error: "Server misconfigured" });
    return false;
  }

  if (!signature) {
    res.status(401).json({ error: "Missing authentication signature" });
    return false;
  }

  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha256", sharedSecret).update(payload).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(403).json({ error: "Invalid signature" });
    return false;
  }

  return true;
};

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "epstein-worker",
    endpoints: ["/health", "/search", "/analyze"],
  });
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP/client to 50 search requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests, please try again later." },
});

app.post("/search", searchLimiter, async (req: Request, res: Response) => {
  if (!verifySignature(req, res)) {
    return;
  }

  const {
    query,
    from = 0,
    size = 100,
  } = req.body as {
    query?: string;
    from?: number;
    size?: number;
  };

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const pool = await getPool();

    // Build the DOJ search URL
    const searchUrl = new URL("https://www.justice.gov/multimedia-search");
    searchUrl.searchParams.set("keys", query);
    searchUrl.searchParams.set("from", from.toString());
    searchUrl.searchParams.set("size", Math.min(size, 100).toString());
    const searchUrlStr = searchUrl.toString();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await pool.context.newPage();
      try {
        // If this is a retry, re-prewarm on the new page to refresh cookies
        if (attempt > 1) {
          await prewarmAkamai(page);
        }

        // Make the API call from WITHIN the page context as an XHR.
        // This carries all Akamai cookies/tokens, matching a real browser flow.
        const result = await page.evaluate(async (url: string) => {
          const resp = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
          });
          if (!resp.ok) {
            const body = await resp.text();
            return {
              error: true as const,
              status: resp.status,
              statusText: resp.statusText,
              body: body.slice(0, 500),
            };
          }
          const json = await resp.json();
          return { error: false as const, data: json };
        }, searchUrlStr);

        if (result.error) {
          throw new Error(
            `DOJ search failed with ${result.status} ${result.statusText}${result.body ? `: ${result.body.slice(0, 300)}` : ""}`,
          );
        }

        res.json(result.data);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        process.stderr.write(`[worker] search attempt ${attempt}/3 failed: ${lastError.message}\n`);
        if (attempt < 3) {
          // Wait longer between retries to let bot-protection settle
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    throw lastError ?? new Error("Unknown error");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
    return;
  }
});

app.post("/analyze", analyzeLimiter, async (req: Request, res: Response) => {
  if (!verifySignature(req, res)) {
    return;
  }

  const { fileUri } = req.body as { fileUri?: string };

  if (!fileUri) {
    res.status(400).json({ error: "fileUri is required" });
    return;
  }

  // SSRF Protection: Only allow justice.gov domains over HTTPS
  // buildSafeJusticeGovUrl reconstructs the URL from validated parts,
  // breaking the user-input taint chain (CodeQL CWE-918).
  let safeUrl: string;
  try {
    safeUrl = buildSafeJusticeGovUrl(fileUri);
  } catch (urlError) {
    const message = urlError instanceof Error ? urlError.message : "Invalid URL";
    let status = 400;
    if (urlError instanceof JusticeGovUrlError && urlError.reason === "UNALLOWED_HOST") {
      // Explicitly mark requests that fail justice.gov host checks as forbidden
      status = 403;
    }
    res.status(status).json({ error: message });
    return;
  }

  try {
    const pool = await getPool();
    const page = await pool.context.newPage();

    try {
      await page.goto(safeUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      if (page.url().includes("/age-verify")) {
        const button = page.getByRole("button", {
          name: /I am 18|I am 18 years|I am 18 years of age/i,
        });

        try {
          await button.click({ timeout: 15000 });
          await page.waitForLoadState("domcontentloaded");
          await page.waitForURL(/\.pdf/i, { timeout: 30000 });
        } catch {
          // If button not found, proceed anyway
        }
      }

      // Download the PDF INSIDE the browser context to retain Akamai
      // session cookies and JS challenge tokens. The previous approach of
      // extracting cookies and using Node.js fetch() lost the JS-based
      // Akamai fingerprint, causing 403 errors.
      const pdfBase64 = await page.evaluate(async (url: string) => {
        const resp = await fetch(url, {
          headers: { Accept: "application/pdf" },
          credentials: "same-origin",
        });
        if (!resp.ok) {
          return {
            error: true as const,
            status: resp.status,
            statusText: resp.statusText,
          };
        }
        const buf = await resp.arrayBuffer();
        // Convert to base64 to transfer binary data out of browser context
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return { error: false as const, data: btoa(binary) };
      }, safeUrl);

      if (pdfBase64.error) {
        throw new Error(`PDF download failed: ${pdfBase64.status} ${pdfBase64.statusText}`);
      }

      const buffer = Buffer.from(pdfBase64.data, "base64");
      const parsed = await pdfParse(buffer);

      res.json({
        text: parsed.text || "",
        pages: parsed.numpages || 0,
        metadata: {
          fileSize: buffer.length,
          extractedAt: new Date().toISOString(),
          info: parsed.info || null,
        },
      });
      return;
    } finally {
      await page.close().catch(() => {});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
    return;
  }
});

// Export app for testing
export { app };

const port = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== "test") {
  // Initialise the browser pool before accepting requests
  initBrowserPool()
    .then(() => {
      app.listen(port, () => {
        process.stdout.write(`PDF worker listening on :${port}\n`);
      });
    })
    .catch((err) => {
      process.stderr.write(
        `[worker] failed to init browser pool: ${err instanceof Error ? err.message : "unknown"}\n`,
      );
      // Start server anyway — pool will init on first request
      app.listen(port, () => {
        process.stdout.write(
          `PDF worker listening on :${port} (pool init failed, will retry on first request)\n`,
        );
      });
    });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    process.stdout.write(`[worker] received ${signal}, shutting down...\n`);
    await destroyBrowserPool();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
