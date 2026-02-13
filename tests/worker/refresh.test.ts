import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mock the browser-pool module
vi.mock("../../worker/src/browser-pool", () => ({
  getPool: vi.fn(),
  prewarmAkamai: vi.fn(),
}));

import { getPool } from "../../worker/src/browser-pool";
import { createRefreshHandler } from "../../worker/src/routes";

const mockGetPool = vi.mocked(getPool);

function mockRequest(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request;
}

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("createRefreshHandler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns documents from paginated DOJ crawl", async () => {
    const mockPage = {
      evaluate: vi.fn().mockResolvedValue({
        error: false,
        data: {
          hits: {
            total: { value: 2 },
            hits: [
              { _id: "1", _source: { filename: "doc1.pdf" } },
              { _id: "2", _source: { filename: "doc2.pdf" } },
            ],
          },
        },
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetPool.mockResolvedValue({
      context: { newPage: vi.fn().mockResolvedValue(mockPage) },
    } as never);

    const handler = createRefreshHandler();
    const req = mockRequest({ query: "epstein", batchSize: 100 });
    const res = mockResponse();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      total: 2,
      documents: [
        { _id: "1", _source: { filename: "doc1.pdf" } },
        { _id: "2", _source: { filename: "doc2.pdf" } },
      ],
      batches: 1,
    });
  });

  it("returns 502 with empty results if first batch fails", async () => {
    const mockPage = {
      evaluate: vi.fn().mockResolvedValue({
        error: true,
        status: 403,
        statusText: "Forbidden",
        body: "Bot detected",
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetPool.mockResolvedValue({
      context: { newPage: vi.fn().mockResolvedValue(mockPage) },
    } as never);

    const handler = createRefreshHandler();
    const req = mockRequest({ query: "epstein" });
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("403"),
        documents: [],
        total: 0,
        batches: 0,
      }),
    );
  });

  it("returns partial results if a later batch fails", async () => {
    const mockPage = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce({
          error: false,
          data: {
            hits: {
              total: { value: 200 },
              hits: [{ _id: "1", _source: { filename: "doc1.pdf" } }],
            },
          },
        })
        .mockResolvedValueOnce({
          error: true,
          status: 403,
          statusText: "Forbidden",
          body: "Blocked",
        }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetPool.mockResolvedValue({
      context: { newPage: vi.fn().mockResolvedValue(mockPage) },
    } as never);

    const handler = createRefreshHandler();
    const req = mockRequest({ query: "epstein", batchSize: 1 });
    const res = mockResponse();

    await handler(req, res);

    // Should return partial results (1 hit from first batch)
    expect(res.json).toHaveBeenCalledWith({
      total: 200,
      documents: [{ _id: "1", _source: { filename: "doc1.pdf" } }],
      batches: 1,
    });
  });

  it("handles pool errors with 500 status", async () => {
    mockGetPool.mockRejectedValue(new Error("Browser pool failed"));

    const handler = createRefreshHandler();
    const req = mockRequest({ query: "epstein" });
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Browser pool failed" });
  });

  it("defaults query to 'epstein' and batchSize to 100", async () => {
    const mockPage = {
      evaluate: vi.fn().mockResolvedValue({
        error: false,
        data: {
          hits: { total: { value: 0 }, hits: [] },
        },
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetPool.mockResolvedValue({
      context: { newPage: vi.fn().mockResolvedValue(mockPage) },
    } as never);

    const handler = createRefreshHandler();
    const req = mockRequest({});
    const res = mockResponse();

    await handler(req, res);

    // Verify the search URL passed to page.evaluate matches defaults
    const evaluateCall = mockPage.evaluate.mock.calls[0];
    const urlArg = evaluateCall[1] as string;
    expect(urlArg).toContain("keys=epstein");
    expect(urlArg).toContain("size=100");
    expect(urlArg).toContain("from=0");
  });
});
