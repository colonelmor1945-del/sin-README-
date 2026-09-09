import { Assistant } from "@/components/app/Assistant";
import { PageHeader } from "@/components/app/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { getAiProvider } from "@/lib/ai";
import { getStore } from "@/lib/db/store";
import { TIERS } from "@/lib/entitlements";

export const metadata = { title: "AI assistant" };

export default async function AssistantPage() {
  const { userId, account } = await requireSession();
  const used = await getStore().getDailyQueries(userId);
  const limit = TIERS[account.tier].dailyQueries;
  const provider = getAiProvider();

  const quotaNote = `${Math.max(0, limit - used)} of ${limit} queries left today. Running on ${provider.label}. Answers are AI projections drawn from placeholder data.`;

  return (
    <div className="flex h-[calc(100dvh-0px)] flex-col lg:h-[100dvh]">
      <PageHeader
        title="AI assistant"
        lead="It reads your balance, level and assets before answering, then quotes the same formulas the rest of the platform runs on."
      />
      <div className="min-h-0 flex-1">
        <Assistant quotaNote={quotaNote} providerLabel={provider.label} />
      </div>
    </div>
  );
}
