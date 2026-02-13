import { getCacheKey, deduplicateDocuments, transformDOJHits } from "@/lib/doj-api";
import { getCachedSearch, setCachedSearch, trackCacheEvent } from "@/lib/cache";
import { searchDocumentsLocal } from "@/lib/documents";
import { enforceHttps, generateWorkerSignature, getWorkerSecret } from "@/lib/security";
import { resolveWorkerUrl } from "@/lib/worker-url";
import type { DOJAPIResponse } from "@/lib/types";

const EPSTEIN_REGEX = /\bepstein\b/i;
const DOJ_SEARCH_URL = "https://www.justice.gov/multimedia-search";

export const ensureEpsteinQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  if (EPSTEIN_REGEX.test(trimmed)) return trimmed;
  return `epstein ${trimmed}`;
};

async function fetchDOJDirect(
  query: string,
  from: number,
  size: number,
): Promise<DOJAPIResponse | null> {
  const url = new URL(DOJ_SEARCH_URL);
  url.searchParams.set("keys", query);
  url.searchParams.set("from", from.toString());
  url.searchParams.set("size", Math.min(size, 100).toString());

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.justice.gov/",
        Origin: "https://www.justice.gov",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 403 || response.status === 429) {
      process.stderr.write(
        `[search] Direct DOJ fetch blocked (${response.status}), falling back to worker\n`,
      );
      return null;
    }

    if (!response.ok) {
      process.stderr.write(
        `[search] Direct DOJ fetch failed (${response.status}), falling back to worker\n`,
      );
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      process.stderr.write(
        "[search] Direct DOJ returned non-JSON (likely Akamai challenge), falling back to worker\n",
      );
      return null;
    }

    const data: DOJAPIResponse = await response.json();

    if (!data?.hits?.hits) {
      process.stderr.write(
        "[search] Direct DOJ returned unexpected shape, falling back to worker\n",
      );
      return null;
    }

    return data;
  } catch (error) {
    process.stderr.write(
      `[search] Direct DOJ fetch error: ${
        error instanceof Error ? error.message : "unknown"
      }, falling back to worker\n`,
    );
    return null;
  }
}

async function fetchViaWorker(query: string, from: number, size: number): Promise<DOJAPIResponse> {
  const workerUrl = resolveWorkerUrl("http://localhost:10000");
  if (!workerUrl) {
    throw new Error("Worker URL not configured");
  }

  if (process.env.NODE_ENV === "production") {
    enforceHttps(workerUrl);
  }

  const workerSecret = getWorkerSecret();
  const payload = JSON.stringify({ query, from, size });
  const signature = generateWorkerSignature(payload, workerSecret);

  const workerResponse = await fetch(`${workerUrl}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Signature": signature,
      Authorization: `Bearer ${signature}`,
    },
    body: payload,
    signal: AbortSignal.timeout(55000),
  });

  if (!workerResponse.ok) {
    let workerErrorDetail = "";
    try {
      const ct = workerResponse.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const errorJson = (await workerResponse.json()) as { error?: string };
        workerErrorDetail = errorJson?.error ? ` - ${errorJson.error}` : "";
      } else {
        const errorText = await workerResponse.text();
        workerErrorDetail = errorText ? ` - ${errorText.slice(0, 300)}` : "";
      }
    } catch {
      workerErrorDetail = "";
    }

    throw new Error(
      `Worker returned ${workerResponse.status}: ${workerResponse.statusText}${workerErrorDetail}`,
    );
  }

  return workerResponse.json();
}

export async function executeSearch(
  query: string,
  effectiveQuery: string,
  from: number,
  size: number,
) {
  const cacheKey = getCacheKey(query, from);
  const cached = await getCachedSearch(cacheKey);

  if (cached) {
    await trackCacheEvent("hit");
    return { data: { ...cached, cached: true }, fromCache: true };
  }

  await trackCacheEvent("miss");

  const localResults = await searchDocumentsLocal(effectiveQuery, from, size);
  if (localResults && localResults.documents.length > 0) {
    process.stdout.write(
      `[search] Serving from Neon cache (${localResults.documents.length} docs)\n`,
    );
    const uniqueDocuments = deduplicateDocuments(localResults.documents);
    const deduplicatedResults = {
      ...localResults,
      searchTerm: query,
      documents: uniqueDocuments,
      uniqueCount: uniqueDocuments.length,
    };
    await setCachedSearch(cacheKey, deduplicatedResults);
    return { data: { ...deduplicatedResults, cached: false, source: "neon" }, fromCache: false };
  }

  let apiData = await fetchDOJDirect(effectiveQuery, from, size);

  if (!apiData) {
    process.stdout.write(`[search] Using worker fallback for query: ${effectiveQuery}\n`);
    apiData = await fetchViaWorker(effectiveQuery, from, size);
  }

  const documents = transformDOJHits(apiData);

  const results = {
    total: apiData.hits.total.value,
    documents,
    searchTerm: query,
    from,
    size,
  };

  const uniqueDocuments = deduplicateDocuments(results.documents);
  const deduplicatedResults = {
    ...results,
    documents: uniqueDocuments,
    uniqueCount: uniqueDocuments.length,
  };

  await setCachedSearch(cacheKey, deduplicatedResults);

  return { data: { ...deduplicatedResults, cached: false }, fromCache: false };
}
