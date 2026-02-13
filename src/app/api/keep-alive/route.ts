import { NextResponse } from "next/server";
import { runQuery } from "@/lib/db";
import { resolveWorkerUrl } from "@/lib/worker-url";

export const runtime = "nodejs";

/**
 * Keep-alive endpoint — pings Neon Postgres and Render worker to prevent
 * cold starts on free-tier services.
 *
 * Unauthenticated (read-only, no sensitive data). Intended to be called
 * by an external uptime monitor (e.g. UptimeRobot) every ~5 minutes.
 */
export async function GET() {
  const [neonResult, renderResult] = await Promise.all([pingNeon(), pingRender()]);

  return NextResponse.json({
    neon: neonResult,
    render: renderResult,
    timestamp: new Date().toISOString(),
  });
}

async function pingNeon(): Promise<"ok" | "error"> {
  try {
    await runQuery("SELECT 1");
    return "ok";
  } catch {
    return "error";
  }
}

async function pingRender(): Promise<"ok" | "error"> {
  try {
    const workerUrl = resolveWorkerUrl();
    if (!workerUrl) {
      return "error";
    }

    const controller = new AbortController();
    // Render free-tier cold starts can take 30-60s — allow up to 55s
    const timeout = setTimeout(() => controller.abort(), 55_000);

    try {
      const res = await fetch(`${workerUrl}/health`, {
        signal: controller.signal,
      });
      if (!res.ok) return "error";
      return "ok";
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return "error";
  }
}
