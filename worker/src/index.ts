import express from "express";
import type { Request, Response } from "express";
import { chromium } from "playwright";
import * as pdfParseModule from "pdf-parse";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

// Handle both ESM and CommonJS imports for pdf-parse
type PdfParseResult = {
  text: string;
  numpages: number;
  info?: unknown;
};

function isIpAddress(hostname: string): boolean {
  // Simple IPv4 and IPv6 detection; adjust if needed
  const ipv4Pattern =
    /^(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+$/;
  return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
}

function isAllowedJusticeGovHost(hostname: string): boolean {
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

  return (
    lowerHost === "justice.gov" ||
    lowerHost.endsWith(".justice.gov")
  );
}

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

const pdfParse =
  (pdfParseModule as unknown as { default?: PdfParseFn }).default ??
  (pdfParseModule as unknown as PdfParseFn);

const app = express();

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 analyze requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
type LoggingMiddleware = (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
) => void;

app.use(helmet());
app.use(((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[worker] ${req.method} ${req.url} -> ${res.statusCode} (${durationMs}ms)`,
    );
  });
  next();
}) as LoggingMiddleware);
app.use(
  cors({
    origin:
      process.env.ALLOWED_ORIGINS?.split(",") ||
      "https://epstein-kappa.vercel.app",
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
    console.error("WORKER_SHARED_SECRET not configured");
    res.status(500).json({ error: "Server misconfigured" });
    return false;
  }

  if (!signature) {
    res.status(401).json({ error: "Missing authentication signature" });
    return false;
  }

  const payload = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", sharedSecret)
    .update(payload)
    .digest("hex");

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

app.post("/search", async (req: Request, res: Response) => {
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
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

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
        await page.goto("https://www.justice.gov/", {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        // Let Akamai challenge scripts complete
        await page.waitForTimeout(2000);

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
        console.error(
          `[worker] search attempt ${attempt}/3 failed: ${lastError.message}`,
        );
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
  let safeUrl: string;
  try {
    const url = new URL(fileUri);
    if (url.protocol !== "https:") {
      res.status(400).json({ error: "Only HTTPS URLs are allowed" });
      return;
    }
    const hostname = url.hostname;
    if (!isAllowedJusticeGovHost(hostname)) {
      res
        .status(403)
        .json({ error: "Only public justice.gov HTTPS URLs are allowed" });
      return;
    }
    // Use the normalized, validated URL for all outbound requests
    safeUrl = url.toString();
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

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
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const pdfResponse = await fetch(safeUrl, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Epstein-Onderzoek-Bot/1.0 (DOJ Document Research; +https://epstein-kappa.vercel.app)",
        Accept: "application/pdf",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(
        `PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`,
      );
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
app.listen(port, () => {
  console.log(`PDF worker listening on :${port}`);
});
