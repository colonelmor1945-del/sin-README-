import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { DataNotice, ProvenanceTag } from "@/components/ProvenanceTag";
import { Panel, PanelHead, cx } from "@/components/ui/primitives";
import { NEWS, NEWS_CATEGORIES, type NewsCategory } from "@/lib/data/news";

export const metadata = { title: "Intel feed" };

const CATEGORY_TONE: Record<NewsCategory, string> = {
  official: "border-up/40 text-up",
  patch: "border-line-strong text-ink-muted",
  economy: "border-accent/45 text-accent",
  rumour: "border-projection/45 text-projection",
  community: "border-line-strong text-ink-faint",
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = NEWS_CATEGORIES.find((c) => c.id === category)?.id ?? null;

  const items = [...NEWS]
    .filter((n) => (active ? n.category === active : true))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const rumours = NEWS.filter((n) => n.category === "rumour").length;

  return (
    <>
      <PageHeader
        title="Intel feed"
        lead="Updates that change how you make money, and nothing else. Every entry says what it changes for your plan, and rumours are published as rumours."
      />

      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-1.5" aria-label="Filter by category">
            <FilterLink href="/dashboard/news" label="Everything" active={!active} />
            {NEWS_CATEGORIES.map((c) => (
              <FilterLink
                key={c.id}
                href={`/dashboard/news?category=${c.id}`}
                label={c.label}
                active={active === c.id}
              />
            ))}
          </nav>

          {items.length === 0 ? (
            <Panel className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-ink">Nothing in this category yet</p>
              <p className="mt-1.5 text-[13px] text-ink-muted">
                Try another filter, or read everything.
              </p>
            </Panel>
          ) : (
            <ol className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Panel className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cx(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase",
                          CATEGORY_TONE[item.category],
                        )}
                      >
                        {item.category}
                      </span>
                      <ProvenanceTag value={item.provenance} size="xs" />
                      <time
                        dateTime={item.publishedAt}
                        className="tabular text-[11px] text-ink-faint"
                      >
                        {item.publishedAt}
                      </time>
                    </div>

                    <h2 className="mt-3 text-[16px] leading-snug font-medium text-ink">
                      {item.title}
                    </h2>
                    <p className="mt-2 max-w-[75ch] text-[13px] leading-relaxed text-ink-muted">
                      {item.summary}
                    </p>

                    <div className="mt-4 rounded-[10px] border border-line bg-surface-2 p-3.5">
                      <h3 className="text-[11px] font-medium text-ink-faint">
                        What this changes for you
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                        {item.impact}
                      </p>
                    </div>

                    <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <p className="text-[11px] text-ink-faint">
                        Source: {item.source}
                      </p>
                      {item.affects.length ? (
                        <p className="text-[11px] text-ink-faint">
                          Affects: {item.affects.join(", ")}
                        </p>
                      ) : null}
                    </footer>
                  </Panel>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-4">
          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Editorial rule</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              An entry only runs if it changes a number somewhere in the
              platform, or if it is a claim circulating widely enough that
              readers deserve to know we checked it and rejected it.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              {rumours === 0
                ? "No open rumours in the feed right now."
                : `${rumours} entr${rumours === 1 ? "y is" : "ies are"} filed as an unverified rumour. Those never reach the mission or asset databases.`}
            </p>
          </Panel>

          <Panel quiet className="p-5">
            <PanelHeadInline title="Where it lands" />
            <ul className="mt-3 space-y-2 text-[12px] text-ink-muted">
              <li>
                <Link href="/dashboard/economy" className="hover:text-ink">
                  Economy tracker
                </Link>{" "}
                picks up price and payback changes.
              </li>
              <li>
                <Link href="/dashboard/missions" className="hover:text-ink">
                  Mission intelligence
                </Link>{" "}
                picks up payout and provenance changes.
              </li>
              <li>
                <Link href="/dashboard/plan" className="hover:text-ink">
                  Money plan
                </Link>{" "}
                uses whatever those two currently hold.
              </li>
            </ul>
          </Panel>

          <DataNotice />
        </div>
      </div>
    </>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(
        "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
        active
          ? "border-accent bg-accent-dim text-accent"
          : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

function PanelHeadInline({ title }: { title: string }) {
  return <h2 className="text-[13px] font-semibold text-ink">{title}</h2>;
}
