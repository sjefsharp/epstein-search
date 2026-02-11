import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock db module
vi.mock("@/lib/db", () => ({
  runQuery: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { runQuery } from "@/lib/db";

const mockedRunQuery = vi.mocked(runQuery);

const createRequest = (secret?: string) => {
  const headers = new Headers();
  if (secret) headers.set("x-cron-secret", secret);
  return new NextRequest("http://localhost:3000/api/keep-alive", {
    method: "GET",
    headers,
  });
};

describe("/api/keep-alive", () => {
  beforeEach(() => {
    vi.resetModules();
    mockedRunQuery.mockReset();
    mockFetch.mockReset();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.RENDER_WORKER_URL = "http://localhost:10000";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 500 if CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("any-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/i);
  });

  it("returns 401 if x-cron-secret header is missing", async () => {
    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 if x-cron-secret header is wrong", async () => {
    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("pings both Neon and Render on valid auth", async () => {
    mockedRunQuery.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 } as ReturnType<
      typeof runQuery
    > extends Promise<infer R>
      ? R
      : never);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("test-cron-secret"));
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
    const res = await GET(createRequest("test-cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("error");
    expect(body.render).toBe("ok");
  });

  it("reports render error when worker ping fails", async () => {
    mockedRunQuery.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 } as ReturnType<
      typeof runQuery
    > extends Promise<infer R>
      ? R
      : never);
    mockFetch.mockRejectedValue(new Error("fetch failed"));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("test-cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("ok");
    expect(body.render).toBe("error");
  });

  it("reports both errors when both services fail", async () => {
    mockedRunQuery.mockRejectedValue(new Error("db down"));
    mockFetch.mockRejectedValue(new Error("worker down"));

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("test-cron-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.neon).toBe("error");
    expect(body.render).toBe("error");
  });

  it("reports render error when RENDER_WORKER_URL is not set", async () => {
    delete process.env.RENDER_WORKER_URL;
    mockedRunQuery.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 } as ReturnType<
      typeof runQuery
    > extends Promise<infer R>
      ? R
      : never);

    const { GET } = await import("@/app/api/keep-alive/route");
    const res = await GET(createRequest("test-cron-secret"));
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
