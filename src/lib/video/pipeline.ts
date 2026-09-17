/**
 * The parts of a WebCodecs pipeline that are decisions rather than API calls.
 *
 * Everything here is pure, so the four things that actually break a browser
 * encoder can be tested without a browser. The glue that calls
 * VideoDecoder/VideoEncoder is thin on top of this and holds no logic of its
 * own, which is the point: the logic is where the bugs live, and it is the
 * part a test can reach.
 */

/* Seeking ----------------------------------------------------------------- */

/**
 * Where to start decoding for a cut that begins mid-GOP.
 *
 * A compressed frame is expressed as a difference from earlier frames, so
 * decoding cannot start at an arbitrary timestamp — it has to start at the
 * last keyframe at or before the in-point, and the frames between that
 * keyframe and the in-point are decoded and thrown away. Skipping that step
 * produces the familiar smeared, blocky opening on every cut.
 *
 * @param keyframes Keyframe timestamps in seconds, ascending.
 * @returns The timestamp to start decoding from, or null when there is no
 *   keyframe at or before the in-point, which means the file is unusable
 *   rather than that the cut should start at zero.
 */
export function keyframeFor(keyframes: number[], inPoint: number): number | null {
  let best: number | null = null;
  for (const timestamp of keyframes) {
    if (timestamp > inPoint) break;
    best = timestamp;
  }
  return best;
}

/**
 * Whether a decoded frame belongs in the output.
 *
 * Half-open on purpose: a frame exactly at the out-point belongs to the next
 * cut. Closing both ends duplicates a frame at every join, which reads as a
 * stutter.
 */
export function keepFrame(timestamp: number, inPoint: number, outPoint: number): boolean {
  return timestamp >= inPoint && timestamp < outPoint;
}

/** How many frames get decoded and dropped to reach an in-point. Cost, not correctness. */
export function warmupCost(keyframes: number[], inPoint: number, fps: number): number {
  const start = keyframeFor(keyframes, inPoint);
  if (start === null) return 0;
  return Math.max(0, Math.round((inPoint - start) * fps));
}

/* Backpressure ------------------------------------------------------------ */

/**
 * Encoders accept frames faster than they encode them.
 *
 * `encodeQueueSize` is the depth of that backlog, and nothing stops it
 * growing. Pushing a whole clip in as fast as the decoder produces it queues
 * every frame at once, and since each queued frame holds its own pixel buffer,
 * the tab runs out of memory long before the encode finishes.
 *
 * So: stop feeding at `high`, resume at `low`. Two thresholds rather than one
 * because a single one makes every frame past the limit a separate wait, and
 * the encoder spends its time being woken up instead of encoding.
 */
export interface FlowState {
  paused: boolean;
}

export function createFlow(): FlowState {
  return { paused: false };
}

export function shouldWait(
  state: FlowState,
  queueSize: number,
  { high = 12, low = 4 }: { high?: number; low?: number } = {},
): boolean {
  if (state.paused) {
    // Stay paused until the backlog has properly drained, not the moment it
    // dips below the high mark.
    if (queueSize <= low) state.paused = false;
    return state.paused;
  }

  if (queueSize >= high) {
    state.paused = true;
    return true;
  }
  return false;
}

/* Audio ------------------------------------------------------------------- */

export interface Segment {
  sourceStart: number;
  sourceEnd: number;
  start: number;
  end: number;
}

export interface GainPoint {
  /** Seconds into the finished video. */
  at: number;
  gain: number;
}

/**
 * A gain envelope that stops the joins clicking.
 *
 * Cutting audio at an arbitrary sample almost never lands on a zero crossing,
 * so the waveform jumps instantly from wherever it was to wherever the next
 * segment starts. That step is a click, and there is one at every join.
 *
 * A few milliseconds of ramp removes it and is far too short to hear as a
 * fade. The ramp is clamped to a third of the segment so a very short beat
 * does not end up fading through its whole length.
 */
export function gainEnvelope(segments: Segment[], fadeSeconds = 0.008): GainPoint[] {
  const points: GainPoint[] = [];

  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (length <= 0) continue;

    const fade = Math.min(fadeSeconds, length / 3);

    points.push({ at: segment.start, gain: 0 });
    points.push({ at: segment.start + fade, gain: 1 });
    points.push({ at: segment.end - fade, gain: 1 });
    points.push({ at: segment.end, gain: 0 });
  }

  return points;
}

/**
 * Where to read audio for a segment.
 *
 * Audio and video are cut at the same points, from the same source times, so
 * they cannot drift: a segment's audio is the same window as its video. Stated
 * as its own function because the tempting shortcut — trimming audio to a
 * whole number of frames, or letting it run to the next keyframe — is exactly
 * how the two ends up out of step.
 */
export function audioWindow(segment: Segment): { start: number; end: number; duration: number } {
  return {
    start: segment.sourceStart,
    end: segment.sourceEnd,
    duration: segment.sourceEnd - segment.sourceStart,
  };
}

/** True when the audio windows add up to the video length. Cheap drift check. */
export function audioMatchesVideo(segments: Segment[], tolerance = 0.001): boolean {
  const audio = segments.reduce((sum, s) => sum + audioWindow(s).duration, 0);
  const video = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  return Math.abs(audio - video) <= tolerance;
}

/* Frame lifetime ---------------------------------------------------------- */

/**
 * Anything that holds a buffer until told otherwise. VideoFrame, AudioData,
 * ImageBitmap — the API surface differs but the rule does not.
 */
export interface Closeable {
  close(): void;
}

/**
 * Use a frame and close it, whatever happens.
 *
 * A VideoFrame holds a decoded buffer, often in GPU memory, and the garbage
 * collector will not reclaim it — `close()` is the only thing that does.
 * Decoding a clip without closing exhausts the pool within a few hundred
 * frames, at which point the decoder stalls instead of erroring, so it
 * presents as a hang rather than as a leak.
 *
 * The reason this is a function rather than a rule in a comment: the leak
 * happens on the paths nobody writes tests for. A frame that fails to draw, an
 * encoder that throws mid-clip, an abort between decode and encode. Every one
 * of those is an early return past a close() that was written correctly for
 * the happy path.
 */
export async function withFrame<T extends Closeable, R>(
  frame: T,
  use: (frame: T) => R | Promise<R>,
): Promise<R> {
  try {
    return await use(frame);
  } finally {
    frame.close();
  }
}

/**
 * Close everything still held, swallowing failures.
 *
 * For an abort path, where something has already gone wrong and the only job
 * left is to not also leak. A throw from one close would strand every frame
 * after it.
 */
export function closeAll(frames: Iterable<Closeable>): void {
  for (const frame of frames) {
    try {
      frame.close();
    } catch {
      // Already closed, or the context is gone. Nothing useful to do.
    }
  }
}
