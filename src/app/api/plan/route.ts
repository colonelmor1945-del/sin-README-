import { NextResponse } from "next/server";
import { z } from "zod";

import { AiRefusalError, getAiProvider } from "@/lib/ai";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST } from "@/lib/entitlements";
import { BUDGETS, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  currentMoney: z.number().int().min(0).max(1_000_000_000),
  level: z.number().int().min(1).max(999),
  goal: z.number().int().min(1000).max(1_000_000_000),
  playstyle: z.enum([
    "fastest-money",
    "safest",
    "max-profit",
    "low-investment",
    "solo",
    "multiplayer",
  ]),
  ownedAssetIds: z.array(z.string().max(64)).max(40).default([]),
  completedMissionIds: z.array(z.string().max(64)).max(200).default([]),
});

/**
 * Plan generation. Costs Lab Credits, so the debit happens before the model
 * call and is refunded if the call fails. The client never sees the balance
 * it is spending from; it is read server-side.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to use this." }, { status: 401 });
  }
  const { userId } = session;

  const limit = rateLimit(`plan:${userId}`, BUDGETS.aiPlan);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many plan requests." }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the numbers you entered.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.goal <= parsed.data.currentMoney) {
    return NextResponse.json(
      { error: "Your goal needs to be higher than your current balance." },
      { status: 400 },
    );
  }

  const store = getStore();
  const cost = CREDIT_COST["money-plan"];
  const remaining = await store.spendCredits(userId, cost, "money-plan");
  if (remaining === null) {
    return NextResponse.json(
      { error: `Not enough Lab Credits. A plan costs ${cost}.`, code: "insufficient-credits" },
      { status: 402 },
    );
  }

  const profile = { ...parsed.data };
  await store.saveProfile(userId, profile);

  try {
    const plan = await getAiProvider().generatePlan({ profile });
    await store.savePlan(userId, plan);
    return NextResponse.json({ plan, creditsRemaining: remaining });
  } catch (error) {
    await store.grantCredits(userId, cost, "money-plan");
    const message =
      error instanceof AiRefusalError
        ? "The model declined this request. Try a different playstyle or goal."
        : "Plan generation failed. Your credits were returned.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
