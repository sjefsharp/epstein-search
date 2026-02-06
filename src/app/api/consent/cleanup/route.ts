import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/db";

const CONSENT_TABLES = [
  "consent_events_en",
  "consent_events_nl",
  "consent_events_fr",
  "consent_events_de",
  "consent_events_es",
  "consent_events_pt",
] as const;

export const runtime = "nodejs";

const isAuthorized = (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (cronSecret && providedSecret === cronSecret) {
    return true;
  }

  if (vercelCron === "1") {
    return true;
  }

  return false;
};

const runCleanup = async () => {
  const retentionInterval = "12 months";
  const results: Record<string, number> = {};

  for (const table of CONSENT_TABLES) {
    const query = `
      DELETE FROM ${table}
      WHERE received_at < NOW() - INTERVAL '${retentionInterval}'
    `;
    const result = await runQuery(query);
    results[table] = result.rowCount ?? 0;
  }

  return results;
};

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await runCleanup();

  return NextResponse.json({ ok: true, deleted: results });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runCleanup();

  return NextResponse.json({ ok: true, deleted: results });
}
