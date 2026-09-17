import type { CreatorIdea, ScriptBeat } from "@/lib/types";

/**
 * Turns a Creator Lab script into a cut plan.
 *
 * The Lab already emits what is effectively an edit decision list — beats with
 * a start time, a line to say, and a note about what is on screen. This works
 * out the rest: where each beat ends, what survives a platform's length cap,
 * where the captions go, and how it all maps onto footage that is never the
 * length the script assumed.
 *
 * Deliberately free of any encoder. This is the part that decides whether the
 * idea works, and it is worth being able to test it without rendering a frame.
 */

/** Vertical, because every short-form surface is. */
export const FRAME = { width: 1080, height: 1920 } as const;

/**
 * Length caps.
 *
 * Both platforms have raised these more than once and will again, so they are
 * data rather than constants in the logic. The number that actually matters is
 * not the cap but the point where retention collapses, which is far below it —
 * hence `ideal`, which is what the planner aims at.
 */
export const PLATFORMS = {
  shorts: { label: "YouTube Shorts", maxSeconds: 180, ideal: 60 },
  reels: { label: "Instagram Reels", maxSeconds: 180, ideal: 60 },
} as const;

export type Platform = keyof typeof PLATFORMS;

export interface CutSegment {
  /** Which beat this came from, so the UI can show the plan against the script. */
  label: string;
  /** Seconds into the source footage. */
  sourceStart: number;
  sourceEnd: number;
  /** Seconds into the finished short. */
  start: number;
  end: number;
  /**
   * The line on screen.
   *
   * From `narration`, never from `onScreen`. `onScreen` is a direction written
   * for a person holding a camera — "cold open on the nightclub exterior" — and
   * burning that in would put the stage directions in the video.
   */
  caption: string;
}

export interface CutPlan {
  platform: Platform;
  segments: CutSegment[];
  /** Total length of the finished short. */
  duration: number;
  /** Beats dropped to fit, in the order they were dropped. */
  dropped: string[];
  /** Things a person should know before rendering. */
  warnings: string[];
}

/** Captions are read in motion on a phone. This is about two seconds of reading. */
const CAPTION_MAX = 68;

/**
 * One line, short enough to read at a glance.
 *
 * Cuts at a sentence end when there is one in range, because half a sentence
 * reads as a mistake and a whole short one reads as a caption.
 */
export function toCaption(narration: string, max = CAPTION_MAX): string {
  const text = narration.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;

  const sentenceEnd = text.slice(0, max + 1).lastIndexOf(". ");
  if (sentenceEnd > max * 0.4) return text.slice(0, sentenceEnd + 1);

  // Search one character past the budget: if a space sits exactly at `max`,
  // the word before it fits whole and slicing at `max` would still split it.
  const wordEnd = text.slice(0, max + 1).lastIndexOf(" ");
  return text.slice(0, wordEnd > 0 ? wordEnd : max).trimEnd() + "…";
}

/** A beat ends where the next one starts; the last one ends with the script. */
function beatEnd(beats: ScriptBeat[], index: number, runtime: number): number {
  const next = beats[index + 1];
  return next ? next.at : runtime;
}

/**
 * Which beat to drop when the script does not fit.
 *
 * Not the longest, and never the first or the last. The opening decides whether
 * anyone watches past two seconds and the closing carries whatever the video
 * promised, so the middle is the only honest place to cut. Within the middle,
 * the longest goes first: it costs the fewest cuts to buy the time.
 */
function dropOrder(beats: ScriptBeat[], runtime: number): number[] {
  const middle = beats.map((_, i) => i).slice(1, -1);
  return middle.sort((a, b) => {
    const lengthA = beatEnd(beats, a, runtime) - beats[a].at;
    const lengthB = beatEnd(beats, b, runtime) - beats[b].at;
    return lengthB - lengthA;
  });
}

