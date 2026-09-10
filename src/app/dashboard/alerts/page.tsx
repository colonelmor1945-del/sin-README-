import Link from "next/link";

import { PageHeader } from "@/components/app/PageHeader";
import { ProvenanceTag } from "@/components/ProvenanceTag";
import { Panel, PanelHead, cx } from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { KIND_META, buildNotifications, type NotificationKind } from "@/lib/notifications";

export const metadata = { title: "Alerts" };

const KIND_TONE: Record<NotificationKind, string> = {
  launch: "border-accent/45 text-accent",
  portfolio: "border-up/40 text-up",
  opportunity: "border-accent/45 text-accent",
  plan: "border-line-strong text-ink-muted",
  credits: "border-line-strong text-ink-faint",
  data: "border-projection/45 text-projection",
};

export default async function AlertsPage() {
  const { userId } = await requireSession();
  const store = getStore();

  const [profile, plans, credits] = await Promise.all([
    store.getProfile(userId),
    store.listPlans(userId),
    store.getCredits(userId),
  ]);

  const items = buildNotifications({
    profile,
    plan: plans[0] ?? null,
    credits,
  });

  const kinds = Object.keys(KIND_META) as NotificationKind[];

  return (
    <>
      <PageHeader
        title="Alerts"
        lead="Only things about you. An asset you own moved, a step in your plan is blocked, the countdown crossed a milestone. General news lives in the intel feed."
      />

      <div className="grid gap-4 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_300px]">
        <Panel>
          <PanelHead
            title="Your alerts"
            meta={
              <span className="text-[11px] text-ink-faint">
                {items.length === 0
                  ? "Nothing needs you"
                  : `${items.length} item${items.length === 1 ? "" : "s"}`}
              </span>
            }
          />

          {items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-ink">Nothing needs you</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                No asset you own has moved, your plan is not blocked, and you
                have credits. That is the intended state, and an empty page beats
                an invented one.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={cx(
                        "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] tracking-wide uppercase",
                        KIND_TONE[item.kind],
                      )}
                    >
                      {KIND_META[item.kind].label}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14px] font-medium text-ink group-hover:text-accent">
                          {item.title}
                        </h2>
                        {item.provenance ? (
                          <ProvenanceTag value={item.provenance} size="xs" />
                        ) : null}
                      </div>
                      <p className="mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-ink-muted">
                        {item.body}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">What triggers an alert</h2>
            <ul className="mt-3 divide-y divide-line/70">
              {kinds.map((kind) => (
                <li key={kind} className="py-2.5 first:pt-0">
                  <p className="text-[13px] text-ink">{KIND_META[kind].label}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">
                    {KIND_META[kind].blurb}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel quiet className="p-5">
            <h2 className="text-[13px] font-semibold text-ink">Why this stays quiet</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Every alert here reads your own profile and plan, and there is no
              generator that fires on general product news. A bell that rings for
              things that are not about you is a bell people turn off, and then
              the one that mattered goes unread too.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              An asset move under five percent does not qualify. That is noise,
              and it does not change what the asset earns.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
