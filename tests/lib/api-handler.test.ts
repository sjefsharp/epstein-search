import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  createRateLimitResponse,
  getStatusCodeFromError,
  withJsonErrorHandling,
} from "@/lib/api-handler";

describe("api-handler", () => {
  describe("getStatusCodeFromError", () => {
    it("returns 504 for TimeoutError", () => {
      const err = new Error("timeout");
      err.name = "TimeoutError";
      expect(getStatusCodeFromError(err)).toBe(504);
    });

    it("returns statusCode when present", () => {
      expect(getStatusCodeFromError({ statusCode: 418 })).toBe(418);
    });

    it("falls back to 500", () => {
      expect(getStatusCodeFromError(new Error("boom"))).toBe(500);
      expect(getStatusCodeFromError("nope")).toBe(500);
    });
  });

  describe("createRateLimitResponse", () => {
    it("builds 429 response with standard headers", async () => {
      const response = createRateLimitResponse("Too many requests", {
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 10_000,
        pending: Promise.resolve(),
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Too many requests");
    });
  });

  describe("withJsonErrorHandling", () => {
    it("returns wrapped handler response on success", async () => {
      const handler = withJsonErrorHandling(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
        {
          routeName: "test",
          buildErrorBody: () => ({ error: "nope" }),
        },
      );

      const request = new NextRequest("http://localhost/test");
      const response = await handler(request);
      expect(response.status).toBe(200);
    });

    it("returns standardized error response when wrapped handler throws", async () => {
      const handler = withJsonErrorHandling(
        async () => {
          throw new Error("boom");
        },
        {
          routeName: "test",
          buildErrorBody: () => ({ error: "failed" }),
        },
      );

      const request = new NextRequest("http://localhost/test");
      const response = await handler(request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("failed");
    });
  });
});
