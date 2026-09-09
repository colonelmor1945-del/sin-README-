import type { Tier } from "@/lib/types";

/**
 * Pricing and discounts.
 *
 * Two principles this file exists to enforce.
 *
 * The first is unit economics. Every paid action here runs a frontier model.
 * At roughly $5 per million input tokens and $25 per million output, a single
 * assistant answer costs a few cents once the dataset prefix is cached, and a
 * generated plan costs materially more because it runs at high effort with a
 * large output budget. A tier priced below what its heaviest users consume is
 * not generous, it is a tier that gets withdrawn later. The caps below are set
 * so the worst-case user on each tier still costs less than the tier charges.
 *
 * The second is that the word "unlimited" has to be true. The old copy said
 * unlimited while a rate limiter quietly said otherwise. Every tier now states
 * a number it actually honours.
 */

export interface TierPricing {
  label: string;
  /** Smallest currency unit, per month, billed monthly. */
  monthlyMinor: number;
  /** Smallest currency unit, per year. Works out cheaper per month. */
  yearlyMinor: number;
  /** Hard daily cap on assistant queries. Never the word "unlimited". */
  dailyQueries: number;
  monthlyCredits: number;
  features: string[];
}

export const PRICING: Record<Tier, TierPricing> = {
  free: {
    label: "Free",
    monthlyMinor: 0,
    yearlyMinor: 0,
    dailyQueries: 5,
    monthlyCredits: 5,
    features: [
      "5 AI queries a day",
      "Money calculator, every formula",
      "Mission list with payouts and times",
      "Map, missions layer",
      "Intel feed",
    ],
  },
  pro: {
    // Raised from 4.99. At the old price a heavy user consumed more in model
    // spend than the subscription brought in.
    monthlyMinor: 899,
    yearlyMinor: 8_990, // ten months for twelve
    label: "Pro",
    dailyQueries: 150,
    monthlyCredits: 80,
    features: [
      "150 AI queries a day",
      "Personalised money plans",
      "Full mission intelligence and all sorts",
      "Economy tracker with payback ranking",
      "Every map layer and filter",
      "Plan history",
    ],
  },
  elite: {
    label: "Elite",
    monthlyMinor: 1_599,
    yearlyMinor: 15_990,
    dailyQueries: 500,
    monthlyCredits: 260,
    features: [
      "Everything in Pro",
      "500 AI queries a day",
      "Creator Lab, full content packages",
      "Wealth and portfolio tracking",
      "Investment alerts",
      "Highest model effort on plans",
    ],
  },
};

/* Discounts -------------------------------------------------------------- */

export type DiscountKind =
  | "annual"
  | "founding"
  | "launch"
  | "referral"
  | "supporter";

export interface Discount {
  code: string;
  kind: DiscountKind;
  label: string;
  /** 0.2 means twenty percent off. */
  rate: number;
  /** Which tiers it applies to. */
  appliesTo: Tier[];
  /** ISO date after which the code stops working, or null for open-ended. */
  expiresAt: string | null;
  /** True when the rate is held for as long as the subscription runs. */
  locksForever: boolean;
  description: string;
}

/**
 * The founding discount is the one that matters commercially.
 *
 * The product is pre-launch, which is a weakness everywhere except here: a
 * price locked before the game ships is a reason to subscribe during the
 * months when the platform is least useful. It is also honest, because early
 * subscribers really are paying for a dataset that is still placeholder.
 */
export const DISCOUNTS: Discount[] = [
  {
    code: "FOUNDING",
    kind: "founding",
    label: "Founding member",
    rate: 0.4,
    appliesTo: ["pro", "elite"],
    // Closes when the game ships. After that the product is worth full price.
    expiresAt: "2026-11-19",
    locksForever: true,
    description:
      "Subscribe before GTA 6 ships and keep 40 percent off for as long as you stay subscribed. The dataset is placeholder until launch, and the price says so.",
  },
  {
    code: "LAUNCHWEEK",
    kind: "launch",
    label: "Launch week",
    rate: 0.25,
    appliesTo: ["pro", "elite"],
    expiresAt: "2026-11-26",
    locksForever: false,
    description: "Twenty five percent off the first year, launch week only.",
  },
  {
    code: "SUPPORTER",
    kind: "supporter",
    label: "Supporter",
    rate: 0.15,
    appliesTo: ["pro", "elite"],
    expiresAt: null,
    locksForever: true,
    description:
      "Anyone who has funded the Lab keeps fifteen percent off. Applied automatically, no code to remember.",
  },
  {
    code: "REFERRAL",
    kind: "referral",
    label: "Referral",
    rate: 0.1,
    appliesTo: ["pro", "elite"],
    expiresAt: null,
    locksForever: false,
    description:
      "Ten percent off for both people when a friend you invited subscribes.",
  },
];

export const discountByCode = (code: string) =>
  DISCOUNTS.find((d) => d.code === code.trim().toUpperCase());

export function isLive(discount: Discount, now = new Date()): boolean {
  if (!discount.expiresAt) return true;
  return now < new Date(`${discount.expiresAt}T23:59:59Z`);
}

export interface Quote {
  tier: Tier;
  cycle: "monthly" | "yearly";
  /** Before any discount. */
  listMinor: number;
  /** What the customer actually pays. */
  payableMinor: number;
  /** Equivalent monthly figure, for comparing cycles honestly. */
  perMonthMinor: number;
  savedMinor: number;
  applied: Discount[];
  locked: boolean;
}

/**
 * Resolves what a customer pays.
 *
 * Discounts do not stack multiplicatively into an arbitrarily small number.
 * The best single rate wins, and the annual cycle is priced into the yearly
 * figure rather than being another percentage on top. Anything else produces
 * combinations nobody modelled and a support queue asking why.
 */
export function quote({
  tier,
  cycle,
  codes = [],
  now = new Date(),
}: {
  tier: Tier;
  cycle: "monthly" | "yearly";
  codes?: string[];
  now?: Date;
}): Quote {
  const pricing = PRICING[tier];
  const listMinor = cycle === "yearly" ? pricing.yearlyMinor : pricing.monthlyMinor;

  const candidates = codes
    .map((code) => discountByCode(code))
    .filter((d): d is Discount => Boolean(d))
    .filter((d) => d.appliesTo.includes(tier))
    .filter((d) => isLive(d, now));

  const best = candidates.reduce<Discount | null>(
    (winner, d) => (!winner || d.rate > winner.rate ? d : winner),
    null,
  );

  const rate = best?.rate ?? 0;
  const payableMinor = Math.round(listMinor * (1 - rate));

  return {
    tier,
    cycle,
    listMinor,
    payableMinor,
    perMonthMinor: cycle === "yearly" ? Math.round(payableMinor / 12) : payableMinor,
    savedMinor: listMinor - payableMinor,
    applied: best ? [best] : [],
    locked: best?.locksForever ?? false,
  };
}

/** How much the yearly cycle saves against paying monthly, as a fraction. */
export function annualSaving(tier: Tier): number {
  const { monthlyMinor, yearlyMinor } = PRICING[tier];
  if (monthlyMinor === 0) return 0;
  return 1 - yearlyMinor / (monthlyMinor * 12);
}
