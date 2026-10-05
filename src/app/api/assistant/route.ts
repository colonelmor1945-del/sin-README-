import { NextResponse } from "next/server";
import { z } from "zod";

import { AiRefusalError, getAiProvider } from "@/lib/ai";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { consumeQuery, recordUsageCost } from "@/lib/entitlements";
import { costMinorForUsage } from "@/lib/pricing";
import { BUDGETS, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

/**
 * Streaming assistant endpoint.
 *
 * Order of checks matters: rate limit before quota before model call, so an
 * abusive client is rejected before it costs anything.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to use this." }, { status: 401 });
  }
  const { userId, account } = session;

  const limit = rateLimit(`assistant:${userId}`, BUDGETS.aiChat);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const quota = await consumeQuery(userId, account.tier);
  if (!quota.allowed) {
    const error =
      quota.reason === "cost-cap"
        ? "You have used today's model budget on this plan. It resets tomorrow — heavy days are rare, but this stops one from costing more than the subscription."
        : `You have used all ${quota.limit} free queries today. Upgrade for unlimited access.`;
    return NextResponse.json({ error, code: quota.reason }, { status: 402 });
  }

  const profile = await getStore().getProfile(userId);
  const provider = getAiProvider();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.chat({
          messages: parsed.data.messages,
          profile,
          signal: request.signal,
          onUsage: (usage) => recordUsageCost(userId, costMinorForUsage(usage)),
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        const message =
          error instanceof AiRefusalError
            ? "\n\nI cannot answer that one. Try rephrasing it as an in-game strategy question."
            : "\n\nSomething went wrong reaching the model. Your query was not counted.";
        controller.enqueue(encoder.encode(message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-provider": provider.id,
      "x-queries-used": String(quota.used),
      "x-queries-limit": String(quota.limit),
    },
  });
}
