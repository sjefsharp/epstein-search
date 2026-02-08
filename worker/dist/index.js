"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStealthContextOptions = exports.getStealthLaunchOptions = exports.buildAkamaiDelayMs = exports.STEALTH_USER_AGENT = void 0;
exports.isAllowedJusticeGovHost = isAllowedJusticeGovHost;
const express_1 = __importDefault(require("express"));
const playwright_1 = require("playwright");
const pdfParseModule = __importStar(require("pdf-parse"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const net_1 = __importDefault(require("net"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.STEALTH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STEALTH_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
};
const STEALTH_VIEWPORT = { width: 1920, height: 1080 };
const STEALTH_LOCALE = "en-US";
const STEALTH_TIMEZONE = "America/New_York";
const STEALTH_LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-dev-shm-usage",
];
const buildAkamaiDelayMs = () => 2000 + Math.floor(Math.random() * 2000);
exports.buildAkamaiDelayMs = buildAkamaiDelayMs;
const getStealthLaunchOptions = () => ({
    headless: true,
    args: [...STEALTH_LAUNCH_ARGS],
});
exports.getStealthLaunchOptions = getStealthLaunchOptions;
const getStealthContextOptions = () => ({
    userAgent: exports.STEALTH_USER_AGENT,
    extraHTTPHeaders: STEALTH_HEADERS,
    viewport: STEALTH_VIEWPORT,
    locale: STEALTH_LOCALE,
    timezoneId: STEALTH_TIMEZONE,
});
exports.getStealthContextOptions = getStealthContextOptions;
function isIpAddress(hostname) {
    return net_1.default.isIP(hostname) !== 0;
}
function isAllowedJusticeGovHost(hostname) {
    const lowerHost = hostname.toLowerCase();
    // Explicitly block localhost-style names even if they somehow appear under justice.gov
    if (lowerHost === "localhost" ||
        lowerHost === "127.0.0.1" ||
        lowerHost === "::1" ||
        lowerHost.endsWith(".localhost")) {
        return false;
    }
    if (isIpAddress(lowerHost)) {
        return false;
    }
    return lowerHost === "justice.gov" || lowerHost.endsWith(".justice.gov");
}
const createStealthContext = async (browser) => {
    const context = await browser.newContext((0, exports.getStealthContextOptions)());
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
            get: () => undefined,
        });
    });
    return context;
};
const prewarmAkamai = async (page) => {
    await page.goto("https://www.justice.gov/", {
        waitUntil: "networkidle",
        timeout: 30000,
    });
    await page.waitForTimeout((0, exports.buildAkamaiDelayMs)());
};
const pdfParse = pdfParseModule.default ??
    pdfParseModule;
const app = (0, express_1.default)();
const analyzeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // limit each IP to 60 analyze requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use((0, helmet_1.default)());
app.use(((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
        const durationMs = Date.now() - startedAt;
        const safeUrl = (req.url || "").replace(/[\r\n]/g, "");
        console.log(`[worker] ${req.method} ${safeUrl} -> ${res.statusCode} (${durationMs}ms)`);
    });
    next();
}));
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "https://epstein-kappa.vercel.app",
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type", "X-Worker-Signature", "Authorization"],
}));
app.use(express_1.default.json({ limit: "2mb" }));
// Authentication helper
const verifySignature = (req, res) => {
    const signatureHeader = req.headers["x-worker-signature"];
    const authHeader = req.headers["authorization"];
    const signatureFromHeader = typeof signatureHeader === "string"
        ? signatureHeader
        : Array.isArray(signatureHeader)
            ? signatureHeader[0]
            : undefined;
    const authValue = typeof authHeader === "string"
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
    const expected = crypto_1.default.createHmac("sha256", sharedSecret).update(payload).digest("hex");
    if (!crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        res.status(403).json({ error: "Invalid signature" });
        return false;
    }
    return true;
};
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "epstein-worker",
        endpoints: ["/health", "/search", "/analyze"],
    });
});
const searchLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP/client to 50 search requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many search requests, please try again later." },
});
app.post("/search", searchLimiter, async (req, res) => {
    if (!verifySignature(req, res)) {
        return;
    }
    const { query, from = 0, size = 100, } = req.body;
    if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
    }
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch((0, exports.getStealthLaunchOptions)());
        const context = await createStealthContext(browser);
        // Build the DOJ search URL
        const searchUrl = new URL("https://www.justice.gov/multimedia-search");
        searchUrl.searchParams.set("keys", query);
        searchUrl.searchParams.set("from", from.toString());
        searchUrl.searchParams.set("size", Math.min(size, 100).toString());
        const searchUrlStr = searchUrl.toString();
        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const page = await context.newPage();
            try {
                // Step 1: Visit the DOJ homepage to acquire Akamai session cookies
                await prewarmAkamai(page);
                // Step 2: Make the API call from WITHIN the page context as an XHR.
                // This carries all Akamai cookies/tokens, matching a real browser flow.
                const result = await page.evaluate(async (url) => {
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
                            error: true,
                            status: resp.status,
                            statusText: resp.statusText,
                            body: body.slice(0, 500),
                        };
                    }
                    const json = await resp.json();
                    return { error: false, data: json };
                }, searchUrlStr);
                if (result.error) {
                    throw new Error(`DOJ search failed with ${result.status} ${result.statusText}${result.body ? `: ${result.body.slice(0, 300)}` : ""}`);
                }
                res.json(result.data);
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown error");
                console.error(`[worker] search attempt ${attempt}/3 failed: ${lastError.message}`);
                if (attempt < 3) {
                    // Wait longer between retries to let bot-protection settle
                    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
                }
            }
            finally {
                await page.close().catch(() => { });
            }
        }
        throw lastError ?? new Error("Unknown error");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
        return;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
});
app.post("/analyze", analyzeLimiter, async (req, res) => {
    if (!verifySignature(req, res)) {
        return;
    }
    const { fileUri } = req.body;
    if (!fileUri) {
        res.status(400).json({ error: "fileUri is required" });
        return;
    }
    // SSRF Protection: Only allow justice.gov domains over HTTPS
    let safeUrl;
    try {
        const url = new URL(fileUri);
        if (url.protocol !== "https:") {
            res.status(400).json({ error: "Only HTTPS URLs are allowed" });
            return;
        }
        const hostname = url.hostname;
        if (!isAllowedJusticeGovHost(hostname)) {
            res.status(403).json({ error: "Only public justice.gov HTTPS URLs are allowed" });
            return;
        }
        // Use the normalized, validated URL for all outbound requests
        safeUrl = url.toString();
    }
    catch {
        res.status(400).json({ error: "Invalid URL" });
        return;
    }
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch((0, exports.getStealthLaunchOptions)());
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
            }
            catch {
                // If button not found, proceed with cookies anyway
            }
        }
        const cookies = (await context.cookies());
        const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
        const pdfResponse = await fetch(safeUrl, {
            headers: {
                Cookie: cookieHeader,
                "User-Agent": exports.STEALTH_USER_AGENT,
                Accept: "application/pdf",
            },
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
        return;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
});
const port = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => {
        console.log(`PDF worker listening on :${port}`);
    });
}
