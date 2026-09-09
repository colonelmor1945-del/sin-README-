import { PageHeader } from "@/components/app/PageHeader";
import { DataNotice, ProvenanceTag } from "@/components/ProvenanceTag";
import { Sparkline } from "@/components/ui/charts";
import { RangeValue } from "@/components/ui/RangeValue";
import { ButtonLink, Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import {
  monthlyReturn,
  paybackDays,
  paybackRange,
  rankAssetsByEfficiency,
  trendDelta,
} from "@/lib/calc";
import { ASSETS } from "@/lib/data/assets";
import { can } from "@/lib/entitlements";
import { money, moneyShort } from "@/lib/format";
import type { Advice, Trend } from "@/lib/types";

export const metadata = { title: "Economy tracker" };

const TREND_LABEL: Record<Trend, string> = {
  "strong-up": "Rising fast",
  up: "Rising",
  flat: "Flat",
  down: "Falling",
};

const ADVICE_TONE: Record<Advice, string> = {
  buy: "border-up/40 text-up",
  hold: "border-line-strong text-ink-muted",
  wait: "border-line-strong text-ink-faint",
  analyze: "border-projection/45 text-projection",
};

export default async function EconomyPage() {
  const { account } = await requireSession();

  if (!can(account.tier, "economy.tracker")) {
    return (
      <>
        <PageHeader
          title="Economy tracker"
          lead="Payback periods, price trends and a recommendation for every asset."
        />
        <div className="px-4 py-6 sm:px-8">
          <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <h2 className="text-sm font-medium text-ink">This is a Pro feature</h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
              The tracker ranks every asset by capital efficiency rather than
              sticker price, and shows the price history behind each call.
            </p>
            <ButtonLink href="/dashboard/settings" size="sm" className="mt-1">
              Go Pro
            </ButtonLink>
          </Panel>
        </div>
      </>
    );
  }

  const rows = rankAssetsByEfficiency(ASSETS);
  const incomeAssets = rows.filter((a) => a.dailyNet > 0);
  const totalDailyNet = incomeAssets.reduce((s, a) => s + a.dailyNet, 0);
  const bestReturn = incomeAssets[0];

  return (
    <>
      <PageHeader
        title="Economy tracker"
        lead="Ranked by payback period, which is the figure that matters when you are deciding what to buy first."
      />

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Panel className="grid gap-6 p-6 sm:grid-cols-3">
          <Stat
            label="Assets tracked"
            value={String(rows.length)}
            sub={`${incomeAssets.length} produce income`}
          />
          <Stat
            label="Combined net a day"
            value={moneyShort(totalDailyNet)}
            tone="up"
            sub="If you owned every income asset"
          />
          <Stat
            label="Fastest payback"
            value={`${paybackDays(bestReturn)?.toFixed(1)}d`}
            tone="accent"
            sub={bestReturn.name}
          />
        </Panel>

        <Panel>
          <PanelHead
            title="Assets"
            meta={
              <span className="text-[11px] text-ink-faint">
                Our call is a formula output, not a guarantee
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Asset</th>
                  <th className="px-5 py-2.5 font-medium">Price</th>
                  <th className="px-5 py-2.5 font-medium">Net a day</th>
                  <th className="px-5 py-2.5 font-medium">Payback</th>
                  <th className="px-5 py-2.5 font-medium">Return per 30d</th>
                  <th className="px-5 py-2.5 font-medium">Trend</th>
                  <th className="px-5 py-2.5 font-medium">Our call</th>
                  <th className="px-5 py-2.5 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((a) => {
                  const delta = trendDelta(a);
                  const pb = paybackDays(a);
                  const range = paybackRange(a);
                  const mr = monthlyReturn(a);
                  const tone = delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat";
                  return (
                    <tr key={a.id} className="text-[13px]">
                      <td className="px-5 py-3.5">
                        <p className="text-ink">{a.name}</p>
                        <p className="text-[11px] text-ink-faint">
                          {a.category}, {a.region}, level {a.unlockLevel}
                        </p>
                      </td>
                      <td className="tabular px-5 py-3.5 text-ink">{money(a.price)}</td>
                      <td
                        className={cx(
                          "tabular px-5 py-3.5",
                          a.dailyNet > 0 ? "text-up" : "text-ink-faint",
                        )}
                      >
                        {a.dailyNet > 0 ? money(a.dailyNet) : "none"}
                      </td>
                      <td className="px-5 py-3.5">
                        {range ? (
                          <RangeValue
                            estimate={range}
                            format={(n) => n.toFixed(1)}
                            suffix="d"
                            tone="muted"
                            className="text-[13px]"
                          />
                        ) : (
                          <span className="text-ink-faint">n/a</span>
                        )}
                      </td>
                      <td className="tabular px-5 py-3.5 text-ink-muted">
                        {mr ? `${(mr * 100).toFixed(1)}%` : "n/a"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Sparkline
                            values={a.history}
                            tone={tone}
                            label={`${a.name} price history`}
                            width={64}
                            height={20}
                          />
                          <span
                            className={cx(
                              "tabular text-[12px]",
                              tone === "up"
                                ? "text-up"
                                : tone === "down"
                                  ? "text-down"
                                  : "text-flat",
                            )}
                          >
                            {delta >= 0 ? "+" : ""}
                            {(delta * 100).toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-faint">
                          {TREND_LABEL[a.trend]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cx(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
                            ADVICE_TONE[a.advice],
                          )}
                        >
                          {a.advice}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ProvenanceTag value={a.provenance} size="xs" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel quiet className="p-5">
          <h2 className="text-[13px] font-semibold text-ink">How the call is made</h2>
          <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
            Buy means the payback period is short enough that the asset repays
            itself well inside a normal play session. Hold means it is
            reasonable but there is something better to buy first. Wait means
            the price is falling and the trend has not bottomed out. None of
            these are guarantees, and all of them are computed from placeholder
            data.
          </p>
        </Panel>

        <DataNotice className="max-w-[80ch]" />
      </div>
    </>
  );
}
