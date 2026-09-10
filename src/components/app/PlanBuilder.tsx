"use client";

import { useState } from "react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Button, Panel, PanelHead, Skeleton, cx } from "@/components/ui/primitives";
import { STRATEGIES } from "@/lib/calc";
import { duration, money, moneyShort } from "@/lib/format";
import { HORIZON_META } from "@/lib/types";
import type { Asset, MoneyPlan, PlanStrategy, PlayerProfile } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

export function PlanBuilder({
  initialProfile,
  initialPlan,
  assets,
  credits,
  cost,
}: {
  initialProfile: PlayerProfile;
  initialPlan: MoneyPlan | null;
  assets: Pick<Asset, "id" | "name">[];
  credits: number;
  cost: number;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [plan, setPlan] = useState<MoneyPlan | null>(initialPlan);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(credits);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(
    new Set(initialPlan?.steps.filter((s) => s.done).map((s) => s.order) ?? []),
  );

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Plan generation failed.");
      setPlan(body.plan);
      setBalance(body.creditsRemaining);
      setDoneSteps(new Set());
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  const set = <K extends keyof PlayerProfile>(key: K, value: PlayerProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const completed = plan
    ? plan.steps.filter((s) => doneSteps.has(s.order)).length
    : 0;
  const totalMinutes = plan?.steps.reduce((sum, s) => sum + s.estMinutes, 0) ?? 0;
  const totalProfit = plan?.steps.reduce((sum, s) => sum + s.estProfit, 0) ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Inputs */}
      <Panel className="h-fit">
        <PanelHead title="Your situation" />
        <div className="space-y-4 p-5">
          <Field
            label="Cash on hand"
            hint="In-game dollars you hold right now."
            id="currentMoney"
          >
            <NumberInput
              id="currentMoney"
              value={profile.currentMoney}
              onChange={(v) => set("currentMoney", v)}
            />
          </Field>

          <Field label="Goal" hint="The balance you want to reach." id="goal">
            <NumberInput id="goal" value={profile.goal} onChange={(v) => set("goal", v)} />
          </Field>

          <Field label="Level" hint="Gates which missions and assets are available." id="level">
            <NumberInput
              id="level"
              value={profile.level}
              min={1}
              max={999}
              onChange={(v) => set("level", v)}
            />
          </Field>

          <Field label="Approach" hint="Changes what the planner is allowed to pick." id="playstyle">
            <select
              id="playstyle"
              value={profile.playstyle}
              onChange={(e) => set("playstyle", e.target.value as PlanStrategy)}
              className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              {STRATEGIES.find((s) => s.id === profile.playstyle)?.blurb}
            </p>
          </Field>

          <fieldset>
            <legend className="text-[13px] font-medium text-ink">What you already own</legend>
            <p className="mt-1 mb-2.5 text-[12px] text-ink-faint">
              Owned assets add passive income to the projection.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {assets.map((a) => {
                const on = profile.ownedAssetIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "ownedAssetIds",
                        on
                          ? profile.ownedAssetIds.filter((id) => id !== a.id)
                          : [...profile.ownedAssetIds, a.id],
                      )
                    }
                    className={cx(
                      "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      on
                        ? "border-accent bg-accent-dim text-accent"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="text-[13px] text-down">
              {error}
            </p>
          ) : null}

          <div className="border-t border-line pt-4">
            <Button
              onClick={generate}
              disabled={status === "loading" || profile.goal <= profile.currentMoney}
              className="w-full"
            >
              {status === "loading" ? "Generating" : "Generate plan"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-ink-faint">
              Costs {cost} Lab Credits. You have{" "}
              <span className="tabular text-ink-muted">{balance}</span>.
            </p>
          </div>
        </div>
      </Panel>

      {/* Output */}
      <div className="space-y-4">
        {status === "loading" ? <PlanSkeleton /> : null}

        {status !== "loading" && plan ? (
          <>
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[62ch]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-semibold text-ink">Plan summary</h2>
                    <ProvenanceTag value={plan.provenance} size="xs" />
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                    {plan.summary}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-5 text-right">
                  <div>
                    <dt className="text-[11px] text-ink-faint">Steps</dt>
                    <dd className="tabular text-lg text-ink">
                      {completed}/{plan.steps.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-faint">Time</dt>
                    <dd className="tabular text-lg text-ink">{duration(totalMinutes)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-faint">Net</dt>
                    <dd
                      className={cx(
                        "tabular text-lg",
                        totalProfit >= 0 ? "text-up" : "text-down",
                      )}
                    >
                      {moneyShort(totalProfit)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Panel>

            <Panel>
              <PanelHead
                title="Route"
                meta={
                  <span className="text-[11px] text-ink-faint">
                    {money(plan.startingCash)} to {money(plan.objective)}
                  </span>
                }
              />
              {(["short", "medium", "long"] as const).map((horizon) => {
                const steps = plan.steps.filter((s) => s.horizon === horizon);
                if (steps.length === 0) return null;

                const meta = HORIZON_META[horizon];
                const horizonProfit = steps.reduce((sum, s) => sum + s.estProfit, 0);
                const horizonMinutes = steps.reduce((sum, s) => sum + s.estMinutes, 0);
                const horizonDone = steps.every((s) => doneSteps.has(s.order));

                return (
                  <section key={horizon}>
                    {/*
                      Horizon header. Doubles as a progress marker: once every
                      step under it is ticked, the whole band reads as done.
                    */}
                    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line bg-surface-2 px-5 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <h3
                          className={cx(
                            "text-[12px] font-semibold",
                            horizonDone ? "text-up" : "text-ink",
                          )}
                        >
                          {meta.label}
                        </h3>
                        <span className="text-[11px] text-ink-faint">{meta.window}</span>
                      </div>
                      <span className="tabular text-[11px] text-ink-faint">
                        {duration(horizonMinutes)},{" "}
                        <span className={horizonProfit >= 0 ? "text-up" : "text-down"}>
                          {moneyShort(horizonProfit)}
                        </span>
                      </span>
                    </header>

              <ol className="divide-y divide-line/70">
                {steps.map((step) => {
                  const done = doneSteps.has(step.order);
                  return (
                    <li key={step.order} className="flex items-start gap-4 px-5 py-4">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => {
                          const next = new Set(doneSteps);
                          if (e.target.checked) next.add(step.order);
                          else next.delete(step.order);
                          setDoneSteps(next);
                        }}
                        aria-label={`Mark step ${step.order} complete`}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h3
                            className={cx(
                              "text-[14px] font-medium",
                              done ? "text-ink-faint line-through" : "text-ink",
                            )}
                          >
                            {step.title}
                          </h3>
                          <span className="rounded-full border border-line px-1.5 text-[10px] text-ink-faint">
                            {step.kind}
                          </span>
                        </div>
                        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
                          {step.detail}
                        </p>
                      </div>
                      <dl className="hidden shrink-0 gap-6 text-right sm:flex">
                        <div>
                          <dt className="text-[10px] text-ink-faint">Time</dt>
                          <dd className="tabular text-[13px] text-ink-muted">
                            {duration(step.estMinutes)}
                          </dd>
                        </div>
                        <div className="w-20">
                          <dt className="text-[10px] text-ink-faint">Profit</dt>
                          <dd
                            className={cx(
                              "tabular text-[13px]",
                              step.estProfit >= 0 ? "text-up" : "text-down",
                            )}
                          >
                            {moneyShort(step.estProfit)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ol>
                  </section>
                );
              })}
            </Panel>

            <Panel quiet className="p-5">
              <h2 className="text-[13px] font-semibold text-ink">Where this plan breaks</h2>
              <ul className="mt-3 space-y-2">
                {plan.risks.map((r) => (
                  <li key={r} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-down" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-faint">
                Produced by {plan.generatedBy === "claude" ? "Claude" : "the local analyst"} from
                placeholder data. Treat every figure as a projection.
              </p>
            </Panel>
          </>
        ) : null}

        {status !== "loading" && !plan ? (
          <Panel className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <p className="text-sm font-medium text-ink">No plan generated yet</p>
            <p className="max-w-sm text-[13px] text-ink-muted">
              Fill in where you stand on the left. The planner only picks from
              content your level actually unlocks.
            </p>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  id,
  children,
}: {
  label: string;
  hint: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      <p className="text-[12px] text-ink-faint">{hint}</p>
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  max = 1_000_000_000,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      className="tabular w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
    />
  );
}

function PlanSkeleton() {
  return (
    <>
      <Panel className="space-y-3 p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </Panel>
      <Panel className="divide-y divide-line/70">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 px-5 py-4">
            <Skeleton className="h-4 w-4 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-full max-w-lg" />
            </div>
          </div>
        ))}
      </Panel>
    </>
  );
}
