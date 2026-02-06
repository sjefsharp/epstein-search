// Rate limiting using Upstash Redis
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client (graceful degradation if not configured)
// Trim environment variables to remove any trailing whitespace/newlines
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

/**
 * Rate limiter for search endpoints
 * Allows 10 requests per 10 seconds per IP
 */
export const searchRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "@upstash/ratelimit:search",
    })
  : null;

/**
 * Rate limiter for analyze endpoints (more restrictive)
 * Allows 3 requests per 60 seconds per IP
 */
export const analyzeRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "60 s"),
      analytics: true,
      prefix: "@upstash/ratelimit:analyze",
    })
  : null;

/**
 * Rate limiter for consent logging
 * Allows 20 requests per 60 seconds per IP
 */
export const consentRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      analytics: true,
      prefix: "@upstash/ratelimit:consent",
    })
  : null;

/**
 * Check rate limit for a given identifier (usually IP)
 * Returns { success: boolean, limit, remaining, reset }
 */
export async function checkRateLimit(
  identifier: string,
  ratelimit: Ratelimit | null,
) {
  if (!ratelimit) {
    // If rate limiting not configured, allow all requests
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  return await ratelimit.limit(identifier);
}

/**
 * Get client IP from request headers
 * Supports X-Forwarded-For, X-Real-IP, and direct connection
 */
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);

  // Check for proxied IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to "anonymous" if no IP found
  return "anonymous";
}
