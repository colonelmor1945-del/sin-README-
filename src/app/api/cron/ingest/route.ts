import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { runIngestion } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";
// Always fresh. A cached ingestion run is not an ingestion run.
export const dynamic = "force-dynamic";

/**
 * Scheduled ingestion.
 *
 * Point a cron at this. Vercel Cron, GitHub Actions, or any scheduler that can
 * make an authenticated GET.
 *
 * Authentication is a shared secret in a header, compared in constant time.
 * Without CRON_SECRET set the endpoint refuses to run rather than defaulting to
 * open: an unauthenticated ingestion endpoint is a free way for anyone to burn
 * the YouTube quota and the Reddit rate limit.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so scheduled ingestion is disabled." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorised = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!authorised) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const run = await runIngestion();

  // The run log is the useful part of the response. A scheduler that only sees
  // 200 cannot tell a healthy run from one where every source failed.
  return NextResponse.json({
    startedAt: run.startedAt,
    ms: run.ms,
    found: run.items.length,
    corroborated: run.items.filter((i) => i.corroboration > 1).length,
    sources: run.runs,
  });
}
