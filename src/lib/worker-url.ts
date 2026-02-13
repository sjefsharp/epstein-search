/**
 * Resolve the worker URL from environment variables.
 * Prefers WORKER_URL, falls back to RENDER_WORKER_URL, then the provided default.
 */
export function resolveWorkerUrl(fallback?: string): string | undefined {
  return process.env.WORKER_URL || process.env.RENDER_WORKER_URL || fallback;
}
