import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DOJDocument } from "../../src/lib/types";

// Mock the db module
vi.mock("../../src/lib/db", () => ({
  runQuery: vi.fn(),
}));

import { runQuery } from "../../src/lib/db";
import {
  ensureDocumentsTable,
  upsertDocuments,
  searchDocumentsLocal,
  getDocumentStats,
} from "../../src/lib/documents";

const mockRunQuery = vi.mocked(runQuery);

const sampleDoc: DOJDocument = {
  documentId: "doc-001",
  chunkIndex: 0,
  totalChunks: 1,
  startPage: 1,
  endPage: 5,
  fileName: "Gov.Uscourts.nysd.447706.1090.3.pdf",
  fileUri: "https://www.justice.gov/d9/2024-09/Gov.Uscourts.nysd.447706.1090.3.pdf",
  fileSize: 123456,
  totalWords: 5000,
  totalCharacters: 25000,
  processedAt: "2024-09-01T00:00:00Z",
  content: "Epstein Maxwell documents regarding...",
  highlights: ["<em>Epstein</em> Maxwell documents"],
  bucket: "doj-files",
  key: "epstein/doc-001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRunQuery.mockResolvedValue({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] });
});

describe("documents module", () => {
  describe("ensureDocumentsTable", () => {
    it("creates table and indexes", async () => {
      await ensureDocumentsTable();

      // Should call runQuery 3 times: CREATE TABLE, CREATE INDEX (search), CREATE INDEX (file_uri)
      expect(mockRunQuery).toHaveBeenCalledTimes(3);
      expect(mockRunQuery.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS documents");
      expect(mockRunQuery.mock.calls[1][0]).toContain(
        "CREATE INDEX IF NOT EXISTS idx_documents_search",
      );
      expect(mockRunQuery.mock.calls[2][0]).toContain(
        "CREATE INDEX IF NOT EXISTS idx_documents_file_uri",
      );
    });
  });

  describe("upsertDocuments", () => {
    it("returns 0 for empty array", async () => {
      const result = await upsertDocuments([]);
      expect(result).toBe(0);
      expect(mockRunQuery).not.toHaveBeenCalled();
    });

    it("upserts a single document", async () => {
      const result = await upsertDocuments([sampleDoc]);
      expect(result).toBe(1);
      expect(mockRunQuery).toHaveBeenCalledTimes(1);
      expect(mockRunQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO documents"),
        expect.arrayContaining(["doc-001", "Gov.Uscourts.nysd.447706.1090.3.pdf"]),
      );
    });

    it("upserts multiple documents", async () => {
      const docs = [sampleDoc, { ...sampleDoc, documentId: "doc-002", fileName: "another.pdf" }];
      const result = await upsertDocuments(docs);
      expect(result).toBe(2);
      expect(mockRunQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe("searchDocumentsLocal", () => {
    it("returns null when no matches found", async () => {
      mockRunQuery.mockResolvedValueOnce({
        rows: [{ count: "0" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      const result = await searchDocumentsLocal("nonexistent query");
      expect(result).toBeNull();
    });

    it("returns DOJSearchResponse shaped results when matches found", async () => {
      // First call: count
      mockRunQuery.mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });
      // Second call: results
      mockRunQuery.mockResolvedValueOnce({
        rows: [
          {
            document_id: "doc-001",
            chunk_index: 0,
            total_chunks: 1,
            start_page: 1,
            end_page: 5,
            file_name: "Gov.Uscourts.nysd.447706.1090.3.pdf",
            file_uri: "https://www.justice.gov/d9/2024-09/Gov.Uscourts.nysd.447706.1090.3.pdf",
            file_size: 123456,
            total_words: 5000,
            total_chars: 25000,
            processed_at: "2024-09-01T00:00:00Z",
            content: "Epstein Maxwell documents regarding...",
            highlights: ["<em>Epstein</em> Maxwell documents"],
            bucket: "doj-files",
            key: "epstein/doc-001",
          },
        ],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      const result = await searchDocumentsLocal("epstein", 0, 100);

      expect(result).not.toBeNull();
      expect(result!.total).toBe(1);
      expect(result!.documents).toHaveLength(1);
      expect(result!.documents[0].documentId).toBe("doc-001");
      expect(result!.documents[0].fileName).toBe("Gov.Uscourts.nysd.447706.1090.3.pdf");
      expect(result!.searchTerm).toBe("epstein");
      expect(result!.from).toBe(0);
      expect(result!.size).toBe(100);
    });

    it("returns null on database error", async () => {
      mockRunQuery.mockRejectedValueOnce(new Error("connection failed"));

      const result = await searchDocumentsLocal("epstein");
      expect(result).toBeNull();
    });
  });

  describe("getDocumentStats", () => {
    it("returns count and lastCrawl", async () => {
      mockRunQuery.mockResolvedValueOnce({
        rows: [{ count: "2000", last_crawl: "2026-02-11T10:00:00Z" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      const stats = await getDocumentStats();
      expect(stats.count).toBe(2000);
      expect(stats.lastCrawl).toBe("2026-02-11T10:00:00Z");
    });

    it("returns zeros on error", async () => {
      mockRunQuery.mockRejectedValueOnce(new Error("db error"));

      const stats = await getDocumentStats();
      expect(stats.count).toBe(0);
      expect(stats.lastCrawl).toBeNull();
    });
  });
});
