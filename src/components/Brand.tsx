import Link from "next/link";

import { cx } from "@/components/ui/primitives";

/**
 * Wordmark. Set in type rather than drawn, which keeps it crisp at every size
 * and avoids shipping a hand-rolled decorative SVG.
 */
export function Brand({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md";
  href?: string;
}) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-1.5">
      <span
        className={cx(
          "font-semibold leading-none tracking-tight text-ink",
          size === "sm" ? "text-[15px]" : "text-lg",
        )}
      >
        GTA
      </span>
      <span
        className={cx(
          "font-semibold leading-none tracking-tight text-accent transition-colors group-hover:text-accent-soft",
          size === "sm" ? "text-[15px]" : "text-lg",
        )}
      >
        6
      </span>
      <span
        className={cx(
          "font-medium leading-none tracking-[0.16em] text-ink-muted",
          size === "sm" ? "text-[10px]" : "text-[11px]",
        )}
      >
        MONEY LAB
      </span>
    </Link>
  );
}
