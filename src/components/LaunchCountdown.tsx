"use client";

import { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { ProvenanceTag } from "@/components/ProvenanceTag";
import { cx } from "@/components/ui/primitives";
import {
  LAUNCH,
  countdownFrom,
  waitProgress,
  type Countdown,
} from "@/lib/data/launch";

/**
 * How far along a pull is. See the state that holds it for why it has three
 * values rather than being a boolean.
 */
type Phase = "idle" | "loading" | "spinning";

/**
 * Launch countdown, built as a slot machine.
 *
 * The reels are the point: each digit is a strip behind glass, it blurs while
 * it is moving, and pulling the lever spins the whole cabinet and lands it back
 * on the true time. Nothing about the numbers is randomised. The reels always
 * settle on the real countdown, because a clock that lies for effect is the one
 * thing this product cannot ship.
 *
 * Two things it deliberately does not do:
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

  // Where a pull has got to. It lives here rather than in each reel so the
  // reels stay pure: they render the position their digit implies and own no
  // animation state of their own.
  //
  // "loading" exists because motion will not animate a keyframe array on this
  // build. The jump down to the start of the spin and the travel back up have
  // to be two plain targets a frame apart, so the pull is a small machine
  // rather than one animation.
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Hold at the start of the spin just long enough to be committed, then
    // release. Long enough to be a frame, short enough not to be a pause.
    if (phase === "loading") {
      const id = setTimeout(() => setPhase("spinning"), 40);
      return () => clearTimeout(id);
    }
    // Long enough for the last column, which starts latest, to finish.
    if (phase === "spinning") {
      const id = setTimeout(() => setPhase("idle"), 1900);
      return () => clearTimeout(id);
    }
  }, [phase]);

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

      <Cabinet onPull={() => setPhase("loading")}>
        {/* column is the reel's position in the cabinet. Real machines stop
            their reels left to right, so it drives the stagger. */}
        <Unit label="Days" value={value?.days} phase={phase} column={0} />
        <Colon />
        <Unit
          label="Hours"
          value={value?.hours}
          pad
          phase={phase}
          column={1}
        />
        <Colon />
        <Unit
          label="Minutes"
          value={value?.minutes}
          pad
          phase={phase}
          column={2}
        />
        <Colon />
        <Unit
          label="Seconds"
          value={value?.seconds}
          pad
          phase={phase}
          column={3}
        />
      </Cabinet>

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

/* Cabinet ---------------------------------------------------------------- */

const BULBS = 14;

/**
 * The machine the reels sit in.
 *
 * Marquee bulbs chase around the top and bottom edges, the panel is lit from
 * inside, and the lever on the right spins the reels. The bulbs are plain
 * elements running one CSS keyframe on a stagger rather than 28 animated
 * components, because this sits in the hero and the hero also runs a WebGL
 * backdrop.
 */
function Cabinet({
  children,
  onPull,
}: {
  children: React.ReactNode;
  onPull: () => void;
}) {
  return (
    <div
      className="relative mt-6 flex max-w-full items-stretch gap-1 overflow-hidden rounded-2xl border border-white/10 px-2 py-6 sm:gap-4 sm:px-5"
      style={{
        background:
          "linear-gradient(180deg, #21122b 0%, #140a1c 45%, #0b0611 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.14), inset 0 -18px 40px -20px rgba(255,45,120,.55), 0 24px 70px -30px rgba(198,87,255,.6)",
      }}
    >
      <Bulbs edge="top" />
      <Bulbs edge="bottom" />

      <div
        className="flex min-w-0 flex-1 items-start justify-center gap-0.5 sm:gap-2"
        role="timer"
        aria-live="off"
      >
        {children}
      </div>

      <Lever onPull={onPull} />
    </div>
  );
}

