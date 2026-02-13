#!/usr/bin/env npx tsx
/**
 * Crawl DOJ document metadata and upsert into Neon Postgres.
 *
 * Usage (with proxy — required when Akamai blocks your IP):
 *   PROXY_URL="http://user:pass@host:port" \
 *   NEON_DATABASE_URL="postgres://..." \
 *   npx tsx scripts/crawl-metadata.ts
 *
 * Usage (without proxy — only works from IPs Akamai doesn't block):
 *   NEON_DATABASE_URL="postgres://..." npx tsx scripts/crawl-metadata.ts
 *
 * This script paginates through the DOJ multimedia-search API, deduplicates
 * results by documentId, and upserts everything into the `documents` table.
 *
 * The DOJ API returns ~10 results per request regardless of size parameter.
 * We increment `from` by the actual count received and cap at MAX_RESULTS
 * to avoid crawling 585K+ generic DOJ results.
 */

import { ProxyAgent, setGlobalDispatcher } from "undici";
import { searchDOJ, deduplicateDocuments } from "../src/lib/doj-api";
import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "../src/lib/documents";
import type { DOJDocument } from "../src/lib/types";

// Set up proxy if PROXY_URL is provided — routes all fetch() calls through it
const proxyUrl = process.env.PROXY_URL;
if (proxyUrl) {
  const agent = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(agent);
  console.log(`🌐 Proxy enabled: ${proxyUrl.replace(/\/\/[^@]+@/, "//***@")}`);
} else {
  console.log("⚠️  No PROXY_URL set — connecting directly (may get 403 from Akamai)");
}

const REQUESTED_SIZE = 100; // What we ask the API for (it may return fewer)
const DELAY_MS = 200;
const MAX_RESULTS = 20_000; // Cap — Epstein case docs are ~2,000 unique; chunks ~15-20K

async function main() {
  console.log("🔍 Starting DOJ metadata crawl...\n");

  // Ensure the documents table exists
  console.log("📦 Ensuring documents table exists...");
  await ensureDocumentsTable();

  // Paginate through results, incrementing by actual docs received
  const allDocuments: DOJDocument[] = [];
  let from = 0;
  let total = Infinity;
  let emptyBatches = 0;

  while (from < total && from < MAX_RESULTS) {
    const batch = await searchDOJ({ query: "epstein", from, size: REQUESTED_SIZE });

    total = batch.total;
    const received = batch.documents.length;

    if (received === 0) {
      emptyBatches++;
      if (emptyBatches >= 3) {
        console.log("  ⚠ 3 consecutive empty batches — stopping pagination");
        break;
      }
      from += REQUESTED_SIZE; // skip ahead if empty
      continue;
    }

    emptyBatches = 0;
    allDocuments.push(...batch.documents);

    // Increment by actual received count (DOJ API often returns <size)
    const step = Math.max(received, 10);
    from += step;

    // Progress update every 50 batches
    if (allDocuments.length % 500 < step) {
      const uniqueSoFar = new Set(allDocuments.map((d) => d.documentId)).size;
      console.log(
        `  📈 Progress: ${allDocuments.length} chunks fetched, ~${uniqueSoFar} unique, offset=${from}/${Math.min(total, MAX_RESULTS)}`,
      );
    }

    if (from < total && from < MAX_RESULTS) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  if (from >= MAX_RESULTS) {
    console.log(`\n  ⚠ Reached MAX_RESULTS cap (${MAX_RESULTS}). Stopping.`);
  }

  // Deduplicate by documentId
  const unique = deduplicateDocuments(allDocuments);
  console.log(`\n📄 Fetched ${allDocuments.length} chunks → ${unique.length} unique documents`);

  // Upsert into Neon
  console.log("💾 Upserting into Neon Postgres...");
  const upserted = await upsertDocuments(unique);
  console.log(`✅ Upserted ${upserted} documents`);

  // Print stats
  const stats = await getDocumentStats();
  console.log(`\n📊 Database stats: ${stats.count} documents, last crawl: ${stats.lastCrawl}`);

  console.log("\n🎉 Crawl complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Crawl failed:", err);
  process.exit(1);
});
