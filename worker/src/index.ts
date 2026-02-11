import express from "express";
import type { Express, Request, Response } from "express";
import { chromium, type BrowserContextOptions, type LaunchOptions, type Page } from "playwright";
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

/**
 * Structured error type for justice.gov URL validation failures.
 * This lets callers distinguish between "forbidden host" and
 * generic bad-input errors without relying on substring checks.
 */
class JusticeGovUrlError extends Error {
  public readonly reason: "UNALLOWED_HOST" | "INVALID_URL" | "OTHER";

  constructor(message: string, reason: "UNALLOWED_HOST" | "INVALID_URL" | "OTHER" = "OTHER") {
    super(message);
    this.name = "JusticeGovUrlError";
    this.reason = reason;
  }
}

export const STEALTH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
export const PREWARM_WAIT_UNTIL = "domcontentloaded" as const;
const STEALTH_HEADERS = {
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
} as const;
const STEALTH_VIEWPORT = { width: 1920, height: 1080 } as const;
const STEALTH_LOCALE = "en-US";
const STEALTH_TIMEZONE = "America/New_York";
const STEALTH_LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
] as const;

export const buildAkamaiDelayMs = (): number => 2000 + Math.floor(Math.random() * 2000);

export const getStealthLaunchOptions = (): LaunchOptions => ({
  headless: true,
  args: [...STEALTH_LAUNCH_ARGS],
});

export const getStealthContextOptions = (): BrowserContextOptions => ({
  userAgent: STEALTH_USER_AGENT,
  extraHTTPHeaders: STEALTH_HEADERS,
  viewport: STEALTH_VIEWPORT,
  locale: STEALTH_LOCALE,
  timezoneId: STEALTH_TIMEZONE,
});

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
 * Validate and reconstruct a URL from its components to prevent SSRF.
 * Breaks the taint chain by building the URL from validated host + path
 * rather than passing the user-supplied string through directly.
 * Strips any embedded credentials.
 */
export function buildSafeJusticeGovUrl(input: string): string {
  const parsed = new URL(input);

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  if (!isAllowedJusticeGovHost(parsed.hostname)) {
    throw new Error("Only justice.gov hosts are allowed");
  }

  // Reconstruct from validated parts — no user-controlled string passes through
  const safe = new URL(`https://${parsed.hostname}`);
  safe.pathname = parsed.pathname;
  safe.search = parsed.search;
  safe.hash = parsed.hash;
  // Credentials intentionally omitted
  return safe.toString();
}

type LaunchedBrowser = Awaited<ReturnType<typeof chromium.launch>>;

const createStealthContext = async (browser: LaunchedBrowser) => {
  const context = await browser.newContext(getStealthContextOptions());
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });
  return context;
};

const prewarmAkamai = async (page: Page) => {
  await page.goto("https://www.justice.gov/", {
    waitUntil: PREWARM_WAIT_UNTIL,
    timeout: 30000,
  });

  await page.waitForTimeout(buildAkamaiDelayMs());
};

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

const pdfParse =
  (pdfParseModule as unknown as { default?: PdfParseFn }).default ??
  (pdfParseModule as unknown as PdfParseFn);

const app = express();

export const applyTrustProxy = (target: Pick<Express, "set">) => {
  target.set("trust proxy", 1);
};

applyTrustProxy(app);

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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch(getStealthLaunchOptions());
    const context = await createStealthContext(browser);

    // Build the DOJ search URL
    const searchUrl = new URL("https://www.justice.gov/multimedia-search");
    searchUrl.searchParams.set("keys", query);
    searchUrl.searchParams.set("from", from.toString());
    searchUrl.searchParams.set("size", Math.min(size, 100).toString());
    const searchUrlStr = searchUrl.toString();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await context.newPage();
      try {
        // Step 1: Visit the DOJ homepage to acquire Akamai session cookies
        await prewarmAkamai(page);

        // Step 2: Make the API call from WITHIN the page context as an XHR.
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
  } finally {
    if (browser) {
      await browser.close();
    }
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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch(getStealthLaunchOptions());
    const context = await createStealthContext(browser);
    const page = await context.newPage();

    await prewarmAkamai(page);
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
        // If button not found, proceed with cookies anyway
      }
    }

    const cookies = (await context.cookies()) as Array<{
      name: string;
      value: string;
    }>;
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

    const pdfResponse = await fetch(safeUrl, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent": STEALTH_USER_AGENT,
        Accept: "application/pdf",
      },
      redirect: "manual", // Prevent redirect-based SSRF to internal hosts
    });

    if (!pdfResponse.ok) {
      throw new Error(`PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const buffer = Buffer.from(await pdfResponse.arrayBuffer());
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
    return;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const port = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    process.stdout.write(`PDF worker listening on :${port}\n`);
  });
}