function Bulbs({ edge }: { edge: "top" | "bottom" }) {
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-x-3 h-1.5",
        edge === "top" ? "top-1.5" : "bottom-1.5",
      )}
    >
      {Array.from({ length: BULBS }, (_, i) => (
        <span
          key={i}
          className="marquee-bulb absolute top-0 h-1.5 w-1.5 rounded-full"
          style={{
            left: `${((i + 0.5) / BULBS) * 100}%`,
            // The two edges run in opposite phase so the light appears to
            // travel around the cabinet rather than pulse in sympathy.
            animationDelay: `${(edge === "top" ? i : BULBS - i) * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The lever.
 *
 * A real button, not a decorated div, so it is reachable by keyboard and
 * announces itself. The arm is what moves: pressing drops the knob down its
 * slot and releasing lets it snap back, which is the whole gesture.
 */
function Lever({ onPull }: { onPull: () => void }) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onPull}
      aria-label="Pull the lever to spin the reels"
      className="relative w-7 shrink-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:w-10"
      whileTap={reduce ? undefined : { scale: 0.97 }}
    >
      {/* The label sits above the arm rather than below it. Below, the arm
          runs straight through the text, because the arm is meant to be
          longer than the cabinet is tall. */}
      <span className="absolute inset-x-0 top-0 text-center text-[8px] tracking-[0.16em] text-ink-faint uppercase">
        Pull
      </span>

      {/* The slot the arm travels in. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-4 bottom-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-black/70"
        style={{ boxShadow: "inset 0 0 6px rgba(0,0,0,.95)" }}
      />

      {/*
        The arm is deliberately longer than the space it has. The cabinet clips
        it, so the rod runs into the floor of the machine instead of stopping in
        mid-air, which is where a real lever goes.
      */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-3.5 flex flex-col items-center"
        initial={false}
        whileHover={reduce ? undefined : { y: 5 }}
        whileTap={reduce ? undefined : { y: 14 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
      >
        <span
          className="h-[18px] w-[18px] rounded-full sm:h-6 sm:w-6"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, #ff8fb4 0%, #ff2d78 42%, #8e0f3c 100%)",
            boxShadow:
              "0 0 18px rgba(255,45,120,.75), inset 0 -2px 4px rgba(0,0,0,.5)",
          }}
        />
        <span
          className="-mt-0.5 h-12 w-[5px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #6b7280 0%, #e5e7eb 38%, #9ca3af 62%, #4b5563 100%)",
          }}
        />
      </motion.span>
    </motion.button>
  );
}

/* Reels ------------------------------------------------------------------ */

/**
 * The strip repeats 0-9 four times.
 *
 * Resting on the second cycle leaves one cycle above and two below, which is
 * what makes a spin possible without the strip running out: it starts two
 * cycles below the rest position and travels up to it. Both ends show the same
 * digit, so nothing visibly jumps when it lands.
 */
const CYCLES = 4;
const STRIP = CYCLES * 10;
/** One digit as a percentage of the strip's own height. */
const STEP = 100 / STRIP;
const REST_CYCLE = 1;

function Unit({
  label,
  value,
  pad: shouldPad,
  phase,
  column,
}: {
  label: string;
  value: number | undefined;
  pad?: boolean;
  phase: Phase;
  column: number;
}) {
  const display =
    value === undefined ? "--" : shouldPad ? pad(value) : String(value);

  return (
    <div className="flex min-w-0 flex-col items-center">
      {/*
        The reels are decorative and hidden. This is the only thing a screen
        reader sees, so it says the whole number and its unit in one phrase
        rather than spelling the digits out one at a time.
      */}
      <span className="sr-only">
        {display === "--"
          ? `${label} loading`
          : `${display} ${label.toLowerCase()}`}
      </span>

      <span aria-hidden className="flex gap-0.5 sm:gap-1">
        {display.split("").map((char, i) => (
          <Digit key={i} value={char} phase={phase} column={column} />
        ))}
      </span>

      <span
        aria-hidden
        className="mt-2 text-[8px] tracking-[0.12em] text-ink-faint uppercase sm:text-[10px] sm:tracking-[0.2em]"
      >
        {label}
      </span>
    </div>
  );
}

/**
 * One reel.
 *
 * Entirely declarative: the reel renders the position its digit implies, and
 * motion animates to it. Two earlier attempts drove it imperatively instead,
 * first by animating a motion value and then through animation controls, and
 * both left reels frozen wherever they were last put, because an imperative
 * start that races a mount silently does nothing. There is no animation state
 * here to fall out of step with the clock.
 *
 * The blur is a keyframe rather than something derived from velocity, so the
 * smear is tied to the gesture that causes it: a two-turn spin starts blurred
 * and sharpens as it lands, and a one-digit tick never blurs at all.
 */
function Digit({
  value,
  phase,
  column,
}: {
  value: string;
  phase: Phase;
  column: number;
}) {
  const reduce = useReducedMotion();

  const n = Number(value);
  const valid = !Number.isNaN(n);

  const rest = -(REST_CYCLE * 10 + (valid ? n : 0)) * STEP;
  const spinFrom = rest - 2 * 10 * STEP;

  const spinning = phase !== "idle" && !reduce;
  // Two cycles below during "loading", then the real position, which is what
  // makes the reel travel a full two turns to get back to the same digit.
  const target = spinning && phase === "loading" ? spinFrom : rest;

  return (
    <span
      className="relative block overflow-hidden rounded-md text-[1.75rem] leading-none sm:text-5xl lg:text-7xl"
      style={{
        background:
          "linear-gradient(180deg, #090410 0%, #170c20 50%, #090410 100%)",
        boxShadow:
          "inset 0 2px 6px rgba(0,0,0,.9), inset 0 -2px 6px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.07)",
      }}
    >
      {/* Reserves the window size without being visible. */}
      <span className="tabular invisible block px-1 font-semibold sm:px-2">
        0
      </span>

      {valid ? (
        <motion.span
          className="absolute inset-x-0 top-0 flex flex-col items-center"
          // No initial. With one, motion had a start and a target and still
          // animated neither: the reel stayed pinned to the initial transform
          // forever. Reading the current DOM transform as the start is what the
          // rolling digits did before the cabinet was built, and it works.
          initial={false}
          // The blur is plain CSS rather than an animated property. Motion
          // refused to run the whole animation with a filter keyframe in it,
          // and the reel is the part that has to move.
          style={{
            filter: spinning ? "blur(6px)" : "none",
            // Instant on the way in, eased on the way out, so the smear
            // appears the moment the reel takes off and clears as it lands.
            transition: spinning ? "none" : "filter .7s ease-out",
          }}
          animate={{ y: `${target}%` }}
          transition={
            reduce || phase === "loading"
              ? // Getting to the start of the spin is not part of the spin.
                { duration: 0 }
              : phase === "spinning"
                ? {
                    // Slow and heavy, so two turns take time and the reel
                    // overshoots before it settles. Later columns stop later,
                    // the way a real machine stops its reels left to right.
                    type: "spring",
                    stiffness: 55,
                    damping: 20,
                    mass: 1.4,
                    delay: column * 0.18,
                  }
                : // A tick: settle onto the new digit with a little overshoot.
                  { type: "spring", stiffness: 320, damping: 30, mass: 0.7 }
          }
        >
          {Array.from({ length: STRIP }, (_, i) => (
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
              {i % 10}
            </span>
          ))}
        </motion.span>
      ) : (
        <span className="tabular absolute inset-0 flex items-center justify-center font-semibold text-ink-faint">
          {value}
        </span>
      )}

      {/* Curvature. The strip is flat, so the depth has to be painted on: the
          edges darken as if the digits were rolling away over a drum. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,2,8,.95) 0%, rgba(4,2,8,.25) 22%, rgba(4,2,8,0) 46%, rgba(4,2,8,.3) 76%, rgba(4,2,8,.95) 100%)",
        }}
      />
      {/* Glass. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.03) 38%, rgba(255,255,255,0) 55%)",
        }}
      />
    </span>
  );
}

function Colon() {
  return (
    <span
      aria-hidden
      className="tabular mt-2 text-xl leading-none font-semibold text-accent/50 select-none sm:mt-4 sm:text-4xl lg:mt-7 lg:text-6xl"
      style={{ textShadow: "0 0 14px rgba(255,45,120,.7)" }}
    >
      :
    </span>
  );
}

/* Progress --------------------------------------------------------------- */

/**
 * How far through the announced wait we are.
 *
 * The reels say how long is left. This says how far you have come, which is
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
  const local = localLaunch();

  return (
    <div className="mt-6 max-w-[62ch]">
      <div className="flex items-baseline justify-between gap-4 text-[11px]">
        <span className="text-ink-faint">
          <span className="tabular text-ink-muted">
            {Math.round(fraction * 100)}%
          </span>{" "}
          of the wait done
        </span>
        <span className="tabular text-ink-faint">{local.date}</span>
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

      {/*
        The clock above counts to an instant, which is the same instant
        everywhere on earth. This line is the part that is not the same
        everywhere: what that instant reads as on the viewer's own wall clock.
      */}
      <p className="mt-1 text-[11px] text-ink-faint">
        That lands at{" "}
        <span className="tabular text-ink-muted">{local.time}</span> your time
        {local.zone ? (
          <>
            {" "}
            (<span className="tabular">{local.zone}</span>)
          </>
        ) : null}
        .
      </p>
    </div>
  );
});

/**
 * The launch instant, on the viewer's wall clock.
 *
 * The countdown itself does not depend on where you are: it counts down to a
 * single moment, and that moment arrives simultaneously for everyone. What
 * does depend on where you are is what that moment is *called* locally, and
 * for anyone far enough west it is not even the same date. Someone in Hawaii
 * sees the 18th, and telling them the 19th would be wrong rather than
 * approximate.
 *
 * So the date and time are formatted in the viewer's own locale and zone
 * rather than a fixed one. Client only, for the same reason the digits are:
 * the server does not know the viewer's zone, and guessing produces a
 * hydration mismatch.
 */
function localLaunch(): { date: string; time: string; zone: string } {
  const at = new Date(LAUNCH.target);

  const date = at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const time = at.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  // Not every engine reports a zone, so this is optional in the UI.
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    zone = "";
  }

  return { date, time, zone };
}

const pad = (n: number) => String(n).padStart(2, "0");

export type { Countdown };
