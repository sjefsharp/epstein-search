// API Route: Search DOJ Epstein files
import { NextRequest, NextResponse } from "next/server";
import { getCacheKey, deduplicateDocuments } from "@/lib/doj-api";
import { getCachedSearch, setCachedSearch, trackCacheEvent } from "@/lib/cache";

export const runtime = "nodejs"; // Use Node.js runtime for Upstash Redis compatibility

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const from = parseInt(searchParams.get("from") || "0", 10);
    const size = parseInt(searchParams.get("size") || "100", 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 },
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(query, from);
    const cached = await getCachedSearch(cacheKey);

    if (cached) {
      await trackCacheEvent("hit");
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // Cache miss - fetch from DOJ API via Worker (bypasses Akamai blocking)
    await trackCacheEvent("miss");
    
    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:10000";
    const workerResponse = await fetch(`${workerUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, from, size }),
    });

    if (!workerResponse.ok) {
      throw new Error(
        `Worker returned ${workerResponse.status}: ${workerResponse.statusText}`,
      );
    }

    const apiData = await workerResponse.json();
    
    // Transform worker response to our format
    const documents = apiData.hits.hits.map((hit: { _source: Record<string, unknown>; highlight?: { content?: string[] }; _source_content?: string }) => {
      const source = hit._source;
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

    const results = {
      total: apiData.hits.total.value,
      documents,
      searchTerm: query,
      from,
      size,
    };

    // Deduplicate documents by documentId
    const uniqueDocuments = deduplicateDocuments(results.documents);
    const deduplicatedResults = {
      ...results,
      documents: uniqueDocuments,
      uniqueCount: uniqueDocuments.length,
    };

    // Cache the results
    await setCachedSearch(cacheKey, deduplicatedResults);

    return NextResponse.json({
      ...deduplicatedResults,
      cached: false,
    });
  } catch (error) {
    console.error("Search API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error.statusCode as number)
        : 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: statusCode },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, from = 0, size = 100 } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required in request body" },
        { status: 400 },
      );
    }

    // Same logic as GET but with POST body
    const cacheKey = getCacheKey(query, from);
    const cached = await getCachedSearch(cacheKey);

    if (cached) {
      await trackCacheEvent("hit");
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    await trackCacheEvent("miss");
    
    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:10000";
    const workerResponse = await fetch(`${workerUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, from, size }),
    });

    if (!workerResponse.ok) {
      throw new Error(
        `Worker returned ${workerResponse.status}: ${workerResponse.statusText}`,
      );
    }

    const apiData = await workerResponse.json();
    
    // Transform worker response to our format
    const documents = apiData.hits.hits.map((hit: { _source: Record<string, unknown>; highlight?: { content?: string[] }; _source_content?: string }) => {
      const source = hit._source;
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

    return NextResponse.json({
      ...deduplicatedResults,
      cached: false,
    });
  } catch (error) {
    console.error("Search API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error.statusCode as number)
        : 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: statusCode },
    );
  }
}
