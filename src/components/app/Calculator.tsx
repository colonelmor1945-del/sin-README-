"use client";

import { useMemo, useState } from "react";

import { Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { Meter } from "@/components/ui/charts";
import { duration, money, moneyShort } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  price: number;
  dailyNet: number;
  paybackDays: number | null;
  monthlyReturn: number | null;
}

interface MissionRow {
  id: string;
  name: string;
  payout: number;
  duration: number;
  hourly: number;
  effective: number;
}

/**
 * Money calculator.
 *
 * All four calculators run on the client from values the server computed, so
 * the numbers move as you type without a round trip. No AI involved, which is
 * the point: these are arithmetic, and arithmetic should be free and instant.
 */
export function Calculator({
  assets,
  missions,
}: {
  assets: Row[];
  missions: MissionRow[];
}) {
  const [current, setCurrent] = useState(2_000_000);
  const [goal, setGoal] = useState(10_000_000);
  const [missionId, setMissionId] = useState(missions[0]?.id ?? "");
  const [compareA, setCompareA] = useState(assets[0]?.id ?? "");
  const [compareB, setCompareB] = useState(assets[1]?.id ?? "");

  const mission = missions.find((m) => m.id === missionId) ?? missions[0];
  const a = assets.find((x) => x.id === compareA) ?? assets[0];
  const b = assets.find((x) => x.id === compareB) ?? assets[1];

  const projection = useMemo(() => {
    const gap = Math.max(0, goal - current);
    const hourly = mission?.effective ?? 0;
    const hours = hourly > 0 ? gap / hourly : Infinity;
    const runs = mission ? Math.ceil(gap / mission.payout) : 0;
    return { gap, hourly, hours, runs };
  }, [current, goal, mission]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Time to goal */}
      <Panel>
        <PanelHead title="Time to goal" />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField label="Current money" value={current} onChange={setCurrent} />
            <NumField label="Target" value={goal} onChange={setGoal} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="calc-mission" className="text-[13px] font-medium text-ink">
              Income source
            </label>
            <select
              id="calc-mission"
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Stat label="Gap" value={moneyShort(projection.gap)} />
            <Stat
              label="Rate, risk adjusted"
              value={`${moneyShort(projection.hourly)}/h`}
              tone="accent"
            />
            <Stat
              label="Estimated time"
              value={
                Number.isFinite(projection.hours)
                  ? duration(projection.hours * 60)
                  : "no route"
              }
            />
          </div>

          <p className="text-[12px] leading-relaxed text-ink-faint">
            About {projection.runs} run{projection.runs === 1 ? "" : "s"} of{" "}
            {mission?.name}. Raw payout is {moneyShort(mission?.hourly ?? 0)} per
            hour; the risk-adjusted figure subtracts the expected cost of failed
            attempts and splits the payout across the crew the mission needs.
          </p>
        </div>
      </Panel>

      {/* Asset comparison */}
      <Panel>
        <PanelHead title="Asset comparison" />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetSelect id="cmp-a" label="Option A" value={compareA} onChange={setCompareA} assets={assets} />
            <AssetSelect id="cmp-b" label="Option B" value={compareB} onChange={setCompareB} assets={assets} />
          </div>

          <div className="grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2">
            {[a, b].map((asset, i) => {
              const other = i === 0 ? b : a;
              const better =
                asset.paybackDays !== null &&
                (other.paybackDays === null || asset.paybackDays < other.paybackDays);
              return (
                <div key={asset.id} className="bg-surface-2 p-4">
                  <p className="truncate text-[13px] font-medium text-ink">{asset.name}</p>
                  <dl className="mt-3 space-y-2 text-[13px]">
                    <Line label="Price" value={money(asset.price)} />
                    <Line label="Net a day" value={money(asset.dailyNet)} tone="up" />
                    <Line
                      label="Payback"
                      value={
                        asset.paybackDays ? `${asset.paybackDays.toFixed(1)} days` : "no income"
                      }
                      tone={better ? "accent" : undefined}
                    />
                    <Line
                      label="Return per 30 days"
                      value={
                        asset.monthlyReturn
                          ? `${(asset.monthlyReturn * 100).toFixed(1)}%`
                          : "n/a"
                      }
                    />
                  </dl>
                </div>
              );
            })}
          </div>

          <p className="text-[12px] leading-relaxed text-ink-faint">
            {a.paybackDays && b.paybackDays
              ? `${a.paybackDays < b.paybackDays ? a.name : b.name} repays its capital ${Math.abs(a.paybackDays - b.paybackDays).toFixed(1)} in-game days sooner. Payback beats sticker price when you are choosing what to buy first.`
              : "One of these has no direct income, so payback period does not apply to it."}
          </p>
        </div>
      </Panel>

      {/*
        Mission efficiency table.

        min-w-0 is load-bearing. A grid item defaults to min-width:auto, which
        means it refuses to shrink below its content's min-content size, so the
        640px table inside pushed this column to 640px and took the page with
        it. The overflow-x-auto wrapper never got a chance to scroll, because
        there was nothing left to scroll inside.
      */}
      <Panel className="min-w-0 lg:col-span-2">
        <PanelHead
          title="Mission profitability"
          meta={<span className="text-[11px] text-ink-faint">Sorted by risk-adjusted hourly</span>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11px] text-ink-faint">
                <th className="px-5 py-2.5 font-medium">Mission</th>
                <th className="px-5 py-2.5 font-medium">Payout</th>
                <th className="px-5 py-2.5 font-medium">Time</th>
                <th className="px-5 py-2.5 font-medium">Per minute</th>
                <th className="px-5 py-2.5 font-medium">Risk adjusted</th>
                <th className="w-40 px-5 py-2.5 font-medium">Relative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {missions.map((m) => (
                <tr key={m.id} className="text-[13px]">
                  <td className="px-5 py-3 text-ink">{m.name}</td>
                  <td className="tabular px-5 py-3 text-ink-muted">{moneyShort(m.payout)}</td>
                  <td className="tabular px-5 py-3 text-ink-muted">{m.duration}m</td>
                  <td className="tabular px-5 py-3 text-ink-muted">
                    {moneyShort(m.payout / m.duration)}
                  </td>
                  <td className="tabular px-5 py-3 text-accent">{moneyShort(m.effective)}</td>
                  <td className="px-5 py-3">
                    <Meter value={m.effective / (missions[0]?.effective || 1)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="tabular w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function AssetSelect({
  id,
  label,
  value,
  onChange,
  assets,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  assets: Row[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
      >
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "accent";
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd
        className={cx(
          "tabular",
          tone === "up" ? "text-up" : tone === "accent" ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
