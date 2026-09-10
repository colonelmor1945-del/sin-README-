import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Shared shell primitives. Server components, no client JS. */

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* Buttons ---------------------------------------------------------------- */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap font-medium transition-[transform,background-color,border-color] duration-200 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none";

const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-soft",
  outline: "border border-line-strong text-ink hover:border-accent hover:text-accent",
  ghost: "text-ink-muted hover:text-ink",
} as const;

const SIZES = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
} as const;

interface ButtonBase {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonBase & ComponentProps<"button">) {
  return (
    <button className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonBase & ComponentProps<typeof Link>) {
  return (
    <Link className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
  );
}

/* Panels ----------------------------------------------------------------- */

/**
 * A panel, optionally a link.
 *
 * Given an href it renders as an anchor rather than a section, so the whole
 * card is one target instead of a card with a link buried in it. That is the
 * difference between a panel that looks clickable and one that is: the
 * keyboard reaches it, the browser shows the destination on hover, middle
 * click opens a tab, and the hit area is the whole card rather than six words
 * of it.
 *
 * `label` is there because a card is usually a heading plus a paragraph plus
 * some numbers, and a screen reader announcing all of that as the link text is
 * unusable. It names the destination in a few words instead.
 */
export function Panel({
  className,
  children,
  quiet,
  href,
  label,
}: {
  className?: string;
  children: ReactNode;
  quiet?: boolean;
  href?: string;
  label?: string;
}) {
  const classes = cx(quiet ? "panel-quiet" : "panel", href && "neon-hit block", className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={label}>
        {children}
      </Link>
    );
  }

  return <section className={classes}>{children}</section>;
}

export function PanelHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="flex items-center gap-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
        {meta}
      </div>
      {action}
    </header>
  );
}

/* Data primitives -------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "default" | "accent" | "up" | "down";
}) {
  const toneClass = {
    default: "text-ink",
    accent: "text-accent",
    up: "text-up",
    down: "text-down",
  }[tone];

  return (
    <div>
      <div className="text-[11px] font-medium text-ink-faint">{label}</div>
      <div className={cx("tabular mt-1 text-2xl", toneClass)}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink-muted">{sub}</div> : null}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-sm text-[13px] text-ink-muted">{hint}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-[10px] bg-surface-3", className)}
      aria-hidden
    />
  );
}
