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

      <div
        className="mt-6 flex items-start gap-2 sm:gap-4"
        role="timer"
        aria-live="off"
      >
        <Unit label="Days" value={value?.days} big />
        <Colon />
        <Unit label="Hours" value={value?.hours} pad big />
        <Colon />
        <Unit label="Minutes" value={value?.minutes} pad big />
        <Colon />
        <Unit label="Seconds" value={value?.seconds} pad big ticking />
      </div>

      <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-ink-faint">
        {unconfirmed ? (
          <>
            <span className="text-ink-muted">
              Rockstar has not confirmed this date.
            </span>{" "}
            {LAUNCH.source}. This project has shown {LAUNCH.history.length}{" "}
            earlier date
            {LAUNCH.history.length === 1 ? "" : "s"} that turned out to be
            wrong, so treat the clock as a guide and not a promise.
          </>
        ) : (
          <>
            <span className="text-ink-muted">Confirmed by Rockstar.</span>{" "}
            {LAUNCH.sourceUrl ? (
              <a
                href={LAUNCH.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                Read the announcement
              </a>
            ) : (
              LAUNCH.source
            )}
            . The date has moved {LAUNCH.history.length - 1} times before, so a
            third move would not be a surprise.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * One unit of the clock.
 *
 * The digits carry the sunset ramp as a gradient fill with a soft bloom
 * underneath, which is where nearly all of the visual weight comes from. The
 * seconds column pulses so the whole thing reads as live rather than printed.
 */
function Unit({
  label,
  value,
  pad: shouldPad,
  big,
  ticking,
}: {
  label: string;
  value: number | undefined;
  pad?: boolean;
  big?: boolean;
  ticking?: boolean;
}) {
  const display =
    value === undefined ? "--" : shouldPad ? pad(value) : String(value);

  return (
    <div className="flex flex-col items-center">
      <span className="relative block">
        {/* Bloom. Purely decorative, and hidden from the accessibility tree. */}
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-0 select-none blur-[26px] opacity-80",
            big ? "text-6xl sm:text-7xl lg:text-8xl" : "text-3xl",
            "tabular leading-none font-semibold tracking-tight",
          )}
          style={{
            background:
              "linear-gradient(165deg, #ff2d78 0%, #c657ff 60%, #ffa64d 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {display}
        </span>

        <span
          className={cx(
            "tabular relative block leading-none font-semibold tracking-tight",
            big ? "text-6xl sm:text-7xl lg:text-8xl" : "text-3xl",
            ticking && "animate-[pulse_1s_ease-in-out_infinite]",
          )}
          style={
            value === undefined
              ? { color: "var(--color-ink-faint)" }
              : {
                  background:
                    "linear-gradient(165deg, #ffffff 0%, #ffd6e6 18%, #ff4d92 52%, #c657ff 82%, #ffa64d 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }
          }
        >
          {display}
        </span>
      </span>

      <span className="mt-2 text-[10px] tracking-[0.2em] text-ink-faint uppercase">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span
      aria-hidden
      className="tabular mt-1 text-4xl leading-none font-semibold text-accent/30 select-none sm:mt-3 sm:text-6xl lg:text-7xl"
    >
      :
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export type { Countdown };
