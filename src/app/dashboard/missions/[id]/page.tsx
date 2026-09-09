import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataNotice, ProvenanceTag } from "@/components/ProvenanceTag";
import { Panel, PanelHead, Stat } from "@/components/ui/primitives";
import {
  effectiveHourly,
  missionLevelGate,
  moneyPerHour,
  moneyPerMinute,
  riskAdjustedPayout,
} from "@/lib/calc";
import { MISSIONS, missionById } from "@/lib/data/missions";
import { money, moneyShort } from "@/lib/format";

export function generateStaticParams() {
  return MISSIONS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = missionById(id);
  return { title: mission?.name ?? "Mission" };
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = missionById(id);
  if (!mission) notFound();

  const gate = missionLevelGate(mission);
  const loss = mission.payout - riskAdjustedPayout(mission);

  return (
    <div className="px-4 py-6 sm:px-8">
      <Link
        href="/dashboard/missions"
        className="text-[13px] text-ink-muted hover:text-ink"
      >
        Back to mission intelligence
      </Link>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="relative aspect-[16/8] w-full">
              <Image
                src={mission.image}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover opacity-65"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--color-surface) 5%, transparent 70%)",
                }}
                aria-hidden
              />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {mission.name}
                </h1>
                <ProvenanceTag value={mission.provenance} />
              </div>
              <p className="mt-1.5 text-[13px] text-ink-faint">
                {mission.strand}, {mission.region}
              </p>

              <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-4">
                <Stat label="Payout" value={moneyShort(mission.payout)} />
                <Stat label="Duration" value={`${mission.duration}m`} />
                <Stat
                  label="Per minute"
                  value={moneyShort(moneyPerMinute(mission))}
                />
                <Stat
                  label="Risk adjusted"
                  value={`${moneyShort(effectiveHourly(mission))}/h`}
                  tone="accent"
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="How to run it" />
            <div className="p-5">
              <p className="text-[13px] text-ink-muted">
                Recommended approach:{" "}
                <span className="text-ink">{mission.bestStrategy}</span>
              </p>
              <ul className="mt-4 space-y-3">
                {mission.tips.map((tip) => (
                  <li
                    key={tip}
                    className="flex gap-3 text-[13px] leading-relaxed text-ink-muted"
                  >
                    <span
                      className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent"
                      aria-hidden
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHead title="Requirements" />
            <div className="p-5">
              <dl className="space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Difficulty</dt>
                  <dd className="tabular text-ink">{mission.difficulty} of 5</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Crew needed</dt>
                  <dd className="tabular text-ink">{mission.crewRequired}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Level gate</dt>
                  <dd className="tabular text-ink">{gate > 1 ? gate : "none"}</dd>
                </div>
              </dl>

              {mission.prerequisites.length ? (
                <>
                  <h3 className="mt-5 border-t border-line pt-4 text-[12px] font-medium text-ink">
                    Before you start
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {mission.prerequisites.map((p) => (
                      <li key={p} className="text-[13px] text-ink-muted">
                        {p}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-muted">
                  No prerequisites. Available from the start.
                </p>
              )}
            </div>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">The maths</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-faint">Raw hourly</dt>
                <dd className="tabular text-ink-muted">
                  {money(moneyPerHour(mission))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Expected failure cost</dt>
                <dd className="tabular text-down">-{moneyShort(loss)}</dd>
              </div>
              {mission.crewRequired > 1 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Your share</dt>
                  <dd className="tabular text-ink-muted">
                    1 of {mission.crewRequired}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2.5">
                <dt className="text-ink">Risk adjusted hourly</dt>
                <dd className="tabular text-accent">
                  {money(effectiveHourly(mission))}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
              Failure drag scales with difficulty, from about 2 percent at
              difficulty 1 to about 26 percent at difficulty 5.
            </p>
          </Panel>

          <DataNotice />
        </div>
      </div>
    </div>
  );
}
