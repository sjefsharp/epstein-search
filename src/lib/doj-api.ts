// DOJ API integration for searching Epstein files
// Based on the existing Python scraping logic

import {
  DOJSearchParams,
  DOJSearchResponse,
  DOJDocument,
  DOJAPIResponse,
} from "./types";

const DOJ_API_URL = "https://www.justice.gov/multimedia-search";

export class DOJAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "DOJAPIError";
  }
}

/**
 * Search DOJ Epstein files via their multimedia search API
 */
export async function searchDOJ(
  params: DOJSearchParams,
): Promise<DOJSearchResponse> {
  const { query, from = 0, size = 100 } = params;

  if (!query || query.trim().length === 0) {
    throw new DOJAPIError("Search query cannot be empty");
  }

  const url = new URL(DOJ_API_URL);
  url.searchParams.set("keys", query.trim());
  url.searchParams.set("from", from.toString());
  url.searchParams.set("size", Math.min(size, 100).toString()); // Max 100 per request

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.justice.gov/",
        Origin: "https://www.justice.gov",
        "X-Requested-With": "XMLHttpRequest",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    });

    if (!response.ok) {
      throw new DOJAPIError(
        `DOJ API returned ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    const data: DOJAPIResponse = await response.json();

    // Transform API response to our internal format
    const documents: DOJDocument[] = data.hits.hits.map((hit) => {
      const source = hit._source;

      // Extract content from highlight (preferred) or raw content
      const highlights = hit.highlight?.content || [];
      const content =
        highlights.length > 0
          ? highlights.join(" ... ")
          : hit._source_content || "";

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
        content: content,
        highlights: highlights,
        bucket: source.bucket,
        key: source.key,
      };
    });

    return {
      total: data.hits.total.value,
      documents,
      searchTerm: query,
      from,
      size,
    };
  } catch (error) {
    if (error instanceof DOJAPIError) {
      throw error;
    }
    throw new DOJAPIError(
      `Failed to search DOJ API: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Fetch all results for a query by paginating through the API
 * WARNING: Can be slow for large result sets. Use with caution.
 */
export async function searchDOJAll(query: string): Promise<DOJDocument[]> {
  const allDocuments: DOJDocument[] = [];
  let from = 0;
  const size = 100;

  // Fetch first batch to get total count
  const firstBatch = await searchDOJ({ query, from, size });
  allDocuments.push(...firstBatch.documents);

  const total = firstBatch.total;
  from += size;

  // Fetch remaining batches
  while (from < total) {
    const batch = await searchDOJ({ query, from, size });
    allDocuments.push(...batch.documents);
    from += size;

    // Add a small delay to avoid overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allDocuments;
}

/**
 * Deduplicate documents by documentId (multiple chunks can reference same doc)
 */
export function deduplicateDocuments(documents: DOJDocument[]): DOJDocument[] {
  const seen = new Set<string>();
  return documents.filter((doc) => {
    if (seen.has(doc.documentId)) {
      return false;
    }
    seen.add(doc.documentId);
    return true;
  });
}

/**
 * Extract unique PDF URLs from search results
 */
export function extractPDFUrls(documents: DOJDocument[]): string[] {
  const urls = new Set<string>();
  documents.forEach((doc) => {
    if (doc.fileUri) {
      urls.add(doc.fileUri);
    }
  });
  return Array.from(urls);
}

/**
 * Get cache key for a search query
 */
export function getCacheKey(query: string, from: number = 0): string {
  return `doj-search:${query.toLowerCase().trim()}:${from}`;
}
