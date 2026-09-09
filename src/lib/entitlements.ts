import "server-only";

import { getStore } from "@/lib/db/store";
import type { Tier } from "@/lib/types";

/**
 * Entitlements and quotas.
 *
 * Every gate is evaluated on the server against the tier stored in the
 * database. The client is told what it may show, never what it may do.
 */

export const TIERS: Record<
  Tier,
  {
    label: string;
    priceMinor: number;
    dailyQueries: number | "unlimited";
    features: string[];
    monthlyCredits: number;
  }
> = {
  free: {
    label: "Free",
    priceMinor: 0,
    dailyQueries: 5,
    monthlyCredits: 5,
    features: [
      "5 AI queries a day",
      "Money calculator",
      "Mission list, basic fields",
      "Map, missions layer only",
    ],
  },
  pro: {
    label: "Pro",
    priceMinor: 499,
    dailyQueries: "unlimited",
    monthlyCredits: 60,
    features: [
      "Unlimited AI queries",
      "Personalised money plans",
      "Full mission intelligence",
      "Economy tracker",
      "All map layers and filters",
    ],
  },
  elite: {
    label: "Elite",
    priceMinor: 999,
    dailyQueries: "unlimited",
    monthlyCredits: 200,
    features: [
      "Everything in Pro",
      "Creator Lab",
      "Wealth and portfolio tracking",
      "Investment alerts",
      "Priority model effort",
    ],
  },
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
  limit: number | "unlimited";
  reason?: "daily-limit" | "insufficient-credits" | "tier";
}

/** Checks and consumes the daily AI quota. Free tier only. */
export async function consumeQuery(userId: string, tier: Tier): Promise<QuotaResult> {
  const limit = TIERS[tier].dailyQueries;
  const store = getStore();

  if (limit === "unlimited") {
    const used = await store.bumpDailyQueries(userId);
    return { allowed: true, used, limit };
  }

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
