import { describe, expect, it } from "vitest";

import {
  candidatesFor,
  effectiveHourly,
  hourlyRange,
  isTightRange,
  missionLevelGate,
  moneyPerHour,
  moneyPerMinute,
  monthlyReturn,
  paybackDays,
  paybackRange,
  projectGoal,
  rankAssetsByEfficiency,
  riskAdjustedPayout,
  sortMissions,
  sustainableHourly,
  trendDelta,
} from "@/lib/calc";
import type { Asset, Mission } from "@/lib/types";

/**
 * Tests for the analytical core.
 *
 * Every figure the product shows comes out of this file, and the platform's
 * whole claim is that those figures are checkable. So these assert the
 * *properties* that make the numbers trustworthy, not just that the arithmetic
 * runs: that ordering matches what a list says it is ordered by, that risk
 * adjustment can only ever reduce a payout, that a range's low end really is
 * the low end.
 *
 * Fixtures are built here rather than imported from the seed data. A test that
 * reads the real dataset starts failing the day someone edits a price, which
 * teaches the team to ignore it.
 */

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: "m",
  name: "Test mission",
  strand: "Test",
  payout: 100_000,
  duration: 30,
  difficulty: 3,
  crewRequired: 1,
  bestStrategy: "Stealth",
  prerequisites: [],
  region: "Vice City",
  image: "",
  tips: [],
  provenance: "community",
  ...over,
});

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: "a",
  name: "Test asset",
  category: "business",
  price: 1_000_000,
  dailyNet: 100_000,
  upkeep: 0,
  trend: "flat",
  advice: "hold",
  history: [1_000_000, 1_000_000],
  unlockLevel: 1,
  region: "Vice City",
  note: "",
  provenance: "community",
  ...over,
});

describe("mission rates", () => {
  it("converts payout and duration into per-minute and per-hour", () => {
    const m = mission({ payout: 90_000, duration: 30 });
    expect(moneyPerMinute(m)).toBe(3_000);
    expect(moneyPerHour(m)).toBe(180_000);
  });

  it("never lets risk adjustment increase a payout", () => {
    // The property that matters: adjusting for failure can only cost you.
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      const m = mission({ difficulty });
      expect(riskAdjustedPayout(m)).toBeLessThan(m.payout);
    }
  });

  it("penalises harder missions more", () => {
    const easy = riskAdjustedPayout(mission({ difficulty: 1 }));
    const hard = riskAdjustedPayout(mission({ difficulty: 5 }));
    expect(hard).toBeLessThan(easy);
  });

  it("splits the payout across the crew a mission needs", () => {
    const solo = effectiveHourly(mission({ crewRequired: 1 }));
    const trio = effectiveHourly(mission({ crewRequired: 3 }));
    // Same mission, three ways: each player sees a third.
    expect(trio).toBeCloseTo(solo / 3, 5);
  });

  it("keeps the effective rate at or below the raw rate", () => {
    const m = mission({ difficulty: 4, crewRequired: 2 });
    expect(effectiveHourly(m)).toBeLessThan(moneyPerHour(m));
  });
});

describe("sortMissions", () => {
  const set = [
    mission({ id: "slow-rich", payout: 500_000, duration: 120, difficulty: 5 }),
    mission({ id: "fast-poor", payout: 40_000, duration: 10, difficulty: 1 }),
    mission({ id: "middle", payout: 150_000, duration: 40, difficulty: 3 }),
  ];

  it("orders by payout when asked for highest reward", () => {
    expect(sortMissions(set, "highest-reward").map((m) => m.id)).toEqual([
      "slow-rich",
      "middle",
      "fast-poor",
    ]);
  });

  it("orders by duration when asked for fastest", () => {
    expect(sortMissions(set, "fastest")[0].id).toBe("fast-poor");
  });

  it("orders by difficulty when asked for easiest", () => {
    expect(sortMissions(set, "easiest")[0].id).toBe("fast-poor");
  });

  it("orders by the same figure the UI prints as best hourly", () => {
    // This is the regression that shipped once: the list sorted on raw hourly
    // while every row displayed the risk-adjusted number, so the order looked
    // wrong to anyone reading it.
    const sorted = sortMissions(set, "best-hourly");
    for (let i = 1; i < sorted.length; i++) {
      expect(effectiveHourly(sorted[i - 1])).toBeGreaterThanOrEqual(
        effectiveHourly(sorted[i]),
      );
    }
  });

  it("does not mutate the array it is given", () => {
    const original = [...set];
    sortMissions(set, "highest-reward");
    expect(set).toEqual(original);
  });
});

