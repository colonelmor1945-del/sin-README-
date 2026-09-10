import { ArrowSquareOut, ArrowFatUp, Warning } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/app/PageHeader";
import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Panel, PanelHead, Stat, cx } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { labelFor, runIngestion } from "@/lib/ingest/pipeline";
import { CORROBORATION_REQUIRED, SOURCES, canAutoIngest } from "@/lib/ingest/sources";
import { timeAgo } from "@/lib/social/reddit";

export const metadata = { title: "Review queue" };

/**
 * Review queue.
 *
 * Everything the pipeline found, grouped by claim, with the corroboration count
 * visible. Admin only.
 *
 * Nothing on this page has reached the dataset. That is the point: the pipeline
 * gathers, a person decides. An unattended job that could promote a Reddit
 * thread into the economy tracker would make the platform's central claim false
 * at three in the morning with nobody watching.
 */
export default async function QueuePage() {
  await requireAdmin();

  const run = await runIngestion();
  const needed = CORROBORATION_REQUIRED.community ?? 2;

  const ready = run.items.filter((i) => i.corroboration >= needed);
  const failed = run.runs.filter((r) => !r.ok);

  return (
    <>
      <PageHeader
        title="Review queue"
        lead="What the pipeline found since the last run. Nothing here is in the dataset yet, and nothing gets there without a person promoting it."
      />

      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Panel className="grid gap-6 p-6 sm:grid-cols-4">
          <Stat label="Candidates" value={String(run.items.length)} />
          <Stat
            label={`Backed by ${needed} sources`}
            value={String(ready.length)}
            tone={ready.length > 0 ? "accent" : "default"}
            sub="Eligible for Community"
          />
          <Stat
            label="Sources polled"
            value={`${run.runs.length - failed.length} of ${run.runs.length}`}
            tone={failed.length > 0 ? "down" : "up"}
          />
          <Stat label="Run time" value={`${(run.ms / 1000).toFixed(1)}s`} />
        </Panel>

        {failed.length > 0 ? (
          <Panel quiet className="p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-down">
              <Warning size={15} />
              {failed.length} source{failed.length === 1 ? "" : "s"} did not answer
            </h2>
            <ul className="mt-3 space-y-1.5">
              {failed.map((r) => (
                <li key={r.sourceId} className="text-[12px] text-ink-muted">
                  <span className="text-ink">{labelFor(r.sourceId)}</span>: {r.error}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <Panel>
          <PanelHead
            title="Candidates"
            meta={
              <span className="text-[11px] text-ink-faint">
                Best corroborated first
              </span>
            }
          />

          {run.items.length === 0 ? (
            <p className="px-5 py-14 text-center text-[13px] leading-relaxed text-ink-muted">
              Nothing to review. Either the sources are unconfigured, which the
              Setup page will tell you, or there is genuinely nothing new.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {run.items.slice(0, 40).map((item) => {
                const corroborated = item.corroboration >= needed;
                return (
                  <li key={item.id} className="flex items-start gap-4 px-5 py-4">
                    <span
                      className={cx(
                        "tabular mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px]",
                        corroborated
                          ? "border-accent/45 text-accent"
                          : "border-line text-ink-faint",
                      )}
                      title={`${item.corroboration} independent source${item.corroboration === 1 ? "" : "s"}`}
                    >
                      {item.corroboration}
                    </span>

                    <div className="min-w-0 flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5"
                      >
                        <span className="line-clamp-2 text-[13px] leading-snug text-ink group-hover:text-accent">
                          {item.title}
                        </span>
                        <ArrowSquareOut
                          size={12}
                          className="mt-1 shrink-0 text-ink-faint"
                        />
                      </a>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                        <span>{labelFor(item.sourceId)}</span>
                        <span>{timeAgo(item.publishedAt)}</span>
                        {item.score !== undefined ? (
                          <span className="tabular inline-flex items-center gap-1">
                            <ArrowFatUp size={11} />
                            {item.score}
                          </span>
                        ) : null}
                        <code className="rounded-[4px] border border-line px-1.5 text-[10px]">
                          {item.claimKey}
                        </code>
                      </div>
                    </div>

                    <div className="hidden shrink-0 sm:block">
                      <ProvenanceTag value={item.provenance} size="xs" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">How a claim earns its label</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                `Community needs ${needed} independent sources. Ten Reddit threads repeating each other is one source agreeing with itself.`,
                "Estimated means our own formulas derived it from something else.",
                "Verified comes only from Rockstar, and only from a person who read the announcement and pasted its URL. Agreement between unofficial sources never produces it.",
              ].map((line) => (
                <li
                  key={line}
                  className="flex gap-2.5 text-[12px] leading-relaxed text-ink-muted"
                >
                  <span
                    className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-accent"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Sources</h2>
            <ul className="mt-3 divide-y divide-line/70">
              {SOURCES.map((source) => (
                <li key={source.id} className="py-2.5 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] text-ink">{source.label}</span>
                    <span className="text-[11px] text-ink-faint">
                      {canAutoIngest(source)
                        ? `Polled every ${source.intervalMinutes} min`
                        : "Manual entry"}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                    {source.note}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
