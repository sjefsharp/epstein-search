// Test setup file
import * as matchers from "@testing-library/jest-dom/matchers";

// extend expect with jest-dom matchers (expect is available globally via vitest globals: true)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).expect.extend(matchers);

beforeAll(() => {
  // Set test environment variables
  process.env.WORKER_SHARED_SECRET = "test-secret-key-123";
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  process.env.WORKER_URL = "http://localhost:10000";
  // NODE_ENV is set by vitest automatically, no need to override
});
