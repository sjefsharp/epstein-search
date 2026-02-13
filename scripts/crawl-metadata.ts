#!/usr/bin/env npx tsx
/**
 * Crawl DOJ Epstein case document metadata via Playwright and upsert into Neon.
 *
 * The DOJ multimedia-search API is protected by Akamai bot detection that
 * blocks plain fetch/curl requests. This script launches Chromium via Playwright
 * in --headless=new mode (indistinguishable from regular Chrome) and makes XHR
 * requests from within the page context to inherit Akamai cookies.
 *
 * Pagination strategy:
 *   The DOJ API returns max 10 results per query and IGNORES the `from` offset.
 *   To discover all ~500+ EFTA-prefixed documents, we use recursive query
 *   subdivision: if a query returns total > hits, we subdivide into narrower
 *   prefixes (e.g., "EFTA01" → "EFTA010", "EFTA011", ...).
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/crawl-metadata.ts
 *
 * Required env vars:
 *   NEON_DATABASE_URL  — Postgres connection string
 *
 * Optional env vars:
 *   PROXY_URL  — HTTP proxy for Chromium (e.g. Webshare rotating proxy)
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import { deduplicateDocuments } from "../src/lib/doj-api";
import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "../src/lib/documents";
import type { DOJDocument, DOJAPIResponse } from "../src/lib/types";

const writeOut = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const writeErr = (message: string) => {
  process.stderr.write(`${message}\n`);
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DELAY_MS = 150; // Delay between requests (be polite)
const MAX_DEPTH = 8; // Max prefix depth (EFTA + 8 digits)
const AKAMAI_SETTLE_MS = 5_000; // Time to let Akamai JS run after page load
const BATCH_UPSERT_SIZE = 50; // Upsert every N new unique docs

// Seed queries beyond EFTA prefix crawl
const EXTRA_QUERIES = [
  "jeffrey epstein",
  "ghislaine maxwell",
  "epstein victim",
  "epstein files",
  "epstein grand jury",
  "epstein flight log",
  "epstein island",
  "epstein deposition",
];

// ---------------------------------------------------------------------------
// Proxy helpers
// ---------------------------------------------------------------------------

interface ProxyParts {
  server: string;
  username?: string;
  password?: string;
}

function parseProxyUrl(raw: string): ProxyParts {
  const url = new URL(raw);
  const server = `${url.protocol}//${url.hostname}:${url.port || "80"}`;
  return {
    server,
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

function maskProxy(raw: string): string {
  return raw.replace(/\/\/[^@]+@/, "//***@");
}

// ---------------------------------------------------------------------------
// Browser-based DOJ search
// ---------------------------------------------------------------------------

async function prewarmAkamai(page: Page): Promise<void> {
  await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,css}", (route) =>
    route.abort(),
  );

  await page.goto("https://www.justice.gov/", {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 300);
  await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 200));
  await page.waitForTimeout(AKAMAI_SETTLE_MS);
}

function transformHit(hit: DOJAPIResponse["hits"]["hits"][0]): DOJDocument {
  const source = hit._source;
  const highlights = hit.highlight?.content || [];
  const content = highlights.length > 0 ? highlights.join(" ... ") : hit._source_content || "";

  return {
    documentId: source.documentId,
    chunkIndex: source.chunkIndex,
    totalChunks: source.totalChunks,
    startPage: source.startPage,
    endPage: source.endPage,
    fileName: source.ORIGIN_FILE_NAME,
    fileUri: source.ORIGIN_FILE_URI,
    fileSize: source.fileSize,
    totalWords: source.totalWords,
    totalCharacters: source.totalCharacters,
    processedAt: source.processedAt,
    content,
    highlights,
    bucket: source.bucket,
    key: source.key,
  };
}

async function browserSearch(
  page: Page,
  query: string,
): Promise<{ total: number; documents: DOJDocument[] }> {
  const url = new URL("https://www.justice.gov/multimedia-search");
  url.searchParams.set("keys", query);
  url.searchParams.set("from", "0");
  url.searchParams.set("size", "100");

  const result = await page.evaluate(async (searchUrl: string) => {
    const resp = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "same-origin",
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { error: true as const, status: resp.status, body: body.slice(0, 500) };
    }
    const json = await resp.json();
    return { error: false as const, data: json };
  }, url.toString());

  if (result.error) {
    throw new Error(`DOJ search failed with ${result.status}: ${result.body?.slice(0, 200)}`);
  }

  const data = result.data as DOJAPIResponse;
  return {
    total: data.hits.total.value,
    documents: data.hits.hits.map(transformHit),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  writeOut("🔍 Starting DOJ metadata crawl (Playwright + recursive queries)...\n");

  const proxyUrl = process.env.PROXY_URL;
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    channel: "chromium",
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  };

  if (proxyUrl) {
    const proxy = parseProxyUrl(proxyUrl);
    launchOptions.proxy = {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    };
    writeOut(`🌐 Proxy enabled: ${maskProxy(proxyUrl)}`);
  } else {
    writeOut("⚠️  No PROXY_URL set — connecting directly");
  }

  const browser = await chromium.launch(launchOptions);
  let context: BrowserContext | null = null;

  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    writeOut("🔑 Prewarming Akamai bot detection...");
    const page = await context.newPage();
    await prewarmAkamai(page);
    writeOut("✅ Akamai prewarm complete\n");

    writeOut("📦 Ensuring documents table exists...");
    await ensureDocumentsTable();

    // -----------------------------------------------------------------------
    // Recursive prefix crawl
    // -----------------------------------------------------------------------

    const allDocs = new Map<string, DOJDocument>();
    let queryCount = 0;
    const pendingUpsert: DOJDocument[] = [];

    async function flushUpsert() {
      if (pendingUpsert.length === 0) return;
      const batch = pendingUpsert.splice(0);
      const count = await upsertDocuments(batch);
      writeOut(`  💾 Upserted batch of ${count} documents (total in DB pending sync)`);
    }

    async function crawlPrefix(prefix: string, depth: number): Promise<void> {
      if (depth > MAX_DEPTH) return;

      try {
        queryCount++;
        const result = await browserSearch(page, prefix);

        // Collect new unique documents
        let newCount = 0;
        for (const doc of result.documents) {
          if (!allDocs.has(doc.documentId)) {
            allDocs.set(doc.documentId, doc);
            pendingUpsert.push(doc);
            newCount++;
          }
        }

        // Progress logging
        if (queryCount % 25 === 0 || newCount > 0) {
          writeOut(
            `  [${queryCount} queries] "${prefix}" → ${result.documents.length}/${result.total} hits, +${newCount} new, ${allDocs.size} total unique`,
          );
        }

        // Batch upsert periodically
        if (pendingUpsert.length >= BATCH_UPSERT_SIZE) {
          await flushUpsert();
        }

        // If API returned fewer than total, subdivide with more specific prefixes
        if (result.total > result.documents.length && depth < MAX_DEPTH) {
          for (const digit of "0123456789") {
            await crawlPrefix(prefix + digit, depth + 1);
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        writeErr(`  ❌ Query "${prefix}" failed: ${msg}`);

        // On 403, re-prewarm (Akamai session may have expired)
        if (msg.includes("403")) {
          writeOut("  🔄 Re-prewarming Akamai...");
          await prewarmAkamai(page);
          await new Promise((r) => setTimeout(r, 2_000));
        }
      }
    }

    // Phase 1: Crawl EFTA prefixes (primary document naming scheme)
    writeOut("\n📂 Phase 1: Crawling EFTA document prefixes...");
    for (const prefix of ["EFTA0", "EFTA1", "EFTA2"]) {
      writeOut(`\n  --- Prefix "${prefix}" ---`);
      await crawlPrefix(prefix, 1);
    }

    // Phase 2: Broader keyword queries for non-EFTA documents
    writeOut("\n📂 Phase 2: Keyword queries for additional documents...");
    for (const query of EXTRA_QUERIES) {
      try {
        queryCount++;
        const result = await browserSearch(page, query);
        let newCount = 0;
        for (const doc of result.documents) {
          if (!allDocs.has(doc.documentId)) {
            allDocs.set(doc.documentId, doc);
            pendingUpsert.push(doc);
            newCount++;
          }
        }
        writeOut(
          `  "${query}": ${result.documents.length} hits, +${newCount} new, ${allDocs.size} total unique`,
        );
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch (err) {
        writeErr(`  ❌ Query "${query}" failed: ${err}`);
      }
    }

    // Final flush
    await flushUpsert();

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------

    const unique = deduplicateDocuments([...allDocs.values()]);
    writeOut(`\n📄 Discovered ${unique.length} unique documents in ${queryCount} queries`);

    const stats = await getDocumentStats();
    writeOut(`📊 Database stats: ${stats.count} documents, last crawl: ${stats.lastCrawl}`);

    writeOut("\n🎉 Crawl complete!");
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  writeErr(`❌ Crawl failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
