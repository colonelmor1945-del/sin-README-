import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Sparkline } from "@/components/ui/charts";
import { cx } from "@/components/ui/primitives";
import {
  effectiveHourly,
  hourlyRange,
  paybackDays,
  paybackRange,
  rankAssetsByEfficiency,
  sortMissions,
  trendDelta,
} from "@/lib/calc";
import { ASSETS } from "@/lib/data/assets";
import { MAP_PINS, PIN_KINDS } from "@/lib/data/map";
import { MISSIONS } from "@/lib/data/missions";
import { moneyShort } from "@/lib/format";

/**
 * Slide bodies.
 *
 * Server components reading the same modules the dashboard reads, so a change
 * to the dataset or to a formula changes the marketing page in the same commit.
 * This is the alternative to screenshots, which start lying the moment the
 * product moves.
 */

export function MissionsSlide() {
  const rows = sortMissions(MISSIONS, "best-hourly").slice(0, 5);
  const ceiling = effectiveHourly(rows[0]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="text-[11px] text-ink-muted">
          Sorted by risk-adjusted hourly
        </span>
        <ProvenanceTag value="community" size="xs" />
      </header>
      <ul className="divide-y divide-line/70">
        {rows.map((m, i) => {
          const range = hourlyRange(m);
          return (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <span className="tabular w-4 text-[11px] text-ink-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{m.name}</p>
                <p className="text-[11px] text-ink-faint">
                  {m.duration} min, difficulty {m.difficulty} of 5
                </p>
              </div>
              <div className="flex w-32 flex-col items-end gap-1.5">
                <span className="tabular text-[12px] whitespace-nowrap text-ink">
                  {moneyShort(range.low)}
                  <span className="px-1 text-ink-faint">to</span>
                  {moneyShort(range.high)}
                </span>
                <span
                  className="block h-[3px] w-full rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) ${(effectiveHourly(m) / ceiling) * 100}%, var(--color-line) ${(effectiveHourly(m) / ceiling) * 100}%)`,
                  }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function EconomySlide() {
  const rows = rankAssetsByEfficiency(ASSETS.filter((a) => a.dailyNet > 0)).slice(0, 5);

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="text-[11px] text-ink-muted">
          Ranked by payback period
        </span>
        <ProvenanceTag value="community" size="xs" />
      </header>
      <table className="w-full text-left">
        <tbody className="divide-y divide-line/70">
          {rows.map((a) => {
            const delta = trendDelta(a);
            const range = paybackRange(a);
            const tone = delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat";
            return (
              <tr key={a.id} className="text-[13px]">
                <td className="px-5 py-3">
                  <p className="truncate text-ink">{a.name}</p>
                  <p className="tabular text-[11px] text-ink-faint">
                    {moneyShort(a.price)}
                  </p>
                </td>
                <td className="tabular px-2 py-3 text-right text-[12px] whitespace-nowrap text-ink-muted">
                  {range ? `${range.low.toFixed(1)}d to ${range.high.toFixed(1)}d` : "n/a"}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Sparkline
                      values={a.history}
                      tone={tone}
                      label={`${a.name} trend`}
                      width={52}
                      height={18}
                    />
                    <span
                      className={cx(
                        "tabular w-12 text-right text-[11px]",
                        tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-flat",
                      )}
                    >
                      {delta >= 0 ? "+" : ""}
                      {(delta * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

const PIN_COLOUR: Record<string, string> = {
  mission: "var(--color-accent)",
  business: "var(--color-up)",
  property: "var(--color-projection)",
  "money-spot": "#ffb020",
  vehicle: "var(--color-ink-muted)",
  activity: "var(--color-accent-soft)",
};

export function MapSlide() {
  return (
    <>
      <header className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        {PIN_KINDS.slice(0, 4).map((k) => (
          <span
            key={k.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-muted"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: PIN_COLOUR[k.id] }}
              aria-hidden
            />
            {k.label}
          </span>
        ))}
      </header>

      <div className="relative aspect-[16/10] w-full bg-[#070510]">
        <div className="grid-field absolute inset-0" aria-hidden />
        <svg
          viewBox="0 0 100 75"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M14 10 L52 6 L76 12 L86 26 L82 44 L70 58 L58 68 L40 70 L24 60 L16 44 Z"
            fill="rgb(255 255 255 / 0.025)"
            stroke="var(--color-line-strong)"
            strokeWidth="0.3"
          />
        </svg>
        {MAP_PINS.map((pin) => (
          <span
            key={pin.id}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              background: PIN_COLOUR[pin.kind] ?? "var(--color-ink-muted)",
            }}
            aria-hidden
          />
        ))}
      </div>
    </>
  );
}

export function PlanSlide() {
  const best = sortMissions(MISSIONS, "best-hourly")[0];
  const fastest = rankAssetsByEfficiency(ASSETS.filter((a) => a.dailyNet > 0))[0];

  const steps = [
    {
      horizon: "Short term",
      window: "This session",
      title: `Run ${best.name}`,
      detail: `${moneyShort(effectiveHourly(best))} an hour risk adjusted, the best rate in the set.`,
    },
    {
      horizon: "Medium term",
      window: "Next few sessions",
      title: `Buy the ${fastest.name}`,
      detail: `Repays ${moneyShort(fastest.price)} in about ${paybackDays(fastest)?.toFixed(1)} in-game days.`,
    },
    {
      horizon: "Long term",
      window: "The rest of the route",
      title: "Scale into the highest income asset",
      detail: "Passive income carries the last stretch to the goal.",
    },
  ];

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="text-[11px] text-ink-muted">
          Grouped by horizon
        </span>
        <ProvenanceTag value="ai-projection" size="xs" />
      </header>
      <ol>
        {steps.map((step, i) => (
          <li key={step.horizon}>
            <div className="flex items-baseline justify-between gap-3 border-b border-line bg-surface-2 px-5 py-2">
              <span className="text-[11px] font-semibold text-ink">{step.horizon}</span>
              <span className="text-[11px] text-ink-faint">{step.window}</span>
            </div>
            <div className="flex items-start gap-3 border-b border-line/70 px-5 py-3.5">
              <span className="tabular mt-0.5 text-[11px] text-accent">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13px] text-ink">{step.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  {step.detail}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
