import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/documents", () => ({
  ensureDocumentsTable: vi.fn(),
  upsertDocuments: vi.fn(),
  getDocumentStats: vi.fn(),
}));

vi.mock("@/lib/doj-api", () => ({
  transformDOJHits: vi.fn(),
  deduplicateDocuments: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  enforceHttps: vi.fn(),
  generateWorkerSignature: vi.fn().mockReturnValue("mock-signature"),
  getWorkerSecret: vi.fn().mockReturnValue("test-secret"),
  sanitizeError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "unknown")),
}));

vi.mock("@/lib/worker-url", () => ({
  resolveWorkerUrl: vi.fn().mockReturnValue("http://localhost:10000"),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { ensureDocumentsTable, upsertDocuments, getDocumentStats } from "@/lib/documents";
import { transformDOJHits, deduplicateDocuments } from "@/lib/doj-api";

const mockUpsert = vi.mocked(upsertDocuments);
const mockStats = vi.mocked(getDocumentStats);
const mockTransformHits = vi.mocked(transformDOJHits);
const mockDeduplicate = vi.mocked(deduplicateDocuments);

describe("/api/cron/refresh-docs route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.WORKER_SHARED_SECRET = "test-secret";
    process.env.WORKER_URL = "http://localhost:10000";
    process.env.NODE_ENV = "test";

    mockStats.mockResolvedValue({ total: 100, oldest: null, newest: null });
  });

  function makeRequest(method: string, headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/cron/refresh-docs", {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
  }

  it("rejects unauthorized GET requests", async () => {
    const { GET } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("GET");
    const response = await GET(req as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("allows GET with x-vercel-cron header", async () => {
    // Set up mock to return successful worker response
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 2,
          documents: [
            { _id: "1", _source: { filename: "doc1.pdf" } },
            { _id: "2", _source: { filename: "doc2.pdf" } },
          ],
          batches: 1,
        }),
        { status: 200 },
      ),
    );
    mockTransformHits.mockReturnValue([
      { documentId: "1", fileName: "doc1.pdf" } as never,
      { documentId: "2", fileName: "doc2.pdf" } as never,
    ]);
    mockDeduplicate.mockReturnValue([
      { documentId: "1", fileName: "doc1.pdf" } as never,
      { documentId: "2", fileName: "doc2.pdf" } as never,
    ]);
    mockUpsert.mockResolvedValue(2);

    const { GET } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("GET", { "x-vercel-cron": "1" });
    const response = await GET(req as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.upserted).toBe(2);
    expect(body.timestamp).toBeDefined();
  });

  it("allows POST with valid cron secret", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ total: 1, documents: [{ _id: "x" }], batches: 1 }), {
        status: 200,
      }),
    );
    mockTransformHits.mockReturnValue([{ documentId: "x" } as never]);
    mockDeduplicate.mockReturnValue([{ documentId: "x" } as never]);
    mockUpsert.mockResolvedValue(1);

    const { POST } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("POST", { "x-cron-secret": "test-cron-secret" });
    const response = await POST(req as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("returns 500 when CRON_SECRET is not configured (POST)", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("POST");
    const response = await POST(req as never);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("CRON_SECRET");
  });

  it("handles worker error response gracefully", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Browser pool failed" }), { status: 500 }),
    );

    const { GET } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("GET", { "x-vercel-cron": "1" });
    const response = await GET(req as never);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("500");
  });

  it("calls ensureDocumentsTable before worker fetch", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ total: 0, documents: [], batches: 0 }), { status: 200 }),
    );

    const { GET } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("GET", { "x-vercel-cron": "1" });
    await GET(req as never);

    expect(ensureDocumentsTable).toHaveBeenCalled();
  });

  it("sends HMAC signature to worker", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ total: 0, documents: [], batches: 0 }), { status: 200 }),
    );

    const { GET } = await import("@/app/api/cron/refresh-docs/route");
    const req = makeRequest("GET", { "x-vercel-cron": "1" });
    await GET(req as never);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:10000/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Worker-Signature": "mock-signature",
          Authorization: "Bearer mock-signature",
        }),
      }),
    );
  });
});
