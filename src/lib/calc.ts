import type { Asset, Mission, PlanStrategy } from "@/lib/types";

/**
 * The analytical core. Pure functions, no I/O, no framework.
 *
 * Everything the AI says should be reproducible here. When the assistant
 * claims a payback period, it is quoting one of these functions rather than
 * inventing a number, which is what keeps the product defensible.
 */

/* Missions -------------------------------------------------------------- */

export const moneyPerMinute = (m: Mission) => m.payout / m.duration;
export const moneyPerHour = (m: Mission) => moneyPerMinute(m) * 60;

/** Payout adjusted for the expected cost of failure at this difficulty. */
export function riskAdjustedPayout(m: Mission): number {
  // Difficulty 1 loses ~2% to failed attempts, difficulty 5 loses ~26%.
  const failureDrag = 0.02 + (m.difficulty - 1) * 0.06;
  return m.payout * (1 - failureDrag);
}

/** Money per hour once crew splits and failure risk are accounted for. */
export function effectiveHourly(m: Mission, crewSize = m.crewRequired): number {
  const share = crewSize > 1 ? 1 / crewSize : 1;
  return (riskAdjustedPayout(m) * share) / (m.duration / 60);
}

/* Ranges ----------------------------------------------------------------- */

/**
 * A bounded estimate.
 *
 * Nothing in this product knows a rate precisely enough to quote a single
 * number, so anything the player might plan around is expressed as a range
 * with both ends explained. `point` is the end we lead with, and it is always
 * the conservative one: the product should undersell rather than oversell.
 */
export interface Estimate {
  low: number;
  high: number;
  point: number;
  /** Plain-language description of what each end assumes. */
  basis: string;
}

/**
 * Hourly rate range for a mission.
 *
 * Low end is the expected value: average failure drag at this difficulty, and
 * the payout split across the crew the mission needs. High end is a clean run
 * with no failures and no split, which is what a solo player who never wipes
 * would see. Real play lands between them.
 */
export function hourlyRange(m: Mission, crewSize = m.crewRequired): Estimate {
  const low = effectiveHourly(m, crewSize);
  const high = moneyPerHour(m);
  return {
    low,
    high,
    point: low,
    basis:
      m.crewRequired > 1
        ? `Low assumes average failed runs at difficulty ${m.difficulty} and a ${m.crewRequired} way split. High assumes clean runs and the full payout.`
        : `Low assumes average failed runs at difficulty ${m.difficulty}. High assumes clean runs with no losses.`,
  };
}

/**
 * Payback period range for an asset, in in-game days.
 *
 * Businesses decay when you skip resupply runs, and community reports put the
 * drop at roughly half the daily net. Low is a fully supplied business, high
 * is one you never resupply.
 */
export function paybackRange(a: Asset): Estimate | null {
  if (a.dailyNet <= 0) return null;
  const low = a.price / a.dailyNet;
  const high = a.price / (a.dailyNet * 0.5);
  return {
    low,
    high,
    // Lead with the pessimistic end here: a longer payback is the worse case.
    point: high,
    basis:
      "Low assumes you keep the business supplied. High assumes you skip resupply runs, which roughly halves the daily net.",
  };
}

/** True when the two ends are close enough that a range adds no information. */
export const isTightRange = (e: Estimate) => e.high - e.low < e.low * 0.08;

export type MissionSort =
  | "recommended"
  | "highest-reward"
  | "best-hourly"
  | "easiest"
  | "fastest";

export function sortMissions(missions: Mission[], by: MissionSort): Mission[] {
  const list = [...missions];
  switch (by) {
    case "highest-reward":
      return list.sort((a, b) => b.payout - a.payout);
    case "best-hourly":
      // Sorts on the risk-adjusted figure, which is the one the product leads
      // with everywhere. Sorting on raw hourly while displaying the adjusted
      // number would put the list in an order the reader cannot verify.
      return list.sort((a, b) => effectiveHourly(b) - effectiveHourly(a));
    case "easiest":
      return list.sort((a, b) => a.difficulty - b.difficulty || b.payout - a.payout);
    case "fastest":
      return list.sort((a, b) => a.duration - b.duration);
    case "recommended":
    default:
      // Reward efficiency, then penalise difficulty and crew dependency.
      return list.sort((a, b) => recommendScore(b) - recommendScore(a));
  }
}

