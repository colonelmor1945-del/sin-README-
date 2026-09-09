import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { SHORT_QUERIES, fetchShorts } from "@/lib/social/youtube";
import { BUDGETS, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Query = z.object({
  // Constrained to the curated list so the endpoint cannot be used as an open
  // proxy onto someone else's YouTube quota.
  q: z.enum(SHORT_QUERIES).optional(),
  pageToken: z.string().max(200).optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to use this." }, { status: 401 });
  }

  const limit = rateLimit(`shorts:${session.userId}`, BUDGETS.read);
  if (!limit.ok) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    pageToken: url.searchParams.get("pageToken") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown feed." }, { status: 400 });
  }

  const page = await fetchShorts({
    query: parsed.data.q,
    pageToken: parsed.data.pageToken,
  });

  return NextResponse.json(page);
}
