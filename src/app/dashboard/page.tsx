import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { DataNotice, ProvenanceTag } from "@/components/ProvenanceTag";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { ProgressRing, Sparkline } from "@/components/ui/charts";
import { ButtonLink, Panel, PanelHead, Stat } from "@/components/ui/primitives";
import {
  effectiveHourly,
  paybackDays,
  projectGoal,
  rankAssetsByEfficiency,
  sortMissions,
  sustainableHourly,
  trendDelta,
} from "@/lib/calc";
import { ASSETS, assetById } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { clamp01, duration, money, moneyShort } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { userId } = await requireSession();
  const store = getStore();
  const [profile, plans] = await Promise.all([
    store.getProfile(userId),
    store.listPlans(userId),
  ]);

  const owned = profile.ownedAssetIds
    .map((id) => assetById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const hourly = sustainableHourly(MISSIONS, owned, profile.level);
  const projection = projectGoal(profile.currentMoney, profile.goal, hourly);
  const progress = clamp01(profile.currentMoney / profile.goal);

  const nextMove = sortMissions(MISSIONS, "recommended")[0];
  const bestBuy = rankAssetsByEfficiency(
    ASSETS.filter((a) => a.dailyNet > 0 && a.unlockLevel <= profile.level),
  )[0];

  const activePlan = plans[0];
  const completedSteps = activePlan?.steps.filter((s) => s.done).length ?? 0;
  const planProgress = activePlan ? completedSteps / activePlan.steps.length : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        lead="Where you stand, what moves next, and how long the rest of the route takes."
        action={
          <div className="flex flex-col items-end gap-2">
            <LaunchCountdown variant="compact" />
            <ButtonLink href="/dashboard/plan" size="sm">
              Generate a plan
            </ButtonLink>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-6 sm:px-8">
        {/* Objective and progress */}
        <Panel className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="grid flex-1 gap-6 sm:grid-cols-3">
              <Stat
                label="Objective"
                value={money(profile.goal)}
                tone="accent"
                sub={`Level ${profile.level}, ${profile.playstyle.replace("-", " ")} route`}
              />
              <Stat
                label="Current balance"
                value={money(profile.currentMoney)}
                sub={`${moneyShort(projection.gap)} to go`}
              />
              <Stat
                label="Sustainable rate"
                value={`${moneyShort(hourly)}/h`}
                sub={
                  projection.reachable
                    ? `About ${duration(projection.minutesNeeded)} of play left`
                    : "No unlocked income source"
                }
              />
            </div>
            <ProgressRing value={progress} caption="of goal" />
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Next best move */}
          <Panel>
            <PanelHead
              title="Your next best move"
              meta={<ProvenanceTag value={nextMove.provenance} size="xs" />}
            />
            <div className="p-5">
              <h3 className="text-lg font-medium text-ink">{nextMove.name}</h3>
              <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
                Best risk-adjusted rate available to you at{" "}
                <span className="tabular text-ink">{moneyShort(effectiveHourly(nextMove))} per hour</span>.
                Runs {nextMove.duration} minutes at difficulty {nextMove.difficulty} of 5,
                and the {nextMove.bestStrategy.toLowerCase()} route is the one that holds up.
              </p>

              <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                <Stat label="Payout" value={moneyShort(nextMove.payout)} />
                <Stat label="Duration" value={`${nextMove.duration}m`} />
                <Stat label="Crew" value={String(nextMove.crewRequired)} />
              </div>

              <Link
                href={`/dashboard/missions/${nextMove.id}`}
                className="mt-5 inline-block text-[13px] text-accent hover:text-accent-soft"
              >
                Open the full briefing
              </Link>
            </div>
          </Panel>

          {/* Best purchase */}
          <Panel>
            <PanelHead
              title="Best use of capital"
              meta={<ProvenanceTag value={bestBuy.provenance} size="xs" />}
            />
            <div className="p-5">
              <h3 className="text-base font-medium text-ink">{bestBuy.name}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {bestBuy.note}
              </p>

              <dl className="mt-5 space-y-3 border-t border-line pt-5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Price</dt>
                  <dd className="tabular text-ink">{money(bestBuy.price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Net a day</dt>
                  <dd className="tabular text-up">{money(bestBuy.dailyNet)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Payback</dt>
                  <dd className="tabular text-ink">
                    {paybackDays(bestBuy)?.toFixed(1)} in-game days
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-faint">Trend</dt>
                  <dd>
                    <Sparkline
                      values={bestBuy.history}
                      tone={trendDelta(bestBuy) > 0 ? "up" : "down"}
                      label={`${bestBuy.name} trend`}
                      width={72}
                    />
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-[12px] text-ink-faint">
                {bestBuy.price <= profile.currentMoney
                  ? "You can afford this now."
                  : `You are ${moneyShort(bestBuy.price - profile.currentMoney)} short.`}
              </p>
            </div>
          </Panel>
        </div>

        {/* Active plan */}
        <Panel>
          <PanelHead
            title="Money plan"
            meta={
              activePlan ? <ProvenanceTag value={activePlan.provenance} size="xs" /> : undefined
            }
            action={
              <Link
                href="/dashboard/plan"
                className="text-[12px] text-accent hover:text-accent-soft"
              >
                {activePlan ? "Open plan" : "Generate one"}
              </Link>
            }
          />

          {activePlan ? (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
                  {activePlan.summary}
                </p>
                <span className="tabular shrink-0 text-sm text-accent">
                  {completedSteps} of {activePlan.steps.length} done
                </span>
              </div>
              <span
                className="mt-4 block h-[3px] w-full rounded-full"
                style={{
                  background: `linear-gradient(to right, var(--color-accent) ${planProgress * 100}%, var(--color-line) ${planProgress * 100}%)`,
                }}
                aria-hidden
              />
              <ol className="mt-5 divide-y divide-line/70">
                {activePlan.steps.slice(0, 3).map((s) => (
                  <li key={s.order} className="flex items-start gap-4 py-3">
                    <span className="tabular pt-0.5 text-[12px] text-ink-faint">
                      {String(s.order).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink">{s.title}</p>
                      <p className="text-[12px] text-ink-faint">
                        {duration(s.estMinutes)}, {moneyShort(s.estProfit)}
                      </p>
                    </div>
                    {s.done ? (
                      <span className="text-[11px] text-up">done</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink">No plan yet</p>
              <p className="max-w-sm text-[13px] text-ink-muted">
                Generate an ordered route from {money(profile.currentMoney)} to{" "}
                {money(profile.goal)}. It takes about ten seconds.
              </p>
              <ButtonLink href="/dashboard/plan" size="sm" className="mt-1">
                Generate a plan
              </ButtonLink>
            </div>
          )}
        </Panel>

        <DataNotice className="max-w-[80ch] pt-2" />
      </div>
    </>
  );
}