export function planCut({
  idea,
  sourceDuration,
  platform = "shorts",
  target,
}: {
  idea: CreatorIdea;
  /** Length of the footage the creator actually has, in seconds. */
  sourceDuration: number;
  platform?: Platform;
  /** Override the length to aim at. Clamped to the platform cap. */
  target?: number;
}): CutPlan {
  const spec = PLATFORMS[platform];
  const warnings: string[] = [];
  const dropped: string[] = [];

  const beats = [...idea.script].sort((a, b) => a.at - b.at);
  if (beats.length === 0) {
    return {
      platform,
      segments: [],
      duration: 0,
      dropped: [],
      warnings: ["This idea has no script to cut to."],
    };
  }

  const runtime = Math.max(idea.runtimeSeconds, beatEnd(beats, beats.length - 1, 0));
  const cap = Math.min(target ?? spec.ideal, spec.maxSeconds);

  // Drop from the middle until the plan fits, worst offender first.
  const keep = new Set(beats.map((_, i) => i));
  const order = dropOrder(beats, runtime);
  let planned = runtime;

  for (const index of order) {
    if (planned <= cap) break;
    const length = beatEnd(beats, index, runtime) - beats[index].at;
    keep.delete(index);
    dropped.push(beats[index].label);
    planned -= length;
  }

  if (planned > cap) {
    warnings.push(
      `The opening and closing alone run ${Math.round(planned)}s, past the ${cap}s target. They are kept rather than cut, because trimming the hook costs more than a slightly long short.`,
    );
  }

  // Lay the survivors end to end. Gaps left by dropped beats close up.
  const segments: CutSegment[] = [];
  let playhead = 0;

  for (const [index, beat] of beats.entries()) {
    if (!keep.has(index)) continue;

    const length = beatEnd(beats, index, runtime) - beat.at;
    if (length <= 0) continue;

    segments.push({
      label: beat.label,
      sourceStart: beat.at,
      sourceEnd: beat.at + length,
      start: playhead,
      end: playhead + length,
      caption: toCaption(beat.narration),
    });
    playhead += length;
  }

  // Footage shorter than the script is the normal case, not the exception: the
  // script was written before anyone recorded anything. Segments past the end
  // of the footage are dropped rather than rendered as black.
  const usable = segments.filter((s) => s.sourceStart < sourceDuration);
  if (usable.length < segments.length) {
    warnings.push(
      `The footage is ${Math.round(sourceDuration)}s and the script reaches ${Math.round(runtime)}s, so ${segments.length - usable.length} beat${segments.length - usable.length === 1 ? "" : "s"} had nothing to cut from.`,
    );
  }

  // A beat that only partly overlaps the footage is trimmed, not dropped.
  let cursor = 0;
  const trimmed = usable.map((segment) => {
    const sourceEnd = Math.min(segment.sourceEnd, sourceDuration);
    const length = sourceEnd - segment.sourceStart;
    const out = {
      ...segment,
      sourceEnd,
      start: cursor,
      end: cursor + length,
    };
    cursor += length;
    return out;
  });

  if (trimmed.length === 0) {
    warnings.push("None of the script lands inside the footage supplied.");
  }

  // The platform cap is hard in a way the target is not: past it the upload is
  // rejected outright, so "keep the closing intact" stops applying and the tail
  // gets trimmed. A short that is thirty seconds long is a compromise; one that
  // cannot be posted is not a short.
  const capped: CutSegment[] = [];
  let total = 0;
  for (const segment of trimmed) {
    if (total >= spec.maxSeconds) {
      warnings.push(
        `"${segment.label}" falls past the ${spec.maxSeconds}s limit for ${spec.label} and was cut.`,
      );
      continue;
    }
    const room = spec.maxSeconds - total;
    const length = Math.min(segment.end - segment.start, room);
    if (length < segment.end - segment.start) {
      warnings.push(
        `"${segment.label}" was trimmed to fit the ${spec.maxSeconds}s limit for ${spec.label}.`,
      );
    }
    capped.push({
      ...segment,
      sourceEnd: segment.sourceStart + length,
      start: total,
      end: total + length,
    });
    total += length;
  }

  return { platform, segments: capped, duration: total, dropped, warnings };
}
