"use client";

import { useEffect, useState } from "react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { cx } from "@/components/ui/primitives";
import { LAUNCH, countdownFrom, type Countdown } from "@/lib/data/launch";

/**
 * Launch countdown.
 *
 * Two things this deliberately does not do:
 *  - It does not render a number on the server. The server and the client are
 *    never on the same millisecond, so a server-rendered clock is a guaranteed
 *    hydration mismatch. It renders a stable skeleton until mounted.
 *  - It does not present the date as fact. The provenance tag and the source
 *    line sit next to the digits, and when the date is not verified the
 *    component says so in words rather than only in a badge.
 */
export function LaunchCountdown({
  variant = "full",
}: {
  variant?: "full" | "compact";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const value = now === null ? null : countdownFrom(LAUNCH.target, now);
  const unconfirmed = LAUNCH.provenance !== "verified";

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular text-[13px] text-ink">
          {value === null ? (
            <span className="text-ink-faint">Loading</span>
          ) : value.released ? (
            "Out now"
          ) : (
            `${value.days}d ${pad(value.hours)}h ${pad(value.minutes)}m`
          )}
        </span>
        <span className="text-[11px] text-ink-faint">to launch</span>
        <ProvenanceTag value={LAUNCH.provenance} size="xs" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-ink-faint uppercase">
          {value?.released ? "Vice City is open" : "Countdown to Vice City"}
        </h2>
        <ProvenanceTag value={LAUNCH.provenance} size="xs" />
      </div>

      <div className="mt-4 flex gap-2 sm:gap-3" role="timer" aria-live="off">
        <Unit label="Days" value={value?.days} width="w-[92px] sm:w-[112px]" />
        <Unit label="Hours" value={value?.hours} pad />
        <Unit label="Minutes" value={value?.minutes} pad />
        <Unit label="Seconds" value={value?.seconds} pad accent />
      </div>

      <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-ink-faint">
        {unconfirmed ? (
          <>
            <span className="text-ink-muted">
              Rockstar has not confirmed this date.
            </span>{" "}
            {LAUNCH.source}. This project has shown{" "}
            {LAUNCH.history.length} earlier date
            {LAUNCH.history.length === 1 ? "" : "s"} that turned out to be
            wrong, so treat the clock as a guide and not a promise.
          </>
        ) : (
          <>Confirmed by {LAUNCH.source}.</>
        )}
      </p>
    </div>
  );
}

function Unit({
  label,
  value,
  pad: shouldPad,
  accent,
  width = "w-[72px] sm:w-[88px]",
}: {
  label: string;
  value: number | undefined;
  pad?: boolean;
  accent?: boolean;
  width?: string;
}) {
  const display =
    value === undefined ? "--" : shouldPad ? pad(value) : String(value);

  return (
    <div
      className={cx(
        "panel-quiet flex flex-col items-center justify-center px-2 py-3 sm:py-4",
        width,
      )}
    >
      <span
        className={cx(
          "tabular text-2xl leading-none sm:text-3xl",
          value === undefined
            ? "text-ink-faint"
            : accent
              ? "text-accent"
              : "text-ink",
        )}
      >
        {display}
      </span>
      <span className="mt-1.5 text-[10px] tracking-wide text-ink-faint uppercase">
        {label}
      </span>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export type { Countdown };
