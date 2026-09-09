import { PageHeader } from "@/components/app/PageHeader";
import { PlanBuilder } from "@/components/app/PlanBuilder";
import { requireSession } from "@/lib/auth/session";
import { ASSETS } from "@/lib/data/assets";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST } from "@/lib/entitlements";

export const metadata = { title: "Money plan" };

export default async function PlanPage() {
  const { userId } = await requireSession();
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
