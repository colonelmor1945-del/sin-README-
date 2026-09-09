import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { Button, ButtonLink, Panel, PanelHead } from "@/components/ui/primitives";
import { switchTier } from "@/app/dashboard/settings/actions";
import { requireSession } from "@/lib/auth/session";
import { getAiProvider } from "@/lib/ai";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST, TIERS } from "@/lib/entitlements";
import { PROVIDERS } from "@/lib/payments";
import { price } from "@/lib/format";
import type { Tier } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { userId, account } = await requireSession();
  const store = getStore();
  const [credits, used] = await Promise.all([
    store.getCredits(userId),
    store.getDailyQueries(userId),
  ]);
  const provider = getAiProvider();
  const tiers: Tier[] = ["free", "pro", "elite"];
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <>
      <PageHeader
        title="Settings"
        lead="Plan, credits and the state of the services this build is wired to."
      />

      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel>
            <PanelHead
              title="Plan"
              meta={
                <span className="rounded-full border border-accent/45 px-2 py-0.5 text-[10px] text-accent uppercase">
                  {account.tier}
                </span>
              }
            />
            <div className="grid gap-px bg-line p-px sm:grid-cols-3">
              {tiers.map((id) => {
                const tier = TIERS[id];
                const current = account.tier === id;
                return (
                  <div key={id} className="bg-surface p-5">
                    <h3 className="text-[13px] font-semibold text-ink">{tier.label}</h3>
                    <p className="tabular mt-2 text-2xl text-ink">
                      {tier.priceMinor === 0 ? "Free" : price(tier.priceMinor / 100)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {tier.dailyQueries === "unlimited"
                        ? "Unlimited queries"
                        : `${tier.dailyQueries} queries a day`}
                      , {tier.monthlyCredits} credits
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {tier.features.map((f) => (
                        <li key={f} className="text-[12px] leading-relaxed text-ink-muted">
                          {f}
                        </li>
                      ))}
                    </ul>
                    {current ? (
                      <p className="mt-4 text-[12px] text-accent">Your current plan</p>
                    ) : isDev ? (
                      <form action={switchTier} className="mt-4">
                        <input type="hidden" name="tier" value={id} />
                        <Button type="submit" size="sm" variant="outline">
                          Switch for review
                        </Button>
                      </form>
                    ) : (
                      <p className="mt-4 text-[12px] text-ink-faint">
                        Checkout is not wired yet
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHead
              title="Lab Credits"
              meta={
                <span className="tabular text-[13px] text-accent">{credits} available</span>
              }
            />
            <div className="p-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[10px] border border-line bg-surface-2 p-3.5">
                  <dt className="text-[11px] text-ink-faint">A money plan costs</dt>
                  <dd className="tabular mt-1 text-lg text-ink">
                    {CREDIT_COST["money-plan"]} credits
                  </dd>
                </div>
                <div className="rounded-[10px] border border-line bg-surface-2 p-3.5">
                  <dt className="text-[11px] text-ink-faint">A creator package costs</dt>
                  <dd className="tabular mt-1 text-lg text-ink">
                    {CREDIT_COST["creator-lab"]} credits
                  </dd>
                </div>
              </dl>
              <p className="mt-4 max-w-[75ch] text-[12px] leading-relaxed text-ink-faint">
                Lab Credits are platform usage credits for premium AI actions.
                They are not cryptocurrency, not an investment product, not
                transferable and not a security. Credits spent on a failed
                request are returned automatically.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Build status</h2>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              What this deployment is actually connected to.
            </p>
            <dl className="mt-4 space-y-3 text-[12px]">
              <Row
                label="AI provider"
                value={provider.label}
                ok={provider.id === "claude"}
              />
              {PROVIDERS.map((p) => (
                <Row
                  key={p.id}
                  label={p.label}
                  value={p.configured ? "Configured" : "Not configured"}
                  ok={p.configured}
                />
              ))}
              <Row label="Database" value="In-memory, development" ok={false} />
              <Row label="Authentication" value="Anonymous session" ok={false} />
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
              Anything marked as not configured falls back to a safe local
              behaviour rather than pretending to work.
            </p>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Usage today</h2>
            <p className="tabular mt-2 text-2xl text-ink">{used}</p>
            <p className="text-[12px] text-ink-faint">
              AI queries, resets at midnight UTC
            </p>
          </Panel>

          {account.role === "admin" ? (
            <Panel quiet className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Administration</h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                Your account has the admin role in this development build.
              </p>
              <ButtonLink href="/admin" size="sm" variant="outline" className="mt-3">
                Open admin panel
              </ButtonLink>
            </Panel>
          ) : null}

          <p className="px-1 text-[11px] leading-relaxed text-ink-faint">
            Read the{" "}
            <Link href="/legal" className="text-accent hover:text-accent-soft">
              legal and data policy
            </Link>{" "}
            for what this platform is and is not.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={ok ? "text-up" : "text-ink-muted"}>{value}</dd>
    </div>
  );
}
