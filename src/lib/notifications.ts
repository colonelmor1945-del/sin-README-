import "server-only";

import { ASSETS } from "@/lib/data/assets";
import { LAUNCH, countdownFrom } from "@/lib/data/launch";
import { NEWS } from "@/lib/data/news";
import { paybackDays, trendDelta } from "@/lib/calc";
import { moneyShort } from "@/lib/format";
import type { MoneyPlan, PlayerProfile, Provenance } from "@/lib/types";

/**
 * Notifications.
 *
 * The rule that decides whether something is worth sending: it must be about
 * **this player**. An asset they own moved. A step in their plan is now
 * cheaper. The launch they are counting down to crossed a milestone.
 *
 * Generic product news is not a notification, it is the intel feed, and putting
 * it in a bell is how a bell becomes something people permanently ignore. Every
 * generator below reads the player's own profile and plan, and returns nothing
 * when nothing about them changed.
 *
 * Notifications are derived on read rather than written on a schedule. The
 * inputs are the profile, the plan and the dataset, all of which are already
 * loaded, so there is nothing to keep in sync and nothing to backfill. When the
 * dataset starts moving hourly this becomes a stored table with the same shape.
 */

export type NotificationKind =
  | "launch"
  | "portfolio"
  | "opportunity"
  | "plan"
  | "credits"
  | "data";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where the reader goes to act on it. */
  href: string;
  /** Higher sorts first. Reserved for things that cost money to ignore. */
  priority: number;
  /** Set when the notification is about data confidence. */
  provenance?: Provenance;
}

export const KIND_META: Record<NotificationKind, { label: string; blurb: string }> = {
  launch: { label: "Launch", blurb: "Milestones on the countdown." },
  portfolio: { label: "Portfolio", blurb: "Assets you own moved." },
  opportunity: { label: "Opportunity", blurb: "Something you do not own got cheaper or better." },
  plan: { label: "Plan", blurb: "Your active plan needs attention." },
  credits: { label: "Credits", blurb: "You are running low." },
  data: { label: "Data", blurb: "Confidence changed on something you rely on." },
};

/** Days out at which the launch is worth mentioning once. */
const MILESTONES = [100, 60, 30, 14, 7, 3, 1];

export function buildNotifications({
  profile,
  plan,
  credits,
  now = Date.now(),
}: {
  profile: PlayerProfile;
  plan: MoneyPlan | null;
  credits: number;
  now?: number;
}): Notification[] {
  const out: Notification[] = [];

  /* Launch ------------------------------------------------------------- */

  const clock = countdownFrom(LAUNCH.target, now);
  if (!clock.released) {
    // Fires on the day a milestone is crossed, not every day after it.
    const milestone = MILESTONES.find((m) => m === clock.days);
    if (milestone) {
      out.push({
        id: `launch-${milestone}`,
        kind: "launch",
        title:
          milestone === 1
            ? "One day to launch"
            : `${milestone} days to launch`,
        body:
          milestone <= 7
            ? "The dataset gets rebuilt from verified sources the week the game ships. Check your profile is current so your plan is ready."
            : "Nothing in the dataset is verified yet. That changes at launch.",
        href: "/dashboard/profile",
        priority: milestone <= 7 ? 80 : 40,
        provenance: LAUNCH.provenance,
      });
    }
  }

  /* Portfolio ------------------------------------------------------------ */

  const owned = ASSETS.filter((a) => profile.ownedAssetIds.includes(a.id));

  for (const asset of owned) {
    const delta = trendDelta(asset);
    // Five percent is the threshold below which a move is noise, and above
    // which it changes what the asset is worth holding.
    if (Math.abs(delta) < 0.05) continue;

    out.push({
      id: `portfolio-${asset.id}`,
      kind: "portfolio",
      title: `${asset.name} is ${delta > 0 ? "up" : "down"} ${Math.abs(delta * 100).toFixed(1)}%`,
      body:
        delta > 0
          ? `Now ${moneyShort(asset.price)}. You own this, so the move is in your favour on paper. It changes nothing about the income it produces.`
          : `Now ${moneyShort(asset.price)}. You own this. The daily net is unchanged, so this only matters if you were planning to sell.`,
      href: "/dashboard/economy",
      priority: delta < 0 ? 60 : 30,
      provenance: asset.provenance,
    });
  }

  /* Opportunity ---------------------------------------------------------- */

  const affordable = ASSETS.filter(
    (a) =>
      !profile.ownedAssetIds.includes(a.id) &&
      a.dailyNet > 0 &&
      a.unlockLevel <= profile.level &&
      a.price <= profile.currentMoney,
  ).sort((a, b) => (paybackDays(a) ?? 1e9) - (paybackDays(b) ?? 1e9));

  const best = affordable[0];
  if (best) {
    out.push({
      id: `opportunity-${best.id}`,
      kind: "opportunity",
      title: `You can afford the ${best.name}`,
      body: `${moneyShort(best.price)}, and it repays that in about ${paybackDays(best)?.toFixed(1)} in-game days. Nothing you can currently buy repays capital faster.`,
      href: "/dashboard/economy",
      priority: 70,
      provenance: best.provenance,
    });
  }

  /* Plan ----------------------------------------------------------------- */

  if (plan) {
    const remaining = plan.steps.filter((s) => !s.done);
    const next = remaining[0];

    if (remaining.length === 0) {
      out.push({
        id: `plan-complete-${plan.id}`,
        kind: "plan",
        title: "Your plan is finished",
        body: "Every step is ticked. Update your balance and generate a new one against your current position.",
        href: "/dashboard/plan",
        priority: 75,
      });
    } else if (next && next.requiredCash > profile.currentMoney) {
      // The most useful plan notification: the next step is blocked and the
      // player may not have noticed why.
      out.push({
        id: `plan-blocked-${plan.id}-${next.order}`,
        kind: "plan",
        title: `Step ${next.order} needs more cash`,
        body: `"${next.title}" needs ${moneyShort(next.requiredCash)} on hand and you have ${moneyShort(profile.currentMoney)}. Run the step before it, or regenerate the plan from where you are now.`,
        href: "/dashboard/plan",
        priority: 85,
        provenance: plan.provenance,
      });
    }
  } else {
    out.push({
      id: "plan-none",
      kind: "plan",
      title: "You have no active plan",
      body: "The planner turns your balance, level and goal into an ordered route split across three horizons.",
      href: "/dashboard/plan",
      priority: 35,
    });
  }

  /* Credits -------------------------------------------------------------- */

  if (credits <= 3) {
    out.push({
      id: "credits-low",
      kind: "credits",
      title: credits === 0 ? "You are out of Lab Credits" : `${credits} Lab Credits left`,
      body: "A money plan costs 3 and a creator package costs 2. Packs start at 10 credits, and pack credits never expire.",
      href: "/dashboard/settings",
      priority: credits === 0 ? 65 : 25,
    });
  }

  /* Data confidence ------------------------------------------------------ */

  // Intel entries that touch something the player owns. This is the one that
  // makes the feed worth having: it reaches them only when it is their problem.
  for (const item of NEWS) {
    const hit = owned.find((a) => item.affects.includes(a.name));
    if (!hit) continue;

    out.push({
      id: `data-${item.id}`,
      kind: "data",
      title: `New intel on the ${hit.name}`,
      body: item.impact,
      href: "/dashboard/news",
      priority: item.provenance === "ai-projection" ? 20 : 55,
      provenance: item.provenance,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
