#!/usr/bin/env npx tsx
/**
 * Crawl DOJ document metadata and upsert into Neon Postgres.
 *
 * Run locally (residential IP avoids Akamai blocks):
 *   NEON_DATABASE_URL="postgres://..." npx tsx scripts/crawl-metadata.ts
 *
 * This script paginates through the DOJ multimedia-search API, deduplicates
 * results by documentId, and upserts everything into the `documents` table.
 * Estimated runtime: ~1 minute for ~2,000 documents.
 */

import { searchDOJ, deduplicateDocuments } from "../src/lib/doj-api";
import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "../src/lib/documents";
import type { DOJDocument } from "../src/lib/types";

const BATCH_SIZE = 100;
const DELAY_MS = 200;

async function main() {
  console.log("🔍 Starting DOJ metadata crawl...\n");

  // Ensure the documents table exists
  console.log("📦 Ensuring documents table exists...");
  await ensureDocumentsTable();

  // Paginate through all results
  const allDocuments: DOJDocument[] = [];
  let from = 0;
  let total = Infinity;

  while (from < total) {
    console.log(`  Fetching batch from=${from}, size=${BATCH_SIZE}...`);
    const batch = await searchDOJ({ query: "epstein", from, size: BATCH_SIZE });

    total = batch.total;
    allDocuments.push(...batch.documents);
    console.log(`  Got ${batch.documents.length} chunks (total: ${total})`);

    from += BATCH_SIZE;

    if (from < total) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
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
