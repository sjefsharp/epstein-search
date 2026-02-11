import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("@/lib/db", () => ({
  runQuery: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { runQuery } from "@/lib/db";

const mockedRunQuery = vi.mocked(runQuery);

describe("/api/keep-alive", () => {
  beforeEach(() => {
    vi.resetModules();
    mockedRunQuery.mockReset();
    mockFetch.mockReset();
    process.env.RENDER_WORKER_URL = "http://localhost:10000";
  });

  it("pings both Neon and Render", async () => {
    mockedRunQuery.mockResolvedValue({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    } as unknown as Awaited<ReturnType<typeof runQuery>>);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("ok");
    expect(body.render).toBe("ok");
    expect(body.timestamp).toBeDefined();

    expect(mockedRunQuery).toHaveBeenCalledWith("SELECT 1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:10000/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("reports neon error when db ping fails", async () => {
    mockedRunQuery.mockRejectedValue(new Error("connection refused"));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("error");
    expect(body.render).toBe("ok");
  });

  it("reports render error when worker ping fails", async () => {
    mockedRunQuery.mockResolvedValue({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    } as unknown as Awaited<ReturnType<typeof runQuery>>);
    mockFetch.mockRejectedValue(new Error("fetch failed"));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("ok");
    expect(body.render).toBe("error");
  });

  it("reports both errors when both services fail", async () => {
    mockedRunQuery.mockRejectedValue(new Error("db down"));
    mockFetch.mockRejectedValue(new Error("worker down"));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("error");
    expect(body.render).toBe("error");
  });

  it("reports render error when RENDER_WORKER_URL is not set", async () => {
    delete process.env.RENDER_WORKER_URL;
    mockedRunQuery.mockResolvedValue({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    } as unknown as Awaited<ReturnType<typeof runQuery>>);

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("ok");
    expect(body.render).toBe("error");
  });

  it("exports runtime as nodejs", async () => {
    const { runtime } = await import("@/app/api/keep-alive/route");
    expect(runtime).toBe("nodejs");
  });
});
