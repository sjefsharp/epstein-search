import express from "express";
import type { Request, Response } from "express";
import { chromium } from "playwright";
import * as pdfParseModule from "pdf-parse";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";

// Handle both ESM and CommonJS imports for pdf-parse
type PdfParseResult = {
  text: string;
  numpages: number;
  info?: unknown;
};

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

const pdfParse =
  (pdfParseModule as unknown as { default?: PdfParseFn }).default ??
  (pdfParseModule as unknown as PdfParseFn);

const app = express();

// Security middleware
app.use(helmet());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[worker] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
    );
  });
  next();
});
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
        "Epstein-Onderzoek-Bot/1.0 (DOJ Document Research; +https://epstein-kappa.vercel.app)",
    });

    // Build the DOJ search URL
    const searchUrl = new URL("https://www.justice.gov/multimedia-search");
    searchUrl.searchParams.set("keys", query);
    searchUrl.searchParams.set("from", from.toString());
    searchUrl.searchParams.set("size", Math.min(size, 100).toString());

    const headers = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    } as const;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await context.request.get(searchUrl.toString(), {
          headers,
          timeout: 20000,
        });

        const status = response.status();
        const contentType = response.headers()["content-type"] || "";

        if (!response.ok()) {
          const bodyText = await response.text();
          throw new Error(
            `DOJ search failed with ${status} ${response.statusText()}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`,
          );
        }

        if (!contentType.includes("application/json")) {
          const bodyText = await response.text();
          throw new Error(
            `Unexpected response content-type (${contentType || "unknown"})${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`,
          );
        }

        const apiData = await response.json();
        res.json(apiData);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
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

app.post("/analyze", async (req: Request, res: Response) => {
  if (!verifySignature(req, res)) {
    return;
  }

  const { fileUri } = req.body as { fileUri?: string };

  if (!fileUri) {
    res.status(400).json({ error: "fileUri is required" });
    return;
  }

  // SSRF Protection: Only allow justice.gov domains
  try {
    const url = new URL(fileUri);
    if (
      !url.hostname.endsWith(".justice.gov") &&
      url.hostname !== "justice.gov"
    ) {
      res.status(403).json({ error: "Only justice.gov URLs are allowed" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(fileUri, { waitUntil: "domcontentloaded", timeout: 60000 });

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

    const pdfResponse = await fetch(fileUri, {
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
