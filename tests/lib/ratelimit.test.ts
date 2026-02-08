import { checkRateLimit, getClientIp } from "../../src/lib/ratelimit";

describe("ratelimit", () => {
  it("returns forwarded client IP when available", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("returns real IP header when provided", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-real-ip": "198.51.100.22",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.22");
  });

  it("falls back to anonymous when no IP headers", () => {
    const request = new Request("https://example.com");
    expect(getClientIp(request)).toBe("anonymous");
  });

  it("allows all requests when ratelimit is null", async () => {
    const result = await checkRateLimit("anon", null);
    expect(result.success).toBe(true);
  });

  it("delegates to ratelimit implementation when provided", async () => {
    const limit = vi.fn().mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now(),
    });

    const result = await checkRateLimit("anon", { limit } as never);

    expect(limit).toHaveBeenCalledWith("anon");
    expect(result.success).toBe(false);
  });
});
