import { describe, expect, it } from "vitest";

import {
  CREDIT_PACKS,
  DAILY_COST_CAP_MINOR,
  DISCOUNTS,
  PRICING,
  annualSaving,
  costMinorForUsage,
  discountByCode,
  isLive,
  quote,
} from "@/lib/pricing";

/**
 * Tests for pricing.
 *
 * A bug here costs real money in one direction or trust in the other, so these
 * assert the commercial invariants rather than just the arithmetic: discounts
 * cannot stack, a pack cannot undercut the subscription, the annual cycle is
 * genuinely cheaper, and no tier promises more than it can afford to serve.
 */

const BEFORE_LAUNCH = new Date("2026-09-10T12:00:00Z");
const AFTER_LAUNCH = new Date("2026-12-01T12:00:00Z");

describe("tiers", () => {
  it("prices each tier above the one below it", () => {
    expect(PRICING.free.monthlyMinor).toBe(0);
    expect(PRICING.pro.monthlyMinor).toBeGreaterThan(PRICING.free.monthlyMinor);
    expect(PRICING.elite.monthlyMinor).toBeGreaterThan(PRICING.pro.monthlyMinor);
  });

  it("gives each tier more headroom than the one below it", () => {
    expect(PRICING.pro.dailyQueries).toBeGreaterThan(PRICING.free.dailyQueries);
    expect(PRICING.elite.dailyQueries).toBeGreaterThan(PRICING.pro.dailyQueries);
    expect(PRICING.elite.monthlyCredits).toBeGreaterThan(PRICING.pro.monthlyCredits);
  });

  it("states a finite daily cap on every tier", () => {
    // The word "unlimited" shipped once while a rate limiter said otherwise.
    // A number here is the fix, and it has to stay a number.
    for (const tier of Object.values(PRICING)) {
      expect(Number.isFinite(tier.dailyQueries)).toBe(true);
      expect(tier.dailyQueries).toBeGreaterThan(0);
    }
  });

  it("never advertises a feature list containing the word unlimited", () => {
    const copy = Object.values(PRICING)
      .flatMap((t) => t.features)
      .join(" ")
      .toLowerCase();
    expect(copy).not.toContain("unlimited");
  });
});