describe("asset economics", () => {
  it("computes payback as price over daily net", () => {
    expect(paybackDays(asset({ price: 1_000_000, dailyNet: 100_000 }))).toBe(10);
  });

  it("returns null for assets that produce no income", () => {
    // A vehicle is not an investment, and dividing by zero would say otherwise.
    expect(paybackDays(asset({ dailyNet: 0 }))).toBeNull();
    expect(monthlyReturn(asset({ dailyNet: 0 }))).toBeNull();
  });

  it("ranks the fastest payback first and sinks income-less assets", () => {
    const ranked = rankAssetsByEfficiency([
      asset({ id: "slow", price: 2_000_000, dailyNet: 50_000 }),
      asset({ id: "none", dailyNet: 0 }),
      asset({ id: "fast", price: 500_000, dailyNet: 100_000 }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(["fast", "slow", "none"]);
  });

  it("reads a price trend as a signed fraction", () => {
    expect(trendDelta(asset({ history: [100, 150] }))).toBeCloseTo(0.5, 5);
    expect(trendDelta(asset({ history: [200, 100] }))).toBeCloseTo(-0.5, 5);
    expect(trendDelta(asset({ history: [] }))).toBe(0);
  });
});

describe("ranges", () => {
  it("puts the low end below the high end and leads with the cautious one", () => {
    const range = hourlyRange(mission({ difficulty: 4, crewRequired: 2 }));
    expect(range.low).toBeLessThan(range.high);
    // Hourly leads with the low end: the product should undersell.
    expect(range.point).toBe(range.low);
  });

  it("leads payback with the pessimistic end, which is the longer one", () => {
    const range = paybackRange(asset())!;
    expect(range.low).toBeLessThan(range.high);
    // A longer payback is the worse case, so that is what gets quoted.
    expect(range.point).toBe(range.high);
  });

  it("returns no payback range for an asset with no income", () => {
    expect(paybackRange(asset({ dailyNet: 0 }))).toBeNull();
  });

  it("collapses a range that is too tight to change a decision", () => {
    // Difficulty 1 solo: the two ends are within a couple of percent, so
    // printing both adds noise rather than information.
    expect(isTightRange(hourlyRange(mission({ difficulty: 1, crewRequired: 1 })))).toBe(
      true,
    );
    expect(isTightRange(hourlyRange(mission({ difficulty: 5, crewRequired: 3 })))).toBe(
      false,
    );
  });

  it("always explains what each end assumes", () => {
    expect(hourlyRange(mission()).basis.length).toBeGreaterThan(20);
    expect(paybackRange(asset())!.basis.length).toBeGreaterThan(20);
  });
});

describe("level gating", () => {
  it("reads a level requirement out of a prerequisite string", () => {
    expect(missionLevelGate(mission({ prerequisites: ["Reach level 12"] }))).toBe(12);
  });

  it("defaults to level 1 when nothing gates it", () => {
    expect(missionLevelGate(mission({ prerequisites: [] }))).toBe(1);
    expect(missionLevelGate(mission({ prerequisites: ["Own a boat"] }))).toBe(1);
  });
});

describe("projectGoal", () => {
  it("divides the gap by the hourly rate", () => {
    const p = projectGoal(2_000_000, 10_000_000, 500_000);
    expect(p.gap).toBe(8_000_000);
    expect(p.hoursNeeded).toBe(16);
    expect(p.minutesNeeded).toBe(960);
    expect(p.reachable).toBe(true);
  });

  it("reports a met goal as no gap rather than a negative one", () => {
    expect(projectGoal(10_000_000, 5_000_000, 100_000).gap).toBe(0);
  });

  it("marks a goal unreachable rather than dividing by zero", () => {
    const p = projectGoal(0, 1_000_000, 0);
    expect(p.reachable).toBe(false);
    expect(p.hoursNeeded).toBe(Infinity);
  });
});

describe("sustainableHourly", () => {
  const missions = [
    mission({ id: "early", payout: 50_000, duration: 30, prerequisites: [] }),
    mission({ id: "late", payout: 500_000, duration: 30, prerequisites: ["Reach level 40"] }),
  ];

  it("ignores missions the player has not unlocked", () => {
    const low = sustainableHourly(missions, [], 5);
    const high = sustainableHourly(missions, [], 50);
    expect(high).toBeGreaterThan(low);
  });

  it("adds passive income from owned assets", () => {
    const without = sustainableHourly(missions, [], 50);
    const withAsset = sustainableHourly(missions, [asset({ dailyNet: 80_000 })], 50);
    expect(withAsset).toBeGreaterThan(without);
  });
});

describe("candidatesFor", () => {
  const missions = [
    mission({ id: "gentle", difficulty: 2, crewRequired: 1 }),
    mission({ id: "brutal", difficulty: 5, crewRequired: 4 }),
  ];
  const assets = [
    asset({ id: "cheap", price: 500_000 }),
    asset({ id: "dear", price: 5_000_000 }),
  ];

  it("keeps difficulty 4 and 5 out of the safest strategy", () => {
    const { missions: safe } = candidatesFor("safest", missions, assets);
    expect(safe.map((m) => m.id)).toEqual(["gentle"]);
  });

  it("keeps crew missions out of the solo strategy", () => {
    const { missions: solo } = candidatesFor("solo", missions, assets);
    expect(solo.every((m) => m.crewRequired === 1)).toBe(true);
  });

  it("caps purchases in the low investment strategy", () => {
    const { assets: cheap } = candidatesFor("low-investment", missions, assets);
    expect(cheap.every((a) => a.price <= 1_000_000)).toBe(true);
  });

  it("leaves everything available to the multiplayer strategy", () => {
    const { missions: all } = candidatesFor("multiplayer", missions, assets);
    expect(all).toHaveLength(missions.length);
  });
});
