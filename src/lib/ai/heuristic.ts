import type { AiProvider } from "@/lib/ai/provider";
import { ASSETS } from "@/lib/data/assets";
import { CREATOR_IDEAS } from "@/lib/data/creator";
import { MISSIONS } from "@/lib/data/missions";
import {
  candidatesFor,
  effectiveHourly,
  missionLevelGate,
  paybackDays,
  rankAssetsByEfficiency,
  sortMissions,
} from "@/lib/calc";
import { money, moneyShort } from "@/lib/format";
import type { CreatorIdea, MoneyPlan, PlanStep, PlayerProfile } from "@/lib/types";

/**
 * Deterministic provider used when no API key is configured.
 *
 * This is not a stub. It runs the same formulas the Claude provider is asked
 * to reason over, so the product is fully usable offline and the model output
 * has a baseline to be compared against.
 */
export const heuristicProvider: AiProvider = {
  id: "heuristic",
  label: "Local analyst (no API key)",

  async *chat({ messages, profile }) {
    const question = messages[messages.length - 1]?.content ?? "";
    const text = answer(question, profile);
    // Chunk it so the UI exercises the same streaming path as the real model.
    for (const chunk of text.match(/[\s\S]{1,28}/g) ?? []) {
      await new Promise((r) => setTimeout(r, 14));
      yield chunk;
    }
  },

  async generatePlan({ profile }) {
    return buildPlan(profile);
  },

  async creatorIdea({ topic }): Promise<CreatorIdea> {
    const seed =
      CREATOR_IDEAS.find((i) =>
        i.topic.toLowerCase().includes(topic.toLowerCase().slice(0, 8)),
      ) ?? CREATOR_IDEAS[0];
    return { ...seed, topic };
  },
};

/* Planner ---------------------------------------------------------------- */

function buildPlan(profile: PlayerProfile): MoneyPlan {
  const pool = candidatesFor(profile.playstyle, MISSIONS, ASSETS);
  const unlocked = pool.missions.filter((m) => missionLevelGate(m) <= profile.level);
  const ranked = sortMissions(unlocked.length ? unlocked : pool.missions, "best-hourly");
  const affordable = rankAssetsByEfficiency(
    pool.assets.filter((a) => a.unlockLevel <= profile.level && a.dailyNet > 0),
  );

  const steps: PlanStep[] = [];
  let cash = profile.currentMoney;
  let order = 1;

  // 1. Bank a run of the best unlocked mission to build the buying float.
  const opener = ranked[0];
  if (opener) {
    const runs = Math.max(1, Math.ceil((affordable[0]?.price ?? 750_000) / opener.payout / 2));
    const profit = opener.payout * runs;
    steps.push({
      order: order++,
      horizon: "short",
      title: `Run ${opener.name}${runs > 1 ? ` x${runs}` : ""}`,
      detail: `${moneyShort(effectiveHourly(opener))} per hour risk adjusted, the best rate unlocked at level ${profile.level}. Use the ${opener.bestStrategy.toLowerCase()} route.`,
      kind: "mission",
      estMinutes: opener.duration * runs,
      estProfit: profit,
      requiredCash: 0,
    });
    cash += profit;
  }

  // 2. Buy the fastest-payback asset the player can now afford.
  const firstBuy = affordable.find((a) => a.price <= cash);
  if (firstBuy) {
    const pb = paybackDays(firstBuy);
    steps.push({
      order: order++,
      horizon: "short",
      title: `Buy the ${firstBuy.name}`,
      detail: `Payback in about ${pb?.toFixed(1)} in-game days, the shortest of anything you can afford. Net ${moneyShort(firstBuy.dailyNet)} a day after upkeep.`,
      kind: "purchase",
      estMinutes: 10,
      estProfit: -firstBuy.price,
      requiredCash: firstBuy.price,
    });
    cash -= firstBuy.price;
  }

  // 3. Grind the repeatable loop while the asset accrues.
  const grind = ranked.find((m) => m.duration <= 30) ?? ranked[0];
  if (grind) {
    const runs = 6;
    const profit = grind.payout * runs + (firstBuy?.dailyNet ?? 0) * 4;
    steps.push({
      order: order++,
      horizon: "medium",
      title: `Loop ${grind.name} while the business accrues`,
      detail: `Six runs at ${grind.duration} minutes each. Passive income from step ${order - 2} stacks on top of this.`,
      kind: "grind",
      estMinutes: grind.duration * runs,
      estProfit: profit,
      requiredCash: 0,
    });
    cash += profit;
  }

  // 4. Scale into the highest-income asset once the float allows it.
  const scaleTarget = rankAssetsByEfficiency(pool.assets)
    .filter((a) => a.dailyNet > (firstBuy?.dailyNet ?? 0) && a.id !== firstBuy?.id)
    .sort((a, b) => b.dailyNet - a.dailyNet)[0];
  if (scaleTarget) {
    steps.push({
      order: order++,
      horizon: "long",
      title: `Move up to the ${scaleTarget.name}`,
      detail:
        scaleTarget.unlockLevel > profile.level
          ? `Unlocks at level ${scaleTarget.unlockLevel}. Keep running step ${order - 2} until you get there, then buy in at ${moneyShort(scaleTarget.price)}.`
          : `Costs ${moneyShort(scaleTarget.price)} and nets ${moneyShort(scaleTarget.dailyNet)} a day. This is the step that changes the curve.`,
      kind: "investment",
      estMinutes: 15,
      estProfit: -scaleTarget.price,
      requiredCash: scaleTarget.price,
    });
  }

  // 5. Close the remaining gap with the highest payout available.
  const closer = sortMissions(pool.missions, "highest-reward")[0];
  const remaining = Math.max(0, profile.goal - cash);
  if (closer && remaining > 0) {
    const runs = Math.max(1, Math.ceil(remaining / closer.payout));
    steps.push({
      order: order++,
      horizon: "long",
      title: `Close the gap with ${closer.name}`,
      detail: `About ${runs} run${runs > 1 ? "s" : ""} at ${moneyShort(closer.payout)} each, on top of passive income, covers the remaining ${moneyShort(remaining)}.`,
      kind: "mission",
      estMinutes: closer.duration * runs,
      estProfit: closer.payout * runs,
      requiredCash: 0,
    });
  }

  return {
    id: crypto.randomUUID(),
    objective: profile.goal,
    startingCash: profile.currentMoney,
    strategy: profile.playstyle,
    summary: `Front-load one high-rate mission to build a float, convert it into the fastest-payback asset you can afford, then let passive income carry you while you loop the short mission. The plan assumes you play the ${profile.playstyle.replace("-", " ")} route.`,
    steps,
    risks: [
      "Every figure comes from placeholder data. Nothing here is verified against a shipped build of the game.",
      "Payback periods assume you keep businesses supplied. Skipping resupply runs roughly halves the daily net.",
      scaleTarget && scaleTarget.unlockLevel > profile.level
        ? `The scaling step is gated at level ${scaleTarget.unlockLevel} and you are level ${profile.level}. The time estimate does not include the levelling grind.`
        : "Crew-dependent missions lose payout when a run fails. Solo players should expect the slower end of the range.",
    ],
    provenance: "ai-projection",
    generatedBy: "heuristic",
    createdAt: new Date().toISOString(),
  };
}

