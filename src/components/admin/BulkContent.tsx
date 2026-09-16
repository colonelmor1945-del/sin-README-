"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Panel, PanelHead, cx } from "@/components/ui/primitives";
import type { ImportState } from "@/app/admin/content/actions";

/**
 * Bulk import and export.
 *
 * The dataset has to be rebuilt the week the game ships, and the record-at-a-
 * time editor makes the bottleneck the fact that one person types. Export to a
 * spreadsheet, work on it together, paste it back.
 *
 * Rejected rows are listed rather than counted. "12 of 40 rows failed" sends
 * somebody hunting; a line number and a reason is something to go and fix.
 */
export function BulkContent({
  kind,
  writable,
  reason,
  importAction,
  exportAction,
}: {
  kind: "missions" | "assets" | "map locations" | "news";
  writable: boolean;
  reason?: string;
  importAction: (state: ImportState, formData: FormData) => Promise<ImportState>;
  exportAction: () => Promise<string>;
}) {
  const [state, formAction] = useActionState<ImportState, FormData>(importAction, {});
  const [text, setText] = useState("");
  const [exporting, setExporting] = useState(false);

  async function download() {
    setExporting(true);
    try {
      const csv = await exportAction();
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setText(await file.text());
  }

  return (
    <Panel>
      <PanelHead
        title={`Bulk ${kind}`}
        action={
          <Button variant="outline" size="sm" onClick={download} disabled={exporting}>
            {exporting ? "Preparing…" : "Export CSV"}
          </Button>
        }
      />

      {!writable ? (
        <p className="border-b border-line bg-surface-2 px-5 py-3 text-[12px] leading-relaxed text-ink-muted">
          {reason ?? "Importing is unavailable."}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-ink-muted">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-[12px] text-ink-muted file:mr-3 file:rounded-[8px] file:border file:border-line-strong file:bg-surface-2 file:px-3 file:py-1.5 file:text-[12px] file:text-ink hover:file:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-ink-muted">
            …or paste rows straight from the spreadsheet
          </span>
          <textarea
            name="csv"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="id,name,provenance,…"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 font-mono text-[12px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </label>

        {state.error ? (
          <p role="alert" className="rounded-[10px] border border-down/40 bg-down/5 px-3.5 py-2.5 text-[13px] text-down">
            {state.error}
          </p>
        ) : null}

        {state.saved !== undefined && state.saved > 0 ? (
          <p className="rounded-[10px] border border-up/40 bg-up/5 px-3.5 py-2.5 text-[13px] text-up">
            Saved {state.saved} row{state.saved === 1 ? "" : "s"}.
          </p>
        ) : null}

        {state.problems && state.problems.length > 0 ? (
          <div className="rounded-[10px] border border-down/40 bg-down/5 p-3.5">
            <p className="text-[12px] font-medium text-down">
              {state.problems.length} row{state.problems.length === 1 ? "" : "s"} not
              imported. Everything else was saved.
            </p>
            <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {state.problems.map((problem) => (
                <li key={problem} className="font-mono text-[11px] leading-relaxed text-ink-muted">
                  {problem}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={cx("flex items-center gap-3", !writable && "opacity-50")}>
          <Submit disabled={!writable} />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Every row goes through the same checks as the form, including the
            Rockstar citation for Verified.
          </p>
        </div>
      </form>
    </Panel>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? "Importing…" : "Import"}
    </Button>
  );
}
