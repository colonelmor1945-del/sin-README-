import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/Brand";
import { Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { getAiProvider } from "@/lib/ai";
import { ASSETS } from "@/lib/data/assets";
import { MAP_PINS } from "@/lib/data/map";
import { MISSIONS } from "@/lib/data/missions";
import { NEWS } from "@/lib/data/news";
import { getStore } from "@/lib/db/store";
import { TIERS } from "@/lib/entitlements";
import { PROVIDERS } from "@/lib/payments";
import { price } from "@/lib/format";

export const metadata = { title: "Admin" };

/**
 * Admin panel.
 *
 * The authorisation check is the first thing that runs and reads the role from
 * the store, never from the request. Business metrics are shown as unavailable
 * rather than as zero, because a zero reads as a real measurement and an empty
 * state does not.
 */
export default async function AdminPage() {
  const { userId, account } = await requireSession();
  if (account.role !== "admin") redirect("/dashboard");

  const store = getStore();
  const [credits, queriesToday] = await Promise.all([
    store.getCredits(userId),
    store.getDailyQueries(userId),
  ]);

  const provider = getAiProvider();
  const contentCounts = [
    { label: "Missions", value: MISSIONS.length, href: "/dashboard/missions" },
    { label: "Assets", value: ASSETS.length, href: "/dashboard/economy" },
    { label: "Map locations", value: MAP_PINS.length, href: "/dashboard/map" },
    { label: "Intel entries", value: NEWS.length, href: "/dashboard/news" },
  ];

  const unverified =
    MISSIONS.filter((m) => m.provenance !== "verified").length +
    ASSETS.filter((a) => a.provenance !== "verified").length;

  return (
    <div className="min-h-[100dvh]">
      <header className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Brand size="sm" href="/dashboard" />
          <span className="rounded-full border border-accent/45 px-2 py-0.5 text-[10px] text-accent uppercase">
            Admin
          </span>
        </div>
        <Link href="/dashboard" className="text-[13px] text-ink-muted hover:text-ink">
          Back to app
        </Link>
      </header>

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Panel quiet className="p-4">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            This build runs on the in-memory development store, so the figures
            below cover this process only. Metrics that need a real database or
            a payment processor are marked as unavailable rather than shown as
            zero, because a zero looks like a measurement.
          </p>
        </Panel>

        {/* Business metrics */}
        <Panel>
          <PanelHead
            title="Business metrics"
            meta={
              <span className="text-[11px] text-ink-faint">
                Requires the Postgres adapter and a payment provider
              </span>
            }
          />
          <div className="grid gap-px bg-line p-px sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Total users",
              "Active users",
              "MRR",
              "ARR estimate",
              "Payment conversion",
              "Support contributions",
              "AI cost per user",
              "Profit margin",
            ].map((label) => (
              <div key={label} className="bg-surface p-5">
                <p className="text-[11px] text-ink-faint">{label}</p>
                <p className="mt-1 text-[15px] text-ink-faint">Not available</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* Content */}
          <Panel>
            <PanelHead title="Content" />
            <div className="grid gap-px bg-line p-px sm:grid-cols-2">
              {contentCounts.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="bg-surface p-5 transition-colors hover:bg-surface-2"
                >
                  <p className="text-[11px] text-ink-faint">{c.label}</p>
                  <p className="tabular mt-1 text-2xl text-ink">{c.value}</p>
                </Link>
              ))}
            </div>
            <div className="border-t border-line p-5">
              <p className="text-[13px] text-ink-muted">
                <span className="tabular text-ink">{unverified}</span> records
                are not verified. Every one of them renders with its provenance
                label in the product.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                Editing content from this panel writes to the missions, assets,
                map_locations and news_items tables. Those routes land with the
                Postgres adapter.
              </p>
            </div>
          </Panel>

          {/* Services */}
          <Panel>
            <PanelHead title="Services" />
            <dl className="divide-y divide-line/70">
              <ServiceRow label="AI provider" value={provider.label} ok={provider.id === "claude"} />
              {PROVIDERS.map((p) => (
                <ServiceRow
                  key={p.id}
                  label={p.label}
                  value={p.configured ? "Configured" : "Not configured"}
                  ok={p.configured}
                />
              ))}
              <ServiceRow label="Database" value="In-memory" ok={false} />
              <ServiceRow label="Authentication" value="Anonymous session" ok={false} />
              <ServiceRow label="Rate limiting" value="In-process" ok={false} />
            </dl>
          </Panel>
        </div>

        {/* Plans and this session */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Panel>
            <PanelHead title="Plans" />
            <div className="grid gap-px bg-line p-px sm:grid-cols-3">
              {(["free", "pro", "elite"] as const).map((id) => (
                <div key={id} className="bg-surface p-5">
                  <p className="text-[11px] text-ink-faint">{TIERS[id].label}</p>
                  <p className="tabular mt-1 text-lg text-ink">
                    {TIERS[id].priceMinor === 0
                      ? "Free"
                      : price(TIERS[id].priceMinor / 100)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {TIERS[id].monthlyCredits} credits a month
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="This session" />
            <div className="grid gap-6 p-5 sm:grid-cols-3">
              <Stat label="AI queries today" value={String(queriesToday)} />
              <Stat label="Lab Credits" value={String(credits)} tone="accent" />
              <Stat label="Role" value={account.role} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ServiceRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cx(ok ? "text-up" : "text-ink-faint")}>{value}</dd>
    </div>
  );
}
