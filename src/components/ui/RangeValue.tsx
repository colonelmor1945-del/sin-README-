import { cx } from "@/components/ui/primitives";
import { isTightRange, type Estimate } from "@/lib/calc";

/**
 * Renders a bounded estimate.
 *
 * The product refuses to imply a precision it does not have, so anything a
 * player might plan around shows both ends. When the two ends are close enough
 * to be the same decision, it collapses to one figure rather than adding noise.
 */
export function RangeValue({
  estimate,
  format,
  suffix,
  tone = "default",
  className,
}: {
  estimate: Estimate;
  format: (n: number) => string;
  suffix?: string;
  tone?: "default" | "accent" | "muted";
  className?: string;
}) {
  const toneClass = {
    default: "text-ink",
    accent: "text-accent",
    muted: "text-ink-muted",
  }[tone];

  const tight = isTightRange(estimate);

  return (
    <span
      title={estimate.basis}
      className={cx("tabular whitespace-nowrap", toneClass, className)}
    >
      {tight ? (
        <>
          {format(estimate.point)}
          {suffix}
        </>
      ) : (
        <>
          {format(estimate.low)}
          <span className="px-1 text-ink-faint">to</span>
          {format(estimate.high)}
          {suffix}
        </>
      )}
    </span>
  );
}
