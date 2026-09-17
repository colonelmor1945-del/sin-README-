import { describe, expect, it } from "vitest";

import {
  audioMatchesVideo,
  audioWindow,
  createFlow,
  gainEnvelope,
  keepFrame,
  keyframeFor,
  shouldWait,
  warmupCost,
  withFrame,
  closeAll,
  type Segment,
} from "./pipeline";

const segment = (sourceStart: number, sourceEnd: number, start: number): Segment => ({
  sourceStart,
  sourceEnd,
  start,
  end: start + (sourceEnd - sourceStart),
});

describe("keyframeFor", () => {
  const keyframes = [0, 2, 4, 6, 8];

  it("takes the last keyframe at or before the in-point", () => {
    expect(keyframeFor(keyframes, 5)).toBe(4);
    expect(keyframeFor(keyframes, 7.9)).toBe(6);
  });

  it("uses a keyframe that lands exactly on the in-point", () => {
    expect(keyframeFor(keyframes, 4)).toBe(4);
  });

  it("starts at zero for a cut at the start", () => {
    expect(keyframeFor(keyframes, 0)).toBe(0);
  });

  it("returns null rather than pretending zero when there is none before", () => {
    // A file whose first keyframe is not at zero cannot be cut from zero, and
    // silently starting there produces a smeared opening instead of an error.
    expect(keyframeFor([3, 6], 1)).toBeNull();
  });

  it("handles an empty index", () => {
    expect(keyframeFor([], 5)).toBeNull();
  });

  it("counts the frames that get decoded and thrown away", () => {
    expect(warmupCost(keyframes, 5, 30)).toBe(30);
    expect(warmupCost(keyframes, 4, 30)).toBe(0);
  });
});

describe("keepFrame", () => {
  it("keeps frames inside the cut", () => {
    expect(keepFrame(5, 4, 8)).toBe(true);
    expect(keepFrame(4, 4, 8)).toBe(true);
  });

  it("drops the frame exactly on the out-point", () => {
    // Half-open, so a join does not duplicate a frame and stutter.
    expect(keepFrame(8, 4, 8)).toBe(false);
  });

  it("drops warm-up frames before the in-point", () => {
    expect(keepFrame(3.9, 4, 8)).toBe(false);
  });

  it("loses no frame and repeats none across adjoining cuts", () => {
    const timestamps = [0, 1, 2, 3, 4, 5];
    const first = timestamps.filter((t) => keepFrame(t, 0, 3));
    const second = timestamps.filter((t) => keepFrame(t, 3, 6));
    expect([...first, ...second]).toEqual(timestamps);
  });
});

describe("shouldWait", () => {
  it("lets frames through while the encoder keeps up", () => {
    const flow = createFlow();
    expect(shouldWait(flow, 0)).toBe(false);
    expect(shouldWait(flow, 11)).toBe(false);
  });

  it("stops feeding once the backlog hits the high mark", () => {
    const flow = createFlow();
    expect(shouldWait(flow, 12)).toBe(true);
  });

  it("stays paused until the backlog properly drains", () => {
    // The bug a single threshold gives you: resuming at 11 means waiting again
    // at 12, so the encoder spends its time being woken rather than encoding.
    const flow = createFlow();
    shouldWait(flow, 12);
    expect(shouldWait(flow, 11)).toBe(true);
    expect(shouldWait(flow, 5)).toBe(true);
    expect(shouldWait(flow, 4)).toBe(false);
  });

  it("can be driven again after resuming", () => {
    const flow = createFlow();
    shouldWait(flow, 12);
    shouldWait(flow, 0);
    expect(shouldWait(flow, 3)).toBe(false);
    expect(shouldWait(flow, 20)).toBe(true);
  });

  it("takes custom thresholds", () => {
    const flow = createFlow();
    expect(shouldWait(flow, 3, { high: 3, low: 1 })).toBe(true);
    expect(shouldWait(flow, 2, { high: 3, low: 1 })).toBe(true);
    expect(shouldWait(flow, 1, { high: 3, low: 1 })).toBe(false);
  });
});

