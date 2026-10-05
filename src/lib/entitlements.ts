import "server-only";

import { getStore } from "@/lib/db/store";
import { DAILY_COST_CAP_MINOR, PRICING } from "@/lib/pricing";
import type { Tier } from "@/lib/types";

/**
 * Entitlements and quotas.
 *
 * Every gate is evaluated on the server against the tier stored in the
 * database. The client is told what it may show, never what it may do.
 */

/**
 * Re-exported for the surfaces that only need the label, the cap and the
 * feature list. Prices and discounts live in src/lib/pricing.ts.
 */
export const TIERS: Record<
  Tier,
  {
    label: string;
    priceMinor: number;
    dailyQueries: number;
    features: string[];
    monthlyCredits: number;
  }
> = {
  free: { ...PRICING.free, priceMinor: PRICING.free.monthlyMinor },
  pro: { ...PRICING.pro, priceMinor: PRICING.pro.monthlyMinor },
  elite: { ...PRICING.elite, priceMinor: PRICING.elite.monthlyMinor },
};

export type Capability =
  | "ai.chat"
  | "ai.plan"
  | "economy.tracker"
  | "map.all-layers"
  | "creator.lab"
  | "alerts";

const MATRIX: Record<Capability, Tier[]> = {
  "ai.chat": ["free", "pro", "elite"],
  "ai.plan": ["pro", "elite"],
  "economy.tracker": ["pro", "elite"],
  "map.all-layers": ["pro", "elite"],
  "creator.lab": ["elite"],
  alerts: ["elite"],
};

export function can(tier: Tier, capability: Capability): boolean {
  return MATRIX[capability].includes(tier);
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  reason?: "daily-limit" | "insufficient-credits" | "tier" | "cost-cap";
}

/**
 * Checks and consumes the daily AI quota.
 *
 * Two independent gates, either of which can refuse the request: the
 * advertised request count (dailyQueries), and — for paid tiers — the real
 * money spent so far today (DAILY_COST_CAP_MINOR). The count alone cannot
 * bound cost, because a request that fills its max_tokens ceiling costs far
 * more than a short one; the spend check is what actually stops a scripted
 * user maxing every response from costing more than their subscription.
 * Call recordUsageCost once the provider returns real usage to keep the
 * spend side of this current.
 */
export async function consumeQuery(userId: string, tier: Tier): Promise<QuotaResult> {
  const limit = TIERS[tier].dailyQueries;
  const store = getStore();

  const used = await store.getDailyQueries(userId);
  if (used >= limit) {
    return { allowed: false, used, limit, reason: "daily-limit" };
  }

  const costCapMinor = DAILY_COST_CAP_MINOR[tier];
  if (costCapMinor !== null) {
    const spentToday = await store.getDailySpend(userId);
    if (spentToday >= costCapMinor) {
      return { allowed: false, used, limit, reason: "cost-cap" };
    }
  }

  return { allowed: true, used: await store.bumpDailyQueries(userId), limit };
}

/**
 * Records what a call to the model actually cost, in minor currency units,
 * against the caller's daily spend total. Called after the provider returns
 * real token usage — never estimated up front, because the whole point is
 * that a request's cost is not knowable until the model has answered.
 */
export async function recordUsageCost(userId: string, costMinor: number): Promise<void> {
  if (costMinor <= 0) return;
  await getStore().bumpDailySpend(userId, Math.round(costMinor));
}

/** Cost in Lab Credits of each premium AI action. */
export const CREDIT_COST: Record<"money-plan" | "creator-lab", number> = {
  "money-plan": 3,
  "creator-lab": 2,
};