/* Q&A ------------------------------------------------------------------- */

function answer(question: string, profile: PlayerProfile): string {
  const q = question.toLowerCase();
  const best = sortMissions(MISSIONS, "best-hourly")[0];
  const cheapestPayback = rankAssetsByEfficiency(ASSETS.filter((a) => a.dailyNet > 0))[0];
  const disclaimer =
    "\n\nAll figures come from placeholder data authored for this prototype. None of it is verified against a shipped build.";

  if (q.includes("buy") || q.includes("business") || q.includes("invest")) {
    const pb = paybackDays(cheapestPayback);
    const affordable = cheapestPayback.price <= profile.currentMoney;
    return `Buy the ${cheapestPayback.name} first. At ${money(cheapestPayback.price)} it nets ${money(cheapestPayback.dailyNet)} per in-game day after upkeep, which is a payback period of about ${pb?.toFixed(1)} days. Nothing else in the dataset repays capital faster.

${
  affordable
    ? `You have ${money(profile.currentMoney)}, so you can buy it now.`
    : `You are ${money(cheapestPayback.price - profile.currentMoney)} short. Two runs of ${best.name} covers the gap.`
} The nightclub looks better on paper because of its headline income, but it costs ${money(ASSETS.find((a) => a.id === "vice-nightclub")!.price)} and carries the heaviest upkeep in the set.${disclaimer}`;
  }

  if (q.includes("mission") || q.includes("hour") || q.includes("fast")) {
    const gated = missionLevelGate(best);
    return `${best.name} is the best rate in the dataset at ${money(effectiveHourly(best))} per hour once failure risk and crew splits are accounted for. It runs ${best.duration} minutes at difficulty ${best.difficulty} of 5, and the ${best.bestStrategy.toLowerCase()} route is the one that holds up.

${
  gated > profile.level
    ? `It gates at level ${gated} and you are level ${profile.level}, so start with Gator Run instead. No wanted level, fourteen minutes, and it is the fastest clean income in the early game.`
    : `You are level ${profile.level}, so it is already unlocked. Run it before anything else.`
}${disclaimer}`;
  }

  if (q.includes("goal") || q.includes("million") || q.includes("how long")) {
    const gap = Math.max(0, profile.goal - profile.currentMoney);
    const hourly = effectiveHourly(best);
    return `You need ${money(gap)} more. At ${money(hourly)} per hour from ${best.name}, that is roughly ${(gap / hourly).toFixed(1)} hours of pure mission grinding.

That number drops once passive income is running. Buying the ${cheapestPayback.name} early adds ${money(cheapestPayback.dailyNet)} per in-game day, which compounds while you play. Generate a full plan from the Money Plan page to see the ordered route.${disclaimer}`;
  }

  return `I can help with mission selection, business purchases, payback periods and routes to a cash goal.

Right now you are level ${profile.level} with ${money(profile.currentMoney)} and a goal of ${money(profile.goal)}. The two things worth knowing: ${best.name} is the best money per hour in the dataset, and the ${cheapestPayback.name} is the fastest capital payback. Ask me about either.${disclaimer}`;
}
