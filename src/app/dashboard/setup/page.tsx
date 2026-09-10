import { ArrowSquareOut, Check, Warning } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/app/PageHeader";
import { Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { setupChecklist, setupSummary, type SetupImpact } from "@/lib/setup";

export const metadata = { title: "Setup" };

const IMPACT_META: Record<SetupImpact, { label: string; tone: string }> = {
  blocking: { label: "Blocking", tone: "border-down/45 text-down" },
  core: { label: "Core", tone: "border-accent/45 text-accent" },
  optional: { label: "Optional", tone: "border-line-strong text-ink-faint" },
};

/**
 * Setup checklist.
 *
 * Admin only, because it enumerates exactly which integrations are missing,
 * which is a map of the deployment's soft spots.
 */
export default async function SetupPage() {
  await requireAdmin();

  const items = setupChecklist();
  const summary = setupSummary(items);

  // Unconfigured first, and blocking above core above optional, so the top of
  // the page is always the next thing worth doing.
  const order: SetupImpact[] = ["blocking", "core", "optional"];
  const sorted = [...items].sort((a, b) => {
    if (a.configured !== b.configured) return a.configured ? 1 : -1;
    return order.indexOf(a.impact) - order.indexOf(b.impact);
  });

  return (
    <>
      <PageHeader
        title="Setup"
        lead="Every integration this build can use, what each one switches on, and what it costs. Unconfigured items come first."
      />

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Panel className="grid gap-6 p-6 sm:grid-cols-3">
          <Stat
            label="Configured"
            value={`${summary.done} of ${summary.total}`}
            tone={summary.done === summary.total ? "up" : "default"}
          />
          <Stat
            label="Blocking launch"
            value={String(summary.blocking.length)}
            tone={summary.blocking.length > 0 ? "down" : "up"}
            sub={summary.blocking.map((i) => i.label).join(", ") || "Nothing"}
          />
          <Stat
            label="Core, not blocking"
            value={String(summary.core.length)}
            sub={summary.core.map((i) => i.label).join(", ") || "Nothing"}
          />
        </Panel>

        <Panel>
          <PanelHead
            title="Checklist"
            meta={
              <span className="text-[11px] text-ink-faint">
                Set these in .env.local, then restart the server
              </span>
            }
          />

          <ul className="divide-y divide-line/70">
            {sorted.map((item) => {
              const meta = IMPACT_META[item.impact];
              return (
                <li key={item.id} className="flex items-start gap-4 px-5 py-4">
                  <span
                    className={cx(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      item.configured
                        ? "border-up/45 text-up"
                        : item.impact === "blocking"
                          ? "border-down/45 text-down"
                          : "border-line text-ink-faint",
                    )}
                    aria-hidden
                  >
                    {item.configured ? (
                      <Check size={14} weight="bold" />
                    ) : item.impact === "blocking" ? (
                      <Warning size={14} weight="bold" />
                    ) : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={cx(
                          "text-[14px] font-medium",
                          item.configured ? "text-ink-muted" : "text-ink",
                        )}
                      >
                        {item.label}
                      </h2>
                      {item.configured ? (
                        <span className="text-[11px] text-up">On</span>
                      ) : (
                        <span
                          className={cx(
                            "rounded-full border px-1.5 py-0 text-[9px] tracking-wide uppercase",
                            meta.tone,
                          )}
                        >
                          {meta.label}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 max-w-[78ch] text-[13px] leading-relaxed text-ink-muted">
                      {item.unlocks}
                    </p>

                    {item.note ? (
                      <p className="mt-2 max-w-[78ch] text-[12px] leading-relaxed text-ink-faint">
                        {item.note}
                      </p>
                    ) : null}

                    {!item.configured ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <code className="tabular rounded-[6px] border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink-muted">
                          {item.envVars.join(", ")}
                        </code>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-soft"
                          >
                            {item.where}
                            <ArrowSquareOut size={12} />
                          </a>
                        ) : (
                          <span className="text-[12px] text-ink-faint">{item.where}</span>
                        )}
                        <span className="text-[12px] text-ink-faint">{item.cost}</span>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel quiet className="p-5">
          <h2 className="text-[13px] font-semibold text-ink">
            Why panels say &ldquo;not configured&rdquo; instead of showing something
          </h2>
          <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink-muted">
            Every integration here degrades to an explanation rather than to
            invented content. A video feed with fake videos in it, or an economy
            tracker with numbers nobody measured, would look finished and be
            worse than useless. The cost is that a fresh install looks sparse
            until the keys are in, which is what this page exists to fix.
          </p>
        </Panel>
      </div>
    </>
  );
}
