"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Button, Panel, PanelHead, cx } from "@/components/ui/primitives";
import type { EditState } from "@/app/admin/content/actions";
import { PROVENANCE_META, PROVENANCE_ORDER } from "@/lib/provenance";
import type { Asset, Mission, Provenance } from "@/lib/types";

/**
 * Content editor.
 *
 * One row expands into a form. Deliberately not a grid of always-editable
 * inputs: this writes the numbers the entire product reasons from, and a
 * surface where a stray keystroke silently changes a payout is the wrong shape
 * for that.
 *
 * The provenance selector carries a warning rather than a plain label, because
 * choosing Verified is a claim about Rockstar having said something, and the
 * server refuses it without a citation.
 */


export function MissionEditor({
  missions,
  writable,
  reason,
  action,
}: {
  missions: Mission[];
  writable: boolean;
  reason?: string;
  action: (state: EditState, formData: FormData) => Promise<EditState>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel>
      <PanelHead
        title="Missions"
        meta={<span className="text-[11px] text-ink-faint">{missions.length} records</span>}
      />

      {!writable ? <ReadOnlyNotice reason={reason} /> : null}

      <ul className="divide-y divide-line/70">
        {missions.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setOpen(open === m.id ? null : m.id)}
              aria-expanded={open === m.id}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{m.name}</span>
                <span className="tabular block text-[11px] text-ink-faint">
                  {m.payout.toLocaleString()} · {m.duration}m · difficulty {m.difficulty}
                </span>
              </span>
              <ProvenanceTag value={m.provenance} size="xs" />
            </button>

            {open === m.id ? (
              <MissionForm mission={m} writable={writable} action={action} />
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function MissionForm({
  mission,
  writable,
  action,
}: {
  mission: Mission;
  writable: boolean;
  action: (state: EditState, formData: FormData) => Promise<EditState>;
}) {
  const [state, formAction] = useActionState<EditState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4 border-t border-line bg-surface-2 p-5">
      <input type="hidden" name="id" value={mission.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={mission.name} state={state} />
        <Field label="Strand" name="strand" defaultValue={mission.strand} state={state} />
        <Field label="Region" name="region" defaultValue={mission.region} state={state} />
        <Field
          label="Best strategy"
          name="bestStrategy"
          defaultValue={mission.bestStrategy}
          state={state}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field
          label="Payout"
          name="payout"
          type="number"
          defaultValue={String(mission.payout)}
          state={state}
        />
        <Field
          label="Minutes"
          name="duration"
          type="number"
          defaultValue={String(mission.duration)}
          state={state}
        />
        <Field
          label="Difficulty"
          name="difficulty"
          type="number"
          defaultValue={String(mission.difficulty)}
          hint="1 to 5"
          state={state}
        />
        <Field
          label="Crew"
          name="crewRequired"
          type="number"
          defaultValue={String(mission.crewRequired)}
          state={state}
        />
      </div>

      <TextareaField
        label="Prerequisites"
        name="prerequisites"
        defaultValue={mission.prerequisites.join("\n")}
        hint="One per line. A line containing 'level 12' sets the level gate."
      />
      <TextareaField
        label="Tips"
        name="tips"
        defaultValue={mission.tips.join("\n")}
        hint="One per line."
      />
      <input type="hidden" name="image" value={mission.image} />

      <ProvenanceField current={mission.provenance} state={state} />

      <Footer state={state} writable={writable} />
    </form>
  );
}

export function AssetEditor({
  assets,
  writable,
  reason,
  action,
}: {
  assets: Asset[];
  writable: boolean;
  reason?: string;
  action: (state: EditState, formData: FormData) => Promise<EditState>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel>
      <PanelHead
        title="Assets"
        meta={<span className="text-[11px] text-ink-faint">{assets.length} records</span>}
      />

      {!writable ? <ReadOnlyNotice reason={reason} /> : null}

      <ul className="divide-y divide-line/70">
        {assets.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpen(open === a.id ? null : a.id)}
              aria-expanded={open === a.id}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{a.name}</span>
                <span className="tabular block text-[11px] text-ink-faint">
                  {a.price.toLocaleString()} · {a.dailyNet.toLocaleString()} a day ·{" "}
                  {a.category}
                </span>
              </span>
              <ProvenanceTag value={a.provenance} size="xs" />
            </button>

            {open === a.id ? (
              <AssetForm asset={a} writable={writable} action={action} />
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function AssetForm({
  asset,
  writable,
  action,
}: {
  asset: Asset;
  writable: boolean;
  action: (state: EditState, formData: FormData) => Promise<EditState>;
}) {
  const [state, formAction] = useActionState<EditState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4 border-t border-line bg-surface-2 p-5">
      <input type="hidden" name="id" value={asset.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={asset.name} state={state} />
        <Field label="Region" name="region" defaultValue={asset.region} state={state} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field
          label="Price"
          name="price"
          type="number"
          defaultValue={String(asset.price)}
          state={state}
        />
        <Field
          label="Net a day"
          name="dailyNet"
          type="number"
          defaultValue={String(asset.dailyNet)}
          state={state}
        />
        <Field
          label="Upkeep"
          name="upkeep"
          type="number"
          defaultValue={String(asset.upkeep)}
          state={state}
        />
        <Field
          label="Unlock level"
          name="unlockLevel"
          type="number"
          defaultValue={String(asset.unlockLevel)}
          state={state}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${asset.id}-category`} className="text-[13px] font-medium text-ink">
          Category
        </label>
        <select
          id={`${asset.id}-category`}
          name="category"
          defaultValue={asset.category}
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none sm:max-w-xs"
        >
          {["business", "property", "vehicle", "service"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <TextareaField label="Note" name="note" defaultValue={asset.note} />

      <ProvenanceField current={asset.provenance} state={state} />

      <p className="rounded-[10px] border border-line bg-surface p-3 text-[12px] leading-relaxed text-ink-faint">
        Trend and the buy or hold call are derived from the price series on read,
        not stored. Saving a price appends an observation rather than replacing
        one, so the history behind every call the platform has made stays intact.
      </p>

      <Footer state={state} writable={writable} />
    </form>
  );
}

/* Shared ----------------------------------------------------------------- */

function ReadOnlyNotice({ reason }: { reason?: string }) {
  return (
    <p className="border-b border-line bg-surface-2 px-5 py-3 text-[12px] leading-relaxed text-ink-muted">
      {reason ?? "Editing is unavailable."}
    </p>
  );
}

function ProvenanceField({
  current,
  state,
}: {
  current: Provenance;
  state: EditState;
}) {
  const [value, setValue] = useState<Provenance>(current);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium text-ink">Provenance</label>
      <div className="flex flex-wrap gap-1.5">
        {PROVENANCE_ORDER.map((p) => (
          <label
            key={p}
            className={cx(
              "cursor-pointer rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              value === p
                ? "border-accent bg-accent-dim text-accent"
                : "border-line text-ink-muted hover:border-line-strong",
            )}
          >
            <input
              type="radio"
              name="provenance"
              value={p}
              checked={value === p}
              onChange={() => setValue(p)}
              className="sr-only"
            />
            {PROVENANCE_META[p].label}
          </label>
        ))}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-faint">
        {PROVENANCE_META[value].description}
      </p>

      {value === "verified" ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-accent/40 bg-accent-dim/30 p-3">
          <label htmlFor="sourceUrl" className="text-[12px] font-medium text-ink">
            Rockstar announcement URL
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            placeholder="https://www.rockstargames.com/newswire/article/..."
            className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Verified means Rockstar said it, and the only evidence for that is a
            link to where they said it. The server refuses this without one.
          </p>
        </div>
      ) : null}

      {state.field === "provenance" && state.error ? (
        <p role="alert" className="text-[12px] text-down">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function Footer({ state, writable }: { state: EditState; writable: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <Button type="submit" size="sm" disabled={!writable || pending}>
        {pending ? "Saving" : "Save"}
      </Button>

      {state.ok ? (
        <span className="text-[12px] text-up" role="status">
          Saved.
        </span>
      ) : null}

      {state.error && state.field !== "provenance" ? (
        <span role="alert" className="text-[12px] text-down">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  hint,
  state,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  hint?: string;
  state: EditState;
}) {
  const invalid = state.field === name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[12px] font-medium text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        className={cx(
          "w-full rounded-[10px] border bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none",
          type === "number" && "tabular",
          invalid ? "border-down" : "border-line focus:border-accent",
        )}
      />
      {invalid && state.error ? (
        <p role="alert" className="text-[11px] text-down">
          {state.error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[12px] font-medium text-ink">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink focus:border-accent focus:outline-none"
      />
      {hint ? <p className="text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
