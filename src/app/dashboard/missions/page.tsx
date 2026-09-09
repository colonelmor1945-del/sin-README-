import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { DataNotice, ProvenanceTag } from "@/components/ProvenanceTag";
import { Meter } from "@/components/ui/charts";
import { RangeValue } from "@/components/ui/RangeValue";
import { Panel, cx } from "@/components/ui/primitives";
import {
  effectiveHourly,
  missionLevelGate,
  hourlyRange,
  sortMissions,
  type MissionSort,
} from "@/lib/calc";
import { MISSIONS } from "@/lib/data/missions";
import { moneyShort } from "@/lib/format";

export const metadata = { title: "Mission intelligence" };

const SORTS: { id: MissionSort; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "best-hourly", label: "Best money per hour" },
  { id: "highest-reward", label: "Highest reward" },
  { id: "fastest", label: "Fastest" },
  { id: "easiest", label: "Easiest" },
];

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const active: MissionSort =
    (SORTS.find((s) => s.id === sort)?.id as MissionSort) ?? "recommended";

  const rows = sortMissions(MISSIONS, active);
  const top = effectiveHourly(sortMissions(MISSIONS, "best-hourly")[0]);

  return (
    <>
      <PageHeader
        title="Mission intelligence"
        lead="Every mission with its real rate. Risk adjusted subtracts the expected cost of failed runs and splits the payout across the crew it needs."
      />

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <nav className="flex flex-wrap gap-1.5" aria-label="Sort missions">
          {SORTS.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/missions?sort=${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={cx(
                "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                active === s.id
                  ? "border-accent bg-accent-dim text-accent"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => (
            <Panel key={m.id} className="flex flex-col overflow-hidden">
              <Link href={`/dashboard/missions/${m.id}`} className="group">
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <Image
                    src={m.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, var(--color-surface) 6%, transparent 65%)",
                    }}
                    aria-hidden
                  />
                </div>
              </Link>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-medium text-ink">
                      <Link href={`/dashboard/missions/${m.id}`} className="hover:text-accent">
                        {m.name}
                      </Link>
                    </h2>
                    <p className="text-[12px] text-ink-faint">
                      {m.strand}, {m.region}
                    </p>
                  </div>
                  <ProvenanceTag value={m.provenance} size="xs" />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
                  <div>
                    <dt className="text-[10px] text-ink-faint">Payout</dt>
                    <dd className="tabular text-[13px] text-ink">{moneyShort(m.payout)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-ink-faint">Time</dt>
                    <dd className="tabular text-[13px] text-ink-muted">{m.duration}m</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-ink-faint">Crew</dt>
                    <dd className="tabular text-[13px] text-ink-muted">{m.crewRequired}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-ink-faint">Hourly range</span>
                    <RangeValue
                      estimate={hourlyRange(m)}
                      format={moneyShort}
                      suffix="/h"
                      tone="accent"
                      className="text-[13px]"
                    />
                  </div>
                  <div className="mt-1.5">
                    <Meter value={effectiveHourly(m) / top} />
                  </div>
                </div>

                <p className="mt-3 text-[12px] text-ink-faint">
                  Difficulty {m.difficulty} of 5
                  {missionLevelGate(m) > 1 ? `, unlocks at level ${missionLevelGate(m)}` : ""}
                </p>
              </div>
            </Panel>
          ))}
        </div>

        <DataNotice className="max-w-[80ch] pt-2" />
      </div>
    </>
  );
}
