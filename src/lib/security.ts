// Security utilities
import crypto from "crypto";

/**
 * Generate HMAC signature for worker authentication
 * Uses shared secret to sign requests
 */
export function generateWorkerSignature(
  payload: string,
  secret: string,
): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify worker signature
 */
export function verifyWorkerSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = generateWorkerSignature(payload, secret);
  // Guard against length mismatch before timing-safe comparison
  if (signature.length !== expected.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

/**
 * Get worker shared secret from environment
 * Throws if not configured
 */
export function getWorkerSecret(): string {
  const secret = process.env.WORKER_SHARED_SECRET;
  if (!secret) {
    throw new Error("WORKER_SHARED_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Validate and enforce HTTPS on URLs
 */
export function enforceHttps(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }
  return url;
}

/**
 * Sanitize error messages for production
 * Strips stack traces and sensitive information
 */
export function sanitizeError(error: unknown, isDevelopment: boolean): string {
  if (error instanceof Error) {
    if (isDevelopment) {
      return error.message;
    }
    // In production, return generic message
    return "An error occurred while processing your request";
  }
  return "Unknown error occurred";
}
