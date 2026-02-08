import {
  generateWorkerSignature,
  verifyWorkerSignature,
  getWorkerSecret,
  enforceHttps,
  sanitizeError,
} from "@/lib/security";

describe("security utilities", () => {
  const testSecret = "test-secret-key-123";
  const testPayload = JSON.stringify({ query: "test", from: 0, size: 100 });

  beforeEach(() => {
    process.env.WORKER_SHARED_SECRET = testSecret;
  });

  describe("generateWorkerSignature", () => {
    it("generates consistent HMAC signature", () => {
      const sig1 = generateWorkerSignature(testPayload, testSecret);
      const sig2 = generateWorkerSignature(testPayload, testSecret);

      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // SHA256 hex is 64 chars
    });

    it("generates different signatures for different payloads", () => {
      const payload1 = JSON.stringify({ query: "test1" });
      const payload2 = JSON.stringify({ query: "test2" });

      const sig1 = generateWorkerSignature(payload1, testSecret);
      const sig2 = generateWorkerSignature(payload2, testSecret);

      expect(sig1).not.toBe(sig2);
    });

    it("generates different signatures for different secrets", () => {
      const sig1 = generateWorkerSignature(testPayload, "secret1");
      const sig2 = generateWorkerSignature(testPayload, "secret2");

      expect(sig1).not.toBe(sig2);
    });
  });

  describe("verifyWorkerSignature", () => {
    it("verifies valid signature", () => {
      const signature = generateWorkerSignature(testPayload, testSecret);
      const isValid = verifyWorkerSignature(testPayload, signature, testSecret);

      expect(isValid).toBe(true);
    });

    it("rejects invalid signature", () => {
      const isValid = verifyWorkerSignature(testPayload, "invalid-signature", testSecret);

      expect(isValid).toBe(false);
    });

    it("rejects signature with wrong secret", () => {
      const signature = generateWorkerSignature(testPayload, "wrong-secret");
      const isValid = verifyWorkerSignature(testPayload, signature, testSecret);

      expect(isValid).toBe(false);
    });

    it("rejects signature for different payload", () => {
      const signature = generateWorkerSignature(testPayload, testSecret);
      const differentPayload = JSON.stringify({ query: "different" });
      const isValid = verifyWorkerSignature(differentPayload, signature, testSecret);

      expect(isValid).toBe(false);
    });
  });

  describe("getWorkerSecret", () => {
    it("returns secret from environment", () => {
      const secret = getWorkerSecret();
      expect(secret).toBe(testSecret);
    });

    it("throws if WORKER_SHARED_SECRET not set", () => {
      delete process.env.WORKER_SHARED_SECRET;

      expect(() => getWorkerSecret()).toThrow(
        "WORKER_SHARED_SECRET environment variable is not set",
      );

      // Restore for other tests
      process.env.WORKER_SHARED_SECRET = testSecret;
    });
  });

  describe("enforceHttps", () => {
    it("accepts HTTPS URLs", () => {
      const url = "https://example.com/path";
      expect(() => enforceHttps(url)).not.toThrow();
      expect(enforceHttps(url)).toBe(url);
    });

    it("rejects HTTP URLs", () => {
      const url = "http://example.com/path";
      expect(() => enforceHttps(url)).toThrow("Only HTTPS URLs are allowed");
    });

    it("rejects non-HTTP protocols", () => {
      const url = "ftp://example.com/path";
      expect(() => enforceHttps(url)).toThrow("Only HTTPS URLs are allowed");
    });
  });

  describe("sanitizeError", () => {
    const testError = new Error("Sensitive database error");

    it("returns error message in development", () => {
      const result = sanitizeError(testError, true);
      expect(result).toBe("Sensitive database error");
    });

    it("returns generic message in production", () => {
      const result = sanitizeError(testError, false);
      expect(result).toBe("An error occurred while processing your request");
    });

    it("handles non-Error objects in development", () => {
      const result = sanitizeError({ message: "test" }, true);
      expect(result).toBe("Unknown error occurred");
    });

    it("handles non-Error objects in production", () => {
      const result = sanitizeError({ message: "test" }, false);
      expect(result).toBe("Unknown error occurred");
    });
  });
});
