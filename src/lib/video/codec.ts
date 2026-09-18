import { FRAME } from "./cutplan";

/**
 * Encoder settings, chosen by measurement rather than by copying a tutorial.
 *
 * THE LEVEL, NOT THE CODEC
 * Almost every WebCodecs example encodes with "avc1.42001f". That is H.264
 * baseline at **level 3.1**, which tops out around 1280x720 — and a vertical
 * short is 1080x1920, which is more macroblocks than level 3.1 allows.
 * `isConfigSupported` answers `supported: false` for it at that size, measured
 * in Chrome; configuring directly throws instead. The codec is fine, the level
 * is the problem, and the string looks so standard that it is the last thing
 * anyone checks.
 *
 * Level 4.2 (`avc1.42002a`) covers 1080x1920 comfortably. Main and High at
 * level 5.2 were also supported and would compress slightly better, but
 * Baseline decodes everywhere, which matters more for something that gets
 * uploaded to a platform that will re-encode it anyway.
 */
export const VIDEO_CODEC = "avc1.42002a";

/** AAC-LC. Measured as supported alongside the above. */
export const AUDIO_CODEC = "mp4a.40.2";

export const ENCODE_DEFAULTS = {
  width: FRAME.width,
  height: FRAME.height,
  framerate: 30,
  /** Generous: the platform re-encodes, so the upload is the last good copy. */
  bitrate: 6_000_000,
} as const;

/**
 * `as const` above keeps the defaults as literal types, which is right for the
 * constants and wrong for the overrides — without this an override of 60 fps
 * fails to typecheck against a literal 30.
 */
export interface EncodeOptions {
  width?: number;
  height?: number;
  framerate?: number;
  bitrate?: number;
}

export function videoConfig(overrides: EncodeOptions = {}) {
  return { codec: VIDEO_CODEC, ...ENCODE_DEFAULTS, ...overrides };
}

export function audioConfig({
  sampleRate = 48_000,
  numberOfChannels = 2,
  bitrate = 128_000,
} = {}) {
  return { codec: AUDIO_CODEC, sampleRate, numberOfChannels, bitrate };
}

/**
 * Codecs in order of preference, best first.
 *
 * Checked at runtime rather than assumed: support varies by browser, by
 * platform and by whether hardware encoding is available, and the failure mode
 * for guessing wrong is a thrown exception at configure time rather than a
 * degraded result.
 */
export const VIDEO_FALLBACKS = [
  // Better compression where it exists.
  "avc1.640034",
  "avc1.4d0034",
  // The measured-good default.
  VIDEO_CODEC,
  // No H.264 licence in this build. Still muxable into MP4.
  "vp09.00.10.08",
] as const;

/**
 * First codec this browser will actually accept at this size.
 *
 * Takes `isSupported` so it can be tested without WebCodecs, and so a caller
 * can substitute a probe that also checks hardware acceleration.
 */
export async function pickVideoCodec(
  isSupported: (config: { codec: string; width: number; height: number }) => Promise<boolean>,
  { width, height }: { width?: number; height?: number } = {},
  candidates: readonly string[] = VIDEO_FALLBACKS,
): Promise<string | null> {
  const w = width ?? FRAME.width;
  const h = height ?? FRAME.height;

  for (const codec of candidates) {
    try {
      if (await isSupported({ codec, width: w, height: h })) return codec;
    } catch {
      // A browser that throws on an unknown codec string rather than
      // answering false. Treated as a no and we move on.
    }
  }
  return null;
}
