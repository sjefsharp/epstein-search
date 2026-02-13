// API Route: Cron-triggered refresh of the Neon document metadata cache.
// Calls the Render worker (Playwright) to paginate through DOJ search results,
// then upserts all discovered documents into the Neon database.
// The worker bypasses Akamai bot protection, which blocks direct server-side fetch.
import { NextRequest, NextResponse } from "next/server";
import { deduplicateDocuments, transformDOJHits } from "@/lib/doj-api";
import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "@/lib/documents";
import {
  enforceHttps,
  generateWorkerSignature,
  getWorkerSecret,
  sanitizeError,
} from "@/lib/security";
import { resolveWorkerUrl } from "@/lib/worker-url";
import { withJsonErrorHandling } from "@/lib/api-handler";
import type { DOJAPIResponse } from "@/lib/types";

export const runtime = "nodejs";

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
 * Call the worker /refresh endpoint to paginate through all DOJ search results
 * via Playwright (bypasses Akamai). Then transform + deduplicate + upsert into Neon.
 */
async function refreshViaWorker(): Promise<{
  ok: boolean;
  upserted: number;
  total: number;
  batches: number;
  error?: string;
}> {
  await ensureDocumentsTable();

  const workerUrl = resolveWorkerUrl("http://localhost:10000");
  if (!workerUrl) {
    return { ok: false, upserted: 0, total: 0, batches: 0, error: "Worker URL not configured" };
  }

  if (process.env.NODE_ENV === "production") {
    enforceHttps(workerUrl);
  }

  const workerSecret = getWorkerSecret();
  const payload = JSON.stringify({ query: "epstein", batchSize: 100 });
  const signature = generateWorkerSignature(payload, workerSecret);

  const response = await fetch(`${workerUrl}/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Signature": signature,
      Authorization: `Bearer ${signature}`,
    },
    body: payload,
    // Allow up to 5 minutes for full crawl (500+ documents with pagination delays)
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errorJson = (await response.json()) as { error?: string };
      detail = errorJson?.error ? ` — ${errorJson.error}` : "";
    } catch {
      detail = "";
    }
    return {
      ok: false,
      upserted: 0,
      total: 0,
      batches: 0,
      error: `Worker returned ${response.status}${detail}`,
    };
  }

  const data = (await response.json()) as {
    total: number;
    documents: DOJAPIResponse["hits"]["hits"];
    batches: number;
    error?: string;
  };

  if (!data.documents || data.documents.length === 0) {
    return {
      ok: false,
      upserted: 0,
      total: data.total ?? 0,
      batches: data.batches ?? 0,
      error: data.error ?? "No documents returned from worker",
    };
  }

  // Transform raw DOJ hits into our document format
  const apiResponse: DOJAPIResponse = {
    hits: {
      total: { value: data.total },
      hits: data.documents,
    },
  };
  const documents = transformDOJHits(apiResponse);
  const unique = deduplicateDocuments(documents);
  const upserted = await upsertDocuments(unique);

  process.stdout.write(
    `[refresh-docs] Worker returned ${data.total} hits in ${data.batches} batches, upserted ${upserted} unique documents\n`,
  );

  return {
    ok: true,
    upserted,
    total: unique.length,
    batches: data.batches,
    error: data.error,
  };
}

export const POST = withJsonErrorHandling(
  async (request: NextRequest) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await refreshViaWorker();
    const stats = await getDocumentStats();

    return NextResponse.json({
      ...result,
      stats,
      timestamp: new Date().toISOString(),
    });
  },
  {
    routeName: "Refresh docs POST",
    buildErrorBody: (error) => ({
      error: "Refresh docs failed",
      details: sanitizeError(error, process.env.NODE_ENV === "development"),
    }),
  },
);

export const GET = withJsonErrorHandling(
  async (request: NextRequest) => {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await refreshViaWorker();
    const stats = await getDocumentStats();

    return NextResponse.json({
      ...result,
      stats,
      timestamp: new Date().toISOString(),
    });
  },
  {
    routeName: "Refresh docs GET",
    buildErrorBody: (error) => ({
      error: "Refresh docs failed",
      details: sanitizeError(error, process.env.NODE_ENV === "development"),
    }),
  },
);
