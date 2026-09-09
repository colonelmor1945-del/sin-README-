import "server-only";

import { getStore } from "@/lib/db/store";
import { PRICING } from "@/lib/pricing";
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
  reason?: "daily-limit" | "insufficient-credits" | "tier";
}

/** Checks and consumes the daily AI quota. Free tier only. */
export async function consumeQuery(userId: string, tier: Tier): Promise<QuotaResult> {
  const limit = TIERS[tier].dailyQueries;
  const store = getStore();

  const used = await store.getDailyQueries(userId);
  if (used >= limit) {
    return { allowed: false, used, limit, reason: "daily-limit" };
  }
  return { allowed: true, used: await store.bumpDailyQueries(userId), limit };
}

/** Cost in Lab Credits of each premium AI action. */
export const CREDIT_COST: Record<"money-plan" | "creator-lab", number> = {
  "money-plan": 3,
  "creator-lab": 2,
};
