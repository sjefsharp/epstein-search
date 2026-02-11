// API Route: Cron-triggered refresh of the Neon document metadata cache.
// Attempts a direct DOJ API fetch. If blocked (403), logs and skips — cached data stays valid.
import { NextRequest, NextResponse } from "next/server";
import { searchDOJ, deduplicateDocuments } from "@/lib/doj-api";
import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "@/lib/documents";
import type { DOJDocument } from "@/lib/types";

export const runtime = "nodejs";

const BATCH_SIZE = 100;
const DELAY_MS = 200;

/**
 * Auth check — same pattern as consent/cleanup.
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (cronSecret && provided === cronSecret) return true;
  if (vercelCron === "1") return true;
  return false;
}

/**
 * Paginate through DOJ API and upsert all document metadata into Neon.
 * Returns stats on success, or an error message if DOJ is blocked.
 */
async function refreshDocuments(): Promise<{
  ok: boolean;
  upserted: number;
  total: number;
  error?: string;
}> {
  await ensureDocumentsTable();

  const allDocuments: DOJDocument[] = [];
  let from = 0;
  let total = Infinity;

  try {
    while (from < total) {
      const batch = await searchDOJ({ query: "epstein", from, size: BATCH_SIZE });
      total = batch.total;
      allDocuments.push(...batch.documents);
      from += BATCH_SIZE;

      if (from < total) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // If DOJ is blocked, report but don't fail — cached data is still valid
    process.stderr.write(`[refresh-docs] DOJ fetch stopped: ${message}\n`);

    if (allDocuments.length === 0) {
      return { ok: false, upserted: 0, total: 0, error: message };
    }
    // Partial success — upsert what we got
    process.stdout.write(
      `[refresh-docs] Partial fetch: ${allDocuments.length} chunks before error\n`,
    );
  }

  const unique = deduplicateDocuments(allDocuments);
  const upserted = await upsertDocuments(unique);

  return { ok: true, upserted, total: unique.length };
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshDocuments();
  const stats = await getDocumentStats();

  return NextResponse.json({
    ...result,
    stats,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshDocuments();
  const stats = await getDocumentStats();

  return NextResponse.json({
    ...result,
    stats,
    timestamp: new Date().toISOString(),
  });
}
