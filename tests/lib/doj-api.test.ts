import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchDOJ,
  searchDOJAll,
  DOJAPIError,
  deduplicateDocuments,
  extractPDFUrls,
  getCacheKey,
} from "../../src/lib/doj-api";

const createApiResponse = () => ({
  hits: {
    total: { value: 2 },
    hits: [
      {
        _source: {
          documentId: "doc-1",
          chunkIndex: 0,
          totalChunks: 1,
          startPage: 1,
          endPage: 2,
          ORIGIN_FILE_NAME: "Doc One",
          ORIGIN_FILE_URI: "https://example.com/doc1.pdf",
          bucket: "bucket",
          key: "key",
          fileSize: 123,
          totalWords: 456,
          totalCharacters: 789,
          processedAt: "2024-01-01T00:00:00Z",
        },
        highlight: {
          content: ["highlight one", "highlight two"],
        },
      },
      {
        _source: {
          documentId: "doc-2",
          chunkIndex: 0,
          totalChunks: 1,
          startPage: 3,
          endPage: 4,
          ORIGIN_FILE_NAME: "Doc Two",
          ORIGIN_FILE_URI: "https://example.com/doc2.pdf",
          bucket: "bucket",
          key: "key",
          fileSize: 222,
          totalWords: 333,
          totalCharacters: 444,
          processedAt: "2024-01-02T00:00:00Z",
        },
        _source_content: "fallback content",
      },
    ],
  },
});

describe("doj-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws when query is empty", async () => {
    await expect(searchDOJ({ query: "  " })).rejects.toBeInstanceOf(
      DOJAPIError,
    );
  });

  it("maps DOJ API response into documents", async () => {
    const apiData = createApiResponse();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue(apiData),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchDOJ({ query: "epstein", from: 0, size: 2 });

    expect(result.total).toBe(2);
    expect(result.documents[0].content).toContain("highlight one");
    expect(result.documents[1].content).toBe("fallback content");
  });

  it("throws on non-ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(searchDOJ({ query: "epstein" })).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("deduplicates documents by documentId", () => {
    const documents = [
      { documentId: "a" } as never,
      { documentId: "a" } as never,
      { documentId: "b" } as never,
    ];

    expect(deduplicateDocuments(documents)).toHaveLength(2);
  });

  it("extracts unique PDF URLs", () => {
    const urls = extractPDFUrls([
      { fileUri: "https://example.com/a.pdf" } as never,
      { fileUri: "https://example.com/a.pdf" } as never,
      { fileUri: "https://example.com/b.pdf" } as never,
    ]);

    expect(urls).toEqual([
      "https://example.com/a.pdf",
      "https://example.com/b.pdf",
    ]);
  });

  it("builds cache keys from query and offset", () => {
    expect(getCacheKey(" Epstein ", 200)).toBe("doj-search:epstein:200");
  });

  it("paginates through all results", async () => {
    const apiData = createApiResponse();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue(apiData),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          hits: {
            total: { value: 2 },
            hits: [],
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const documents = await searchDOJAll("epstein");

    expect(documents).toHaveLength(2);
  });
});
