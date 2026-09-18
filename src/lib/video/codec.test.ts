import { describe, expect, it } from "vitest";

import { FRAME } from "./cutplan";
import { VIDEO_CODEC, audioConfig, pickVideoCodec, videoConfig } from "./codec";

describe("videoConfig", () => {
  it("defaults to the vertical frame", () => {
    expect(videoConfig()).toMatchObject({ width: FRAME.width, height: FRAME.height });
  });

  it("does not use the level that fails at 1080x1920", () => {
    // avc1.42001f is baseline level 3.1, which tops out near 1280x720. Chrome
    // answers supported:false for it at the vertical short size.
    expect(videoConfig().codec).not.toBe("avc1.42001f");
    expect(VIDEO_CODEC).toBe("avc1.42002a");
  });

  it("takes overrides", () => {
    expect(videoConfig({ framerate: 60 }).framerate).toBe(60);
  });
});

describe("audioConfig", () => {
  it("defaults to AAC-LC at 48k stereo", () => {
    expect(audioConfig()).toEqual({
      codec: "mp4a.40.2",
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });
  });
});

describe("pickVideoCodec", () => {
  it("takes the first supported candidate", async () => {
    const picked = await pickVideoCodec(async ({ codec }) => codec === "avc1.4d0034");
    expect(picked).toBe("avc1.4d0034");
  });

  it("prefers better compression when it is available", async () => {
    expect(await pickVideoCodec(async () => true)).toBe("avc1.640034");
  });

  it("falls through to VP9 when H.264 is unavailable", async () => {
    // A Chromium build with no H.264 licence. Still muxable into MP4.
    const picked = await pickVideoCodec(async ({ codec }) => codec.startsWith("vp09"));
    expect(picked).toBe("vp09.00.10.08");
  });

  it("treats a thrown probe as a no rather than failing the run", async () => {
    const picked = await pickVideoCodec(async ({ codec }) => {
      if (codec.startsWith("avc1")) throw new TypeError("unknown codec");
      return true;
    });
    expect(picked).toBe("vp09.00.10.08");
  });

  it("returns null when nothing works, so the caller can say so", async () => {
    expect(await pickVideoCodec(async () => false)).toBeNull();
  });

  it("probes at the size it will encode at, since the level depends on it", async () => {
    const seen: { width: number; height: number }[] = [];
    await pickVideoCodec(
      async (config) => {
        seen.push({ width: config.width, height: config.height });
        return true;
      },
      { width: 720, height: 1280 },
    );
    expect(seen[0]).toEqual({ width: 720, height: 1280 });
  });
});
