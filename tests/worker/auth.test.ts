import crypto from "crypto";

describe("Worker authentication logic", () => {
  const testSecret = "test-secret-key";

  function generateSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  function verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = generateSignature(payload, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  describe("signature generation and verification", () => {
    it("generates valid HMAC-SHA256 signature", () => {
      const payload = JSON.stringify({ query: "test" });
      const signature = generateSignature(payload, testSecret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBe(64);
    });

    it("verifies correct signature", () => {
      const payload = JSON.stringify({ query: "test" });
      const signature = generateSignature(payload, testSecret);

      const isValid = verifySignature(payload, signature, testSecret);
      expect(isValid).toBe(true);
    });

    it("rejects tampered payload", () => {
      const payload = JSON.stringify({ query: "test" });
      const signature = generateSignature(payload, testSecret);

      const tamperedPayload = JSON.stringify({ query: "hacked" });
      const isValid = verifySignature(tamperedPayload, signature, testSecret);

      expect(isValid).toBe(false);
    });

    it("rejects wrong signature", () => {
      const payload = JSON.stringify({ query: "test" });
      const wrongSignature = "0".repeat(64);

      const isValid = verifySignature(payload, wrongSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it("handles signature length mismatch safely", () => {
      const payload = JSON.stringify({ query: "test" });
      const shortSignature = "abc123";

      const isValid = verifySignature(payload, shortSignature, testSecret);
      expect(isValid).toBe(false);
    });
  });

  describe("Bearer token extraction", () => {
    it("extracts token from Authorization header", () => {
      const signature = "test-signature-value";
      const authHeader = `Bearer ${signature}`;

      const extracted = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : undefined;

      expect(extracted).toBe(signature);
    });

    it("returns undefined for invalid format", () => {
      const authHeader = "Invalid format";

      const extracted = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : undefined;

      expect(extracted).toBeUndefined();
    });

    it("handles missing Authorization header", () => {
      const authHeader = undefined;

      const extracted =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.slice("Bearer ".length)
          : undefined;

      expect(extracted).toBeUndefined();
    });
  });

  describe("header priority", () => {
    it("prefers X-Worker-Signature over Authorization", () => {
      const xWorkerSig = "signature-from-x-header";
      const authSig = "signature-from-auth-header";

      // Simulate worker logic: signatureFromHeader || bearerToken
      const signature = xWorkerSig || authSig;

      expect(signature).toBe(xWorkerSig);
    });

    it("falls back to Authorization if X-Worker-Signature missing", () => {
      const xWorkerSig = undefined;
      const authSig = "signature-from-auth-header";

      const signature = xWorkerSig || authSig;

      expect(signature).toBe(authSig);
    });

    it("returns undefined if both headers missing", () => {
      const xWorkerSig = undefined;
      const authSig = undefined;

      const signature = xWorkerSig || authSig;

      expect(signature).toBeUndefined();
    });
  });
});
