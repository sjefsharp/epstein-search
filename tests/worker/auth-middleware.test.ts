import { describe, expect, it } from "vitest";
import {
  computeWorkerSignature,
  extractWorkerSignature,
  verifyWorkerSignature,
} from "../../worker/src/auth";

describe("worker auth middleware helpers", () => {
  const testSecret = "test-secret-key";

  it("computes deterministic HMAC signatures", () => {
    const payload = JSON.stringify({ query: "test" });
    const sigA = computeWorkerSignature(payload, testSecret);
    const sigB = computeWorkerSignature(payload, testSecret);

    expect(sigA).toBe(sigB);
    expect(sigA).toHaveLength(64);
  });

  it("verifies valid signatures", () => {
    const payload = JSON.stringify({ query: "test" });
    const signature = computeWorkerSignature(payload, testSecret);

    expect(verifyWorkerSignature(payload, signature, testSecret)).toBe(true);
    expect(verifyWorkerSignature(payload, signature, "wrong-secret")).toBe(false);
  });

  it("prefers x-worker-signature over bearer token", () => {
    const req = {
      headers: {
        "x-worker-signature": "header-signature",
        authorization: "Bearer bearer-signature",
      },
    };

    expect(extractWorkerSignature(req as never)).toBe("header-signature");
  });

  it("falls back to bearer token when x-worker-signature is absent", () => {
    const req = {
      headers: {
        authorization: "Bearer bearer-signature",
      },
    };

    expect(extractWorkerSignature(req as never)).toBe("bearer-signature");
  });
});
