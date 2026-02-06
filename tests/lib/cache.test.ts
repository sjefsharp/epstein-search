import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisMock = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  set: vi.fn(),
};

class RedisMock {
  constructor() {
    return redisMock;
  }
}

vi.mock("@upstash/redis", () => ({
  Redis: RedisMock,
}));

describe("cache", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    redisMock.get.mockReset();
    redisMock.setex.mockReset();
    redisMock.del.mockReset();
    redisMock.set.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null when redis is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getCachedSearch } = await import("../../src/lib/cache");
    const result = await getCachedSearch("key");

    expect(result).toBeNull();
    expect(redisMock.get).not.toHaveBeenCalled();
  });

  it("sets and gets cached results when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://localhost";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    const { getCachedSearch, setCachedSearch } =
      await import("../../src/lib/cache");

    redisMock.get.mockResolvedValue({
      total: 1,
      documents: [],
      searchTerm: "epstein",
      from: 0,
      size: 100,
    });

    await setCachedSearch("cache:key", {
      total: 1,
      documents: [],
      searchTerm: "epstein",
      from: 0,
      size: 100,
    });

    expect(redisMock.setex).toHaveBeenCalled();

    const result = await getCachedSearch("cache:key");
    expect(result?.total).toBe(1);
  });

  it("invalidates cached search pages", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://localhost";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    const { invalidateSearchCache } = await import("../../src/lib/cache");
    await invalidateSearchCache("Epstein");

    expect(redisMock.del).toHaveBeenCalledTimes(20);
  });

  it("tracks cache hits and updates stats", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://localhost";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    const { trackCacheEvent } = await import("../../src/lib/cache");

    redisMock.get.mockResolvedValue({ hits: 1, misses: 2, size: 3 });

    await trackCacheEvent("hit");

    expect(redisMock.set).toHaveBeenCalledWith(
      "cache:stats",
      JSON.stringify({ hits: 2, misses: 2, size: 3 }),
    );
  });
});