describe("daily cost cap", () => {
  // The header comment's exact claim: a worst-case user on a paid tier never
  // costs more in model spend than the tier charges. This is what the
  // dailyQueries count alone cannot enforce — see entitlements.test.ts for
  // the request-count side of the same invariant.
  it("bounds a month of maxed-out days below what the tier charges", () => {
    for (const tier of ["pro", "elite"] as const) {
      const cap = DAILY_COST_CAP_MINOR[tier];
      expect(cap).not.toBeNull();
      expect((cap as number) * 30).toBeLessThan(PRICING[tier].monthlyMinor);
    }
  });

  it("has no cost cap on free, which has no price to divide by", () => {
    expect(DAILY_COST_CAP_MINOR.free).toBeNull();
  });

  it("prices usage at the same per-million rates the header comment cites", () => {
    // $5 / million input, $25 / million output, from the file's own estimate.
    expect(costMinorForUsage({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(500);
    expect(costMinorForUsage({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(2_500);
    expect(costMinorForUsage({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("rounds up rather than letting a fractional cost disappear", () => {
    expect(costMinorForUsage({ inputTokens: 1, outputTokens: 0 })).toBe(1);
  });
});

describe("annual cycle", () => {
  it("is cheaper per month than paying monthly", () => {
    for (const tier of ["pro", "elite"] as const) {
      expect(annualSaving(tier)).toBeGreaterThan(0);
      expect(PRICING[tier].yearlyMinor).toBeLessThan(PRICING[tier].monthlyMinor * 12);
    }
  });

  it("reports no saving on a free tier rather than dividing by zero", () => {
    expect(annualSaving("free")).toBe(0);
  });
});

describe("quote", () => {
  it("charges list price when no code applies", () => {
    const q = quote({ tier: "pro", cycle: "monthly" });
    expect(q.payableMinor).toBe(PRICING.pro.monthlyMinor);
    expect(q.savedMinor).toBe(0);
    expect(q.applied).toHaveLength(0);
  });

  it("applies a live discount", () => {
    const q = quote({
      tier: "pro",
      cycle: "monthly",
      codes: ["FOUNDING"],
      now: BEFORE_LAUNCH,
    });
    expect(q.payableMinor).toBeLessThan(q.listMinor);
    expect(q.applied[0].code).toBe("FOUNDING");
  });

  it("takes the best single rate and never stacks", () => {
    // The invariant that keeps support out of arguments about combinations
    // nobody modelled.
    const q = quote({
      tier: "pro",
      cycle: "monthly",
      codes: ["FOUNDING", "SUPPORTER", "REFERRAL"],
      now: BEFORE_LAUNCH,
    });
    const best = Math.max(
      ...["FOUNDING", "SUPPORTER", "REFERRAL"].map((c) => discountByCode(c)!.rate),
    );
    expect(q.applied).toHaveLength(1);
    expect(q.payableMinor).toBe(Math.round(q.listMinor * (1 - best)));
  });

  it("ignores an expired code", () => {
    const q = quote({
      tier: "pro",
      cycle: "monthly",
      codes: ["FOUNDING"],
      now: AFTER_LAUNCH,
    });
    expect(q.applied).toHaveLength(0);
    expect(q.payableMinor).toBe(q.listMinor);
  });

  it("ignores a code that does not apply to the tier", () => {
    // Nothing discounts free, and a code that appears to would be a bug that
    // reads as a broken promise.
    const q = quote({
      tier: "free",
      cycle: "monthly",
      codes: ["FOUNDING"],
      now: BEFORE_LAUNCH,
    });
    expect(q.applied).toHaveLength(0);
    expect(q.payableMinor).toBe(0);
  });

  it("ignores an unknown code instead of throwing", () => {
    const q = quote({ tier: "pro", cycle: "monthly", codes: ["NOPE"] });
    expect(q.payableMinor).toBe(PRICING.pro.monthlyMinor);
  });

  it("reports the per-month figure for a yearly cycle", () => {
    const q = quote({ tier: "pro", cycle: "yearly" });
    expect(q.perMonthMinor).toBe(Math.round(PRICING.pro.yearlyMinor / 12));
    expect(q.perMonthMinor).toBeLessThan(PRICING.pro.monthlyMinor);
  });

  it("marks a locked rate as locked", () => {
    const q = quote({
      tier: "pro",
      cycle: "yearly",
      codes: ["FOUNDING"],
      now: BEFORE_LAUNCH,
    });
    expect(q.locked).toBe(true);
  });

  it("never produces a negative or fractional charge", () => {
    for (const tier of ["free", "pro", "elite"] as const) {
      for (const cycle of ["monthly", "yearly"] as const) {
        const q = quote({
          tier,
          cycle,
          codes: DISCOUNTS.map((d) => d.code),
          now: BEFORE_LAUNCH,
        });
        expect(q.payableMinor).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(q.payableMinor)).toBe(true);
      }
    }
  });
});

describe("discounts", () => {
  it("keeps every rate inside a sane range", () => {
    for (const d of DISCOUNTS) {
      expect(d.rate).toBeGreaterThan(0);
      // A discount above half is a price change, and should be priced as one.
      expect(d.rate).toBeLessThanOrEqual(0.5);
    }
  });

  it("treats an open-ended discount as always live", () => {
    const supporter = discountByCode("SUPPORTER")!;
    expect(supporter.expiresAt).toBeNull();
    expect(isLive(supporter, AFTER_LAUNCH)).toBe(true);
  });

  it("matches a code case-insensitively and ignores padding", () => {
    expect(discountByCode("  founding ")?.code).toBe("FOUNDING");
  });
});

describe("credit packs", () => {
  it("makes bigger packs cheaper per credit", () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.credits - b.credits);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].perCreditMinor).toBeLessThan(sorted[i - 1].perCreditMinor);
    }
  });

  it("never undercuts the credits included in a subscription", () => {
    // The commercial invariant: if a pack were cheaper per credit than Pro,
    // the rational move for a paying customer is to cancel and buy packs.
    const proPerCredit = PRICING.pro.monthlyMinor / PRICING.pro.monthlyCredits;
    for (const pack of CREDIT_PACKS) {
      expect(pack.perCreditMinor).toBeGreaterThan(proPerCredit);
    }
  });

  it("computes the unit rate it prints", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.perCreditMinor).toBeCloseTo(pack.priceMinor / pack.credits, 1);
    }
  });

  it("marks exactly one pack as best value", () => {
    expect(CREDIT_PACKS.filter((p) => p.bestValue)).toHaveLength(1);
  });
});
