import type { ReactNode } from "react";

export function PageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-muted">
          {lead}
        </p>
      </div>
      {action}
    </header>
  );
}
