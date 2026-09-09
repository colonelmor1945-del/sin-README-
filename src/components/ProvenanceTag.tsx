import { PROVENANCE_META } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";
import { cx } from "@/components/ui/primitives";

/**
 * The single component that renders data confidence.
 *
 * Electric blue is reserved for "AI projection" and appears nowhere else in
 * the product, so an unverified number is visually distinct at a glance.
 */
const TONE: Record<Provenance, string> = {
  verified: "border-up/40 text-up",
  community: "border-line-strong text-ink-muted",
  estimated: "border-line-strong text-ink-faint",
  "ai-projection": "border-projection/45 text-projection",
};

export function ProvenanceTag({
  value,
  size = "sm",
}: {
  value: Provenance;
  size?: "sm" | "xs";
}) {
  const meta = PROVENANCE_META[value];
  return (
    <span
      title={meta.description}
      className={cx(
        "inline-flex shrink-0 items-center rounded-full border bg-transparent font-medium",
        TONE[value],
        size === "xs" ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
      )}
    >
      {size === "xs" ? meta.short : meta.label}
    </span>
  );
}

/** Full-width note used at the top of any surface that shows game data. */
export function DataNotice({ className }: { className?: string }) {
  return (
    <p className={cx("text-[11px] leading-relaxed text-ink-faint", className)}>
      GTA 6 has not shipped a stable public economy. Every figure here is
      placeholder data authored for this prototype and is labelled with its
      confidence level. Nothing in the current dataset is verified.
    </p>
  );
}
