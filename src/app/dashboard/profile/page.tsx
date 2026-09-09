import { revalidatePath } from "next/cache";

import { PageHeader } from "@/components/app/PageHeader";
import { Button, Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { STRATEGIES, projectGoal, sustainableHourly } from "@/lib/calc";
import { ASSETS, assetById } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { getStore } from "@/lib/db/store";
import { duration, money, moneyShort } from "@/lib/format";
import type { PlanStrategy } from "@/lib/types";

export const metadata = { title: "Profile" };

/**
 * Server action. Validation and persistence both happen on the server; the
 * form is a plain uncontrolled form with no client JavaScript.
 */
async function saveProfile(formData: FormData) {
  "use server";

  const { userId } = await requireSession();
  const store = getStore();
  const existing = await store.getProfile(userId);

  const num = (key: string, fallback: number, max: number) => {
    const raw = Number(formData.get(key));
    return Number.isFinite(raw) ? Math.min(max, Math.max(0, Math.round(raw))) : fallback;
  };

  const playstyleRaw = String(formData.get("playstyle") ?? "");
  const playstyle = STRATEGIES.some((s) => s.id === playstyleRaw)
    ? (playstyleRaw as PlanStrategy)
    : existing.playstyle;

  await store.saveProfile(userId, {
    ...existing,
    currentMoney: num("currentMoney", existing.currentMoney, 1_000_000_000),
    level: Math.max(1, num("level", existing.level, 999)),
    goal: Math.max(1000, num("goal", existing.goal, 1_000_000_000)),
    playstyle,
    ownedAssetIds: formData.getAll("owned").map(String).slice(0, 40),
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
}

export default async function ProfilePage() {
  const { userId, account } = await requireSession();
  const profile = await getStore().getProfile(userId);

  const owned = profile.ownedAssetIds
    .map((id) => assetById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const hourly = sustainableHourly(MISSIONS, owned, profile.level);
  const projection = projectGoal(profile.currentMoney, profile.goal, hourly);
  const passive = owned.reduce((sum, a) => sum + a.dailyNet, 0);

  return (
    <>
      <PageHeader
        title="Profile"
        lead="The assistant and the planner read these values before they answer, so keeping them current is what makes the advice specific."
      />

      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PanelHead title="Your situation" />
          <form action={saveProfile} className="space-y-5 p-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="currentMoney" label="Cash on hand" hint="In-game dollars.">
                <input
                  id="currentMoney"
                  name="currentMoney"
                  type="number"
                  defaultValue={profile.currentMoney}
                  min={0}
                  className="tabular w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
              </Field>
              <Field id="level" label="Level" hint="Gates content.">
                <input
                  id="level"
                  name="level"
                  type="number"
                  defaultValue={profile.level}
                  min={1}
                  max={999}
                  className="tabular w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
              </Field>
              <Field id="goal" label="Goal" hint="Target balance.">
                <input
                  id="goal"
                  name="goal"
                  type="number"
                  defaultValue={profile.goal}
                  min={1000}
                  className="tabular w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
              </Field>
            </div>

            <Field
              id="playstyle"
              label="Preferred approach"
              hint="Changes what the planner is allowed to pick from."
            >
              <select
                id="playstyle"
                name="playstyle"
                defaultValue={profile.playstyle}
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none sm:max-w-xs"
              >
                {STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="border-t border-line pt-5">
              <legend className="text-[13px] font-medium text-ink">
                Assets you own
              </legend>
              <p className="mt-1 mb-3 text-[12px] text-ink-faint">
                Owned assets add passive income to every projection.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ASSETS.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong"
                  >
                    <input
                      type="checkbox"
                      name="owned"
                      value={a.id}
                      defaultChecked={profile.ownedAssetIds.includes(a.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">{a.name}</span>
                      <span className="tabular block text-[11px] text-ink-faint">
                        {a.dailyNet > 0 ? `${moneyShort(a.dailyNet)} a day` : "no income"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-line pt-5">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel className="space-y-5 p-5">
            <Stat label="Account" value={account.username} sub={account.email} />
            <div className="border-t border-line pt-5">
              <Stat
                label="Plan"
                value={account.tier}
                sub={
                  account.tier === "free"
                    ? "5 AI queries a day"
                    : "Unlimited AI queries"
                }
              />
            </div>
          </Panel>

          <Panel quiet className="space-y-4 p-5">
            <h2 className="text-[13px] font-semibold text-ink">Current projection</h2>
            <Stat label="Passive income" value={`${moneyShort(passive)}/day`} tone="up" />
            <Stat label="Sustainable rate" value={`${moneyShort(hourly)}/h`} />
            <Stat
              label="Time to goal"
              value={
                projection.reachable ? duration(projection.minutesNeeded) : "no route"
              }
              sub={`${money(projection.gap)} remaining`}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-2")}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      <p className="text-[12px] text-ink-faint">{hint}</p>
    </div>
  );
}
