import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Keep-alive endpoint — pings Neon Postgres and Render worker to prevent
 * cold starts on free-tier services.
 *
 * Auth: x-cron-secret header must match CRON_SECRET env var.
 * Intended to be called by an external cron service every ~5 minutes.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-cron-secret");
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      return "error";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

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
