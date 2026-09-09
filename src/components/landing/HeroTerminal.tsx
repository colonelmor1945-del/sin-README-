import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Sparkline } from "@/components/ui/charts";
import { effectiveHourly, paybackDays, rankAssetsByEfficiency, sortMissions, trendDelta } from "@/lib/calc";
import { ASSETS } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { money, moneyShort } from "@/lib/format";

/**
 * The hero visual is the real thing, not a picture of it.
 *
 * Every number below is computed at render time by the same functions the
 * dashboard uses. If the ranking logic changes, this changes with it, which is
 * the whole point of not shipping a screenshot.
 */
export function HeroTerminal() {
  const ranked = sortMissions(MISSIONS, "best-hourly");
  const topMissions = ranked.slice(0, 4);
  const ceiling = effectiveHourly(ranked[0]);
  const topAsset = rankAssetsByEfficiency(ASSETS.filter((a) => a.dailyNet > 0))[0];
  const delta = trendDelta(topAsset);

  return (
    <div className="panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-[11px] font-medium text-ink-muted">
          Money per hour, risk adjusted
        </span>
        <ProvenanceTag value="community" size="xs" />
      </header>

      <ul className="divide-y divide-line/70">
        {topMissions.map((m, i) => {
          const hourly = effectiveHourly(m);
          const share = hourly / ceiling;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="tabular w-4 text-[11px] text-ink-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{m.name}</p>
                <p className="text-[11px] text-ink-faint">
                  {m.duration} min, difficulty {m.difficulty} of 5
                </p>
              </div>
              <div className="flex w-28 flex-col items-end gap-1.5">
                <span className="tabular text-[13px] text-ink">
                  {moneyShort(hourly)}
                </span>
                <span
                  className="block h-[3px] w-full rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent) ${share * 100}%, var(--color-line) ${share * 100}%)`,
                  }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-4 border-t border-line bg-surface-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] text-ink-faint">Fastest capital payback</p>
          <p className="truncate text-[13px] text-ink">{topAsset.name}</p>
          <p className="tabular text-[11px] text-ink-muted">
            {money(topAsset.price)}, repays in {paybackDays(topAsset)?.toFixed(1)} in-game days
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Sparkline
            values={topAsset.history}
            tone={delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat"}
            label={`${topAsset.name} price trend`}
          />
          <span className="tabular text-[11px] text-up">
            +{(delta * 100).toFixed(1)}%
          </span>
        </div>
      </footer>
    </div>
  );
}
