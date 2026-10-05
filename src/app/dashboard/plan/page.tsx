import { PageHeader } from "@/components/app/PageHeader";
import { PlanBuilder } from "@/components/app/PlanBuilder";
import { ButtonLink, Panel } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { ASSETS } from "@/lib/data/assets";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST, can } from "@/lib/entitlements";

export const metadata = { title: "Money plan" };

export default async function PlanPage() {
  const { userId, account } = await requireSession();

  // The route behind this now refuses too. Both gates are deliberate: this one
  // explains, and the route is the one that cannot be talked around.
  if (!can(account.tier, "ai.plan")) {
    return (
      <>
        <PageHeader
          title="Money plan"
          lead="A route through the week, built around the hours you actually play."
        />
        <div className="px-4 py-6 sm:px-8">
          <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <h2 className="text-sm font-medium text-ink">This is a Pro feature</h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
              Plans are generated against your own profile, your owned assets
              and the time you have. The calculator and the mission list stay
              free.
            </p>
            <ButtonLink href="/dashboard/settings" size="sm" className="mt-1">
              Go Pro
            </ButtonLink>
          </Panel>
        </div>
      </>
    );
  }

  const store = getStore();
  const [profile, plans, credits] = await Promise.all([
    store.getProfile(userId),
    store.listPlans(userId),
    store.getCredits(userId),
  ]);

  return (
    <>
      <PageHeader
        title="Money plan"
        lead="An ordered route from where you are to the number you want. Every step carries a time cost, a profit estimate and the cash you need before you start it."
      />
      <div className="px-4 py-6 sm:px-8">
        <PlanBuilder
          initialProfile={profile}
          initialPlan={plans[0] ?? null}
          assets={ASSETS.map((a) => ({ id: a.id, name: a.name }))}
          credits={credits}
          cost={CREDIT_COST["money-plan"]}
        />
      </div>
    </>
  );
}
