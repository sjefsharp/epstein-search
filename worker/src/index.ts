import express from "express";
import type { Request, Response } from "express";
import * as pdfParseModule from "pdf-parse";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { requireWorkerSignature } from "./auth";
import { createAnalyzeHandler, createRefreshHandler, createSearchHandler } from "./routes";
import { destroyBrowserPool, getLastPrewarm, initBrowserPool } from "./browser-pool";
export {
  buildAkamaiDelayMs,
  buildFingerprint,
  getStealthContextOptions,
  getStealthLaunchOptions,
  isProxyEnabled,
  parseProxyUrl,
  pickRandom,
  PREWARM_WAIT_UNTIL,
  STEALTH_USER_AGENT,
} from "./stealth";
export type { ParsedProxy, StealthFingerprint } from "./stealth";
export {
  computeWorkerSignature,
  extractWorkerSignature,
  requireWorkerSignature,
  verifyWorkerSignature,
} from "./auth";
export {
  destroyBrowserPool,
  getLastPrewarm,
  getPool,
  getPrewarmIntervalMs,
  initBrowserPool,
  prewarmAkamai,
} from "./browser-pool";
export { buildSafeJusticeGovUrl, isAllowedJusticeGovHost, JusticeGovUrlError } from "./ssrf";

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

app.get("/health", (_req: Request, res: Response) => {
  const lastPrewarm = getLastPrewarm();
  res.json({
    status: "ok",
    lastPrewarm: lastPrewarm ? new Date(lastPrewarm).toISOString() : null,
    prewarmAgeMs: lastPrewarm ? Date.now() - lastPrewarm : null,
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "epstein-worker",
    endpoints: ["/health", "/search", "/analyze", "/refresh"],
  });
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP/client to 50 search requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests, please try again later." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP/client to 10 refresh requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh requests, please try again later." },
});

app.post("/search", searchLimiter, requireWorkerSignature, createSearchHandler());

app.post("/analyze", analyzeLimiter, requireWorkerSignature, createAnalyzeHandler(pdfParse));

app.post("/refresh", refreshLimiter, requireWorkerSignature, createRefreshHandler());

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
