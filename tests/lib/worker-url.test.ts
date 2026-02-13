import { describe, it, expect, beforeEach, vi } from "vitest";

describe("resolveWorkerUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.WORKER_URL;
    delete process.env.RENDER_WORKER_URL;
  });

  async function loadModule() {
    const mod = await import("../../src/lib/worker-url");
    return mod.resolveWorkerUrl;
  }

  it("prefers WORKER_URL when set", async () => {
    process.env.WORKER_URL = "https://worker.example.com";
    process.env.RENDER_WORKER_URL = "https://render.example.com";
    const resolveWorkerUrl = await loadModule();
    expect(resolveWorkerUrl("http://fallback:10000")).toBe("https://worker.example.com");
  });

  it("falls back to RENDER_WORKER_URL when WORKER_URL is not set", async () => {
    process.env.RENDER_WORKER_URL = "https://render.example.com";
    const resolveWorkerUrl = await loadModule();
    expect(resolveWorkerUrl("http://fallback:10000")).toBe("https://render.example.com");
  });

  it("uses fallback when no env vars are set", async () => {
    const resolveWorkerUrl = await loadModule();
    expect(resolveWorkerUrl("http://fallback:10000")).toBe("http://fallback:10000");
  });
});
