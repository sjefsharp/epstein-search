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
const express_1 = __importDefault(require("express"));
const playwright_1 = require("playwright");
const pdfParseModule = __importStar(require("pdf-parse"));
// Handle both ESM and CommonJS imports for pdf-parse
const pdfParse = pdfParseModule.default || pdfParseModule;
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: "2mb" }));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.post("/search", async (req, res) => {
    const { query, from = 0, size = 100 } = req.body;
    if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
    }
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        });
        const page = await context.newPage();
        // Build the DOJ search URL
        const searchUrl = new URL("https://www.justice.gov/multimedia-search");
        searchUrl.searchParams.set("keys", query);
        searchUrl.searchParams.set("from", from.toString());
        searchUrl.searchParams.set("size", Math.min(size, 100).toString());
        // Navigate to the search page with the browser
        await page.goto(searchUrl.toString(), {
            waitUntil: "networkidle",
            timeout: 30000,
        });
        // Wait for the search results to load
        await page.waitForTimeout(2000);
        // Extract the JSON response from the page or API call
        const apiData = await page.evaluate(async (url) => {
            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
            });
            return await response.json();
        }, searchUrl.toString());
        res.json(apiData);
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
app.post("/analyze", async (req, res) => {
    const { fileUri } = req.body;
    if (!fileUri) {
        res.status(400).json({ error: "fileUri is required" });
        return;
    }
    let browser = null;
    try {
        browser = await playwright_1.chromium.launch({ headless: true });
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
            }
            catch {
                // If button not found, proceed with cookies anyway
            }
        }
        const cookies = (await context.cookies());
        const cookieHeader = cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join("; ");
        const pdfResponse = await fetch(fileUri, {
            headers: {
                Cookie: cookieHeader,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
app.listen(port, () => {
    console.log(`PDF worker listening on :${port}`);
});
