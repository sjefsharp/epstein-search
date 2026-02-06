// Upstash Redis cache wrapper for DOJ search results
import { Redis } from "@upstash/redis";
import { DOJSearchResponse } from "./types";

const CACHE_TTL = 86400; // 24 hours in seconds

let redis: Redis | null = null;
let redisInitialized = false;

/**
 * Lazy initialize Redis client (only on first use, not at module load time)
 * This prevents build-time errors with placeholder env vars
 */
function getRedisClient(): Redis | null {
  if (redisInitialized) return redis;
  redisInitialized = true;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!redisUrl || !redisToken) {
    console.warn(
      "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Caching disabled.",
    );
    return null;
  }

  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (error) {
    console.error("Failed to initialize Redis client:", error);
    redis = null;
  }

  return redis;
}

/**
 * Get cached search results
 */
export async function getCachedSearch(
  cacheKey: string,
): Promise<DOJSearchResponse | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const cached = await client.get<DOJSearchResponse>(cacheKey);
    return cached ?? null;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

/**
 * Set search results in cache
 */
export async function setCachedSearch(
  cacheKey: string,
  results: DOJSearchResponse,
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    await client.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
  } catch (error) {
    console.error("Cache set error:", error);
    // Don't throw - caching is optional
  }
}

/**
 * Invalidate cache for a specific search term
 */
export async function invalidateSearchCache(searchTerm: string): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    const baseKey = `doj-search:${searchTerm.toLowerCase().trim()}`;
    for (let i = 0; i < 20; i++) {
      await client.del(`${baseKey}:${i * 100}`);
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
}

/**
 * Get cache statistics (for debugging)
 */
export async function getCacheStats(): Promise<{
  hits: number;
  misses: number;
  size: number;
}> {
  try {
    const client = getRedisClient();
    if (!client) return { hits: 0, misses: 0, size: 0 };
    const stats = await client.get<{
      hits: number;
      misses: number;
      size: number;
    }>("cache:stats");
    return stats || { hits: 0, misses: 0, size: 0 };
  } catch {
    return { hits: 0, misses: 0, size: 0 };
  }
}

/**
 * Track cache hit/miss (optional analytics)
 */
export async function trackCacheEvent(event: "hit" | "miss"): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    const stats = await getCacheStats();
    if (event === "hit") {
      stats.hits++;
    } else {
      stats.misses++;
    }
    await client.set("cache:stats", JSON.stringify(stats));
  } catch {
    // Ignore tracking errors
  }
}
