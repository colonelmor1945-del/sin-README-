import { PageHeader } from "@/components/app/PageHeader";
import { CreatorLab } from "@/components/app/CreatorLab";
import { ButtonLink, Panel } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { CREATOR_IDEAS } from "@/lib/data/creator";
import { getStore } from "@/lib/db/store";
import { CREDIT_COST, can } from "@/lib/entitlements";

export const metadata = { title: "Creator Lab" };

export default async function CreatorPage() {
  const { userId, account } = await requireSession();

  if (!can(account.tier, "creator.lab")) {
    return (
      <>
        <PageHeader
          title="Creator Lab"
          lead="Trending topics, titles, hooks, thumbnail concepts and search keywords."
        />
        <div className="px-4 py-6 sm:px-8">
          <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <h2 className="text-sm font-medium text-ink">This is an Elite feature</h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
              Creator Lab turns a topic into a full content package, with titles
              written to claim something the video can actually deliver.
            </p>
            <ButtonLink href="/dashboard/settings" size="sm" className="mt-1">
              Go Elite
            </ButtonLink>
          </Panel>
        </div>
      </>
    );
  }

  const credits = await getStore().getCredits(userId);

  return (
    <>
      <PageHeader
        title="Creator Lab"
        lead="Turn a topic into titles, a hook, a thumbnail concept and search keywords. Everything here is an AI projection."
      />
      <div className="px-4 py-6 sm:px-8">
        <CreatorLab
          seeded={CREATOR_IDEAS}
          credits={credits}
          cost={CREDIT_COST["creator-lab"]}
        />
      </div>
    </>
  );
}
