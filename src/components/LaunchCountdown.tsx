"use client";

import { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { cx } from "@/components/ui/primitives";
import { LAUNCH, countdownFrom, waitProgress, type Countdown } from "@/lib/data/launch";

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
        className="mt-6 flex items-start gap-1 sm:gap-3 lg:gap-4"
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

      <Progress />

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
 * How far through the announced wait we are.
 *
 * The digits say how long is left. This says how far you have come, which is
 * the half people actually feel, and it is the reason the block earns its
 * space rather than being decoration under a clock.
 *
 * It keeps its own clock instead of taking the one that drives the digits.
 * That looks like duplication and is not: the bar animates its fill over 1.4
 * seconds, and a prop that changes every second restarts that animation before
 * it can finish, so the bar creeps toward its value and never arrives. Ticking
 * once a minute is both plenty for a bar measured in days and enough to let the
 * fill complete. It is memoised for the same reason: it takes no props, and
 * without that the parent re-rendering every second hands motion a fresh
 * animate target each tick, which restarts the fill just as surely.
 */
const Progress = memo(function Progress() {
  const reduce = useReducedMotion();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Before hydration, the track alone. Rendering a number here would be a
  // hydration mismatch for the same reason the digits do not render one.
  if (now === null) {
    return <div className="mt-6 h-[3px] max-w-[62ch] rounded-full bg-line" />;
  }

  const { fraction, elapsedDays, totalDays } = waitProgress(now);
  const target = new Date(LAUNCH.target).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mt-6 max-w-[62ch]">
      <div className="flex items-baseline justify-between gap-4 text-[11px]">
        <span className="text-ink-faint">
          <span className="tabular text-ink-muted">
            {Math.round(fraction * 100)}%
          </span>{" "}
          of the wait done
        </span>
        <span className="tabular text-ink-faint">{target}</span>
      </div>

      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #ff2d78 0%, #c657ff 60%, #ffa64d 100%)",
            transformOrigin: "left",
          }}
          // A transform, not a layout property. Animating the width as a
          // percentage did not move at all here; the bar only crept forward
          // when something else re-rendered it.
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: fraction }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <p className="tabular mt-1.5 text-[11px] text-ink-faint">
        Day {elapsedDays} of {totalDays} since the date was announced
      </p>
    </div>
  );
});

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
      {/*
        The reel is decorative and hidden. This is the only thing a screen
        reader sees, so it says the whole number and its unit in one phrase
        rather than spelling the digits out one at a time.
      */}
      <span className="sr-only">
        {display === "--" ? `${label} loading` : `${display} ${label.toLowerCase()}`}
      </span>
      <span className="relative block">
        {/* Bloom sits behind the reel and does not roll, so the glow stays put
            while the digits turn. */}
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-0 select-none blur-[16px] opacity-80 sm:blur-[26px]",
            big ? "text-[2.75rem] sm:text-6xl lg:text-8xl" : "text-3xl",
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

        <span className="relative flex">
          {display.split("").map((char, i) => (
            <Digit
              key={i}
              value={char}
              size={big ? "text-[2.75rem] sm:text-6xl lg:text-8xl" : "text-3xl"}
            />
          ))}
        </span>
      </span>

      <span
        aria-hidden
        className="mt-2 text-[9px] tracking-[0.14em] text-ink-faint uppercase sm:text-[10px] sm:tracking-[0.2em]"
      >
        {label}
      </span>
    </div>
  );
}

/**
 * A single rolling digit.
 *
 * The strip holds 0 through 9 and slides to the right offset, so a tick reads
 * as the digit turning over rather than being swapped out. Only the digits
 * that actually changed move, which is why the seconds column rolls every
 * second and the days column sits still for a day.
 */
function Digit({ value, size }: { value: string; size: string }) {
  const reduce = useReducedMotion();
  const n = Number(value);

  // Not a number, so nothing to roll. The placeholder before hydration.
  if (Number.isNaN(n)) {
    return (
      <span aria-hidden className={cx("tabular block leading-none font-semibold text-ink-faint", size)}>
        {value}
      </span>
    );
  }

  return (
    <span aria-hidden className={cx("relative block overflow-hidden leading-none", size)}>
      {/* Reserves the column width without being visible or read aloud. */}
      <span className="tabular invisible block font-semibold" aria-hidden>
        0
      </span>
      {/*
        The strip is ten digits tall and a percentage translate is measured
        against the element's own height, so one digit is 10 percent of the strip
        and not 100. Using 100 scrolled nine digits past the window and left the
        column blank, which is exactly what it did.
      */}
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        animate={{ y: `-${n * 10}%` }}
        transition={
          reduce
            ? { duration: 0 }
            : // Overshoot slightly and settle, the way a mechanical reel does.
              { type: "spring", stiffness: 320, damping: 30, mass: 0.7 }
        }
        aria-hidden
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="tabular block font-semibold tracking-tight"
            style={{
              background:
                "linear-gradient(165deg, #ffffff 0%, #ffd6e6 18%, #ff4d92 52%, #c657ff 82%, #ffa64d 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Colon() {
  return (
    <span
      aria-hidden
      className="tabular mt-0.5 text-3xl leading-none font-semibold text-accent/30 select-none sm:mt-2 sm:text-5xl lg:mt-3 lg:text-7xl"
    >
      :
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export type { Countdown };