function recommendScore(m: Mission): number {
  const hourly = effectiveHourly(m);
  const soloBonus = m.crewRequired === 1 ? 1.15 : 1;
  const prereqDrag = 1 - m.prerequisites.length * 0.05;
  return hourly * soloBonus * prereqDrag;
}

/* Assets ---------------------------------------------------------------- */

/** In-game days until an asset has repaid its purchase price. */
export function paybackDays(a: Asset): number | null {
  if (a.dailyNet <= 0) return null;
  return a.price / a.dailyNet;
}

/** Annualised-style return, expressed per 30 in-game days. */
export function monthlyReturn(a: Asset): number | null {
  if (a.dailyNet <= 0) return null;
  return (a.dailyNet * 30) / a.price;
}

export function trendDelta(a: Asset): number {
  const first = a.history[0];
  const last = a.history[a.history.length - 1];
  if (!first) return 0;
  return (last - first) / first;
}

/** Ranks assets by capital efficiency, which is what a first purchase needs. */
export function rankAssetsByEfficiency(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const pa = paybackDays(a);
    const pb = paybackDays(b);
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pa - pb;
  });
}

/* Goal projection -------------------------------------------------------- */

export interface GoalProjection {
  gap: number;
  hourly: number;
  hoursNeeded: number;
  minutesNeeded: number;
  reachable: boolean;
}

export function projectGoal(
  currentMoney: number,
  goal: number,
  hourly: number,
): GoalProjection {
  const gap = Math.max(0, goal - currentMoney);
  const reachable = hourly > 0;
  const hoursNeeded = reachable ? gap / hourly : Infinity;
  return {
    gap,
    hourly,
    hoursNeeded,
    minutesNeeded: reachable ? hoursNeeded * 60 : Infinity,
    reachable,
  };
}

/**
 * Best sustainable hourly rate available to a player at a given level, using
 * the missions they have unlocked plus passive income from what they own.
 */
export function sustainableHourly(
  missions: Mission[],
  ownedAssets: Asset[],
  level: number,
): number {
  const unlocked = missions.filter((m) => missionLevelGate(m) <= level);
  const bestActive = unlocked.length
    ? Math.max(...unlocked.map((m) => effectiveHourly(m)))
    : 0;
  // One in-game day runs 48 real minutes, so daily net divided by 0.8 hours.
  const passive = ownedAssets.reduce((sum, a) => sum + a.dailyNet / 0.8, 0);
  return bestActive + passive;
}

/** Parses the level requirement out of a mission's prerequisite strings. */
export function missionLevelGate(m: Mission): number {
  for (const p of m.prerequisites) {
    const match = /level\s+(\d+)/i.exec(p);
    if (match) return Number(match[1]);
  }
  return 1;
}

/* Strategy weighting ----------------------------------------------------- */

export const STRATEGIES: { id: PlanStrategy; label: string; blurb: string }[] = [
  { id: "fastest-money", label: "Fastest money", blurb: "Shortest wall-clock route to the goal. Accepts risk." },
  { id: "safest", label: "Safest strategy", blurb: "Low difficulty only. Slower, almost no failed-run losses." },
  { id: "max-profit", label: "Maximum profit", blurb: "Optimises the end balance, not the time taken." },
  { id: "low-investment", label: "Low investment", blurb: "Keeps capital free. No purchase above 1M." },
  { id: "solo", label: "Solo player", blurb: "Single-crew content only. No payout splits." },
  { id: "multiplayer", label: "Multiplayer", blurb: "Assumes a reliable crew. Unlocks the high-payout finales." },
];

/** Filters the candidate pool a plan is allowed to draw from. */
export function candidatesFor(
  strategy: PlanStrategy,
  missions: Mission[],
  assets: Asset[],
): { missions: Mission[]; assets: Asset[] } {
  switch (strategy) {
    case "safest":
      return { missions: missions.filter((m) => m.difficulty <= 3), assets };
    case "low-investment":
      return { missions, assets: assets.filter((a) => a.price <= 1_000_000) };
    case "solo":
      return { missions: missions.filter((m) => m.crewRequired === 1), assets };
    case "multiplayer":
      return { missions, assets };
    case "max-profit":
      return { missions, assets: rankAssetsByEfficiency(assets) };
    case "fastest-money":
    default:
      return { missions: sortMissions(missions, "best-hourly"), assets };
  }
}