describe("gainEnvelope", () => {
  const segments = [segment(0, 4, 0), segment(10, 14, 4)];

  it("ramps in and out of every segment", () => {
    const points = gainEnvelope(segments, 0.01);
    expect(points).toHaveLength(8);
    expect(points[0]).toEqual({ at: 0, gain: 0 });
    expect(points[1]).toEqual({ at: 0.01, gain: 1 });
  });

  it("silences the exact join, which is where the click is", () => {
    const points = gainEnvelope(segments, 0.01);
    const atJoin = points.filter((p) => p.at === 4);
    expect(atJoin.every((p) => p.gain === 0)).toBe(true);
  });

  it("uses a ramp far too short to hear as a fade", () => {
    const points = gainEnvelope(segments);
    expect(points[1].at).toBeLessThanOrEqual(0.01);
  });

  it("shortens the ramp rather than fading a very short beat throughout", () => {
    const tiny = [segment(0, 0.015, 0)];
    const points = gainEnvelope(tiny, 0.008);
    expect(points[1].at).toBeCloseTo(0.005, 5);
    expect(points[1].at).toBeLessThan(0.015 / 2);
  });

  it("skips a zero-length segment instead of emitting a spike", () => {
    expect(gainEnvelope([segment(5, 5, 0)])).toEqual([]);
  });

  it("stays in order, which is what an automation curve needs", () => {
    const points = gainEnvelope(segments, 0.01);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].at).toBeGreaterThanOrEqual(points[i - 1].at);
    }
  });
});

describe("audioWindow", () => {
  it("reads the same window as the video", () => {
    expect(audioWindow(segment(10, 14, 4))).toEqual({
      start: 10,
      end: 14,
      duration: 4,
    });
  });

  it("confirms the audio and video lengths agree", () => {
    expect(audioMatchesVideo([segment(0, 4, 0), segment(10, 14, 4)])).toBe(true);
  });

  it("catches drift when a segment's windows disagree", () => {
    // The shortcut this exists to catch: trimming audio to whole frames, or
    // letting it run on to the next keyframe.
    const drifting: Segment = { sourceStart: 0, sourceEnd: 4.04, start: 0, end: 4 };
    expect(audioMatchesVideo([drifting])).toBe(false);
  });
});

describe("withFrame", () => {
  const stub = () => {
    let closed = 0;
    return { frame: { close: () => void closed++ }, closed: () => closed };
  };

  it("closes after a normal use", async () => {
    const { frame, closed } = stub();
    await withFrame(frame, () => "drawn");
    expect(closed()).toBe(1);
  });

  it("returns what the body returned", async () => {
    const { frame } = stub();
    expect(await withFrame(frame, () => 42)).toBe(42);
  });

  it("awaits an async body before closing", async () => {
    const { frame, closed } = stub();
    let closedDuringUse = -1;
    await withFrame(frame, async () => {
      await Promise.resolve();
      closedDuringUse = closed();
    });
    expect(closedDuringUse).toBe(0);
    expect(closed()).toBe(1);
  });

  it("closes when the body throws, which is the whole point", async () => {
    // The leak lives on the unhappy paths: a frame that fails to draw, an
    // encoder that throws mid-clip. Each is an early return past a close().
    const { frame, closed } = stub();
    await expect(
      withFrame(frame, () => {
        throw new Error("encoder died");
      }),
    ).rejects.toThrow("encoder died");
    expect(closed()).toBe(1);
  });

  it("closes when an async body rejects", async () => {
    const { frame, closed } = stub();
    await expect(withFrame(frame, async () => Promise.reject(new Error("aborted")))).rejects.toThrow();
    expect(closed()).toBe(1);
  });
});

describe("closeAll", () => {
  it("closes every frame held", () => {
    let closed = 0;
    const frames = [1, 2, 3].map(() => ({ close: () => void closed++ }));
    closeAll(frames);
    expect(closed).toBe(3);
  });

  it("keeps going when one close throws", () => {
    // An abort path: something already failed, and the only job left is to not
    // also strand every frame after the one that misbehaves.
    let closed = 0;
    closeAll([
      { close: () => void closed++ },
      { close: () => { throw new Error("already closed"); } },
      { close: () => void closed++ },
    ]);
    expect(closed).toBe(2);
  });
});
