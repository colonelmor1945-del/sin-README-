import { NextResponse } from "next/server";
import { z } from "zod";

import { AiRefusalError, getAiProvider } from "@/lib/ai";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST, can } from "@/lib/entitlements";
import { BUDGETS, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({ topic: z.string().min(3).max(160) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to use this." }, { status: 401 });
  }
  const { userId, account } = session;

  if (!can(account.tier, "creator.lab")) {
    return NextResponse.json(
      { error: "Creator Lab is an Elite feature.", code: "tier" },
      { status: 403 },
    );
  }

  const limit = rateLimit(`creator:${userId}`, BUDGETS.aiCreator);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Give me a topic to work with." }, { status: 400 });
  }

  const store = getStore();
  const cost = CREDIT_COST["creator-lab"];
  const remaining = await store.spendCredits(userId, cost, "creator-lab");
  if (remaining === null) {
    return NextResponse.json(
      { error: `Not enough Lab Credits. This costs ${cost}.`, code: "insufficient-credits" },
      { status: 402 },
    );
  }

  try {
    const idea = await getAiProvider().creatorIdea({ topic: parsed.data.topic });
    return NextResponse.json({ idea, creditsRemaining: remaining });
  } catch (error) {
    await store.grantCredits(userId, cost, "creator-lab");
    return NextResponse.json(
      {
        error:
          error instanceof AiRefusalError
            ? "The model declined this topic."
            : "Generation failed. Your credits were returned.",
      },
      { status: 502 },
    );
  }
}
