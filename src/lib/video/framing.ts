import { FRAME } from "./cutplan";

/**
 * Fitting landscape gameplay into a vertical frame.
 *
 * This is the decision that decides whether the output looks like a real short
 * or like something a script produced, and it is not a default worth
 * inheriting. Gameplay is 16:9; a short is 9:16. Filling the frame means
 * keeping about a third of the width and throwing the rest away.
 *
 * For most footage centre-cropping is right. For this product it is not: the
 * whole subject is money, and in GTA the cash counter sits top-right and the
 * minimap bottom-left. A centre crop throws away both of the things the video
 * is about.
 */

export type FitStrategy =
  /** Fill the frame, crop the overflow. Sharpest, loses the sides. */
  | "cover"
  /** Whole frame kept, bars filled with a blurred blow-up of the same image. */
  | "blur-bars"
  /** Whole frame kept, bars left flat. Cheapest, reads as lazy. */
  | "letterbox";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FramePlan {
  strategy: FitStrategy;
  /** Where to draw the source image in the output frame. */
  destination: Rect;
  /** Part of the source to take. Smaller than the source only when cropping. */
  source: Rect;
  /** Filled behind the image when it does not cover the frame. */
  background: "blur" | "flat" | "none";
  /** True when part of the source image does not survive. */
  cropped: boolean;
}

/**
 * @param anchor Horizontal point of the source to keep when cropping: 0 is the
 *   left edge, 1 the right, 0.5 the middle. Only read for "cover".
 */
export function planFrame({
  sourceWidth,
  sourceHeight,
  strategy = "blur-bars",
  anchor = 0.5,
  frameWidth = FRAME.width,
  frameHeight = FRAME.height,
}: {
  sourceWidth: number;
  sourceHeight: number;
  strategy?: FitStrategy;
  anchor?: number;
  frameWidth?: number;
  frameHeight?: number;
}): FramePlan {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Source dimensions must be positive.");
  }

  const clampedAnchor = Math.min(1, Math.max(0, anchor));

  if (strategy === "cover") {
    // Scale so the smaller relative dimension fills, then take a window of the
    // source rather than scaling twice.
    const scale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
    const visibleWidth = Math.min(sourceWidth, frameWidth / scale);
    const visibleHeight = Math.min(sourceHeight, frameHeight / scale);

    return {
      strategy,
      source: {
        x: (sourceWidth - visibleWidth) * clampedAnchor,
        y: (sourceHeight - visibleHeight) / 2,
        width: visibleWidth,
        height: visibleHeight,
      },
      destination: { x: 0, y: 0, width: frameWidth, height: frameHeight },
      background: "none",
      cropped: visibleWidth < sourceWidth || visibleHeight < sourceHeight,
    };
  }

  // Both bar strategies keep the whole image and fit it inside the frame.
  const scale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    strategy,
    source: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
    destination: {
      x: (frameWidth - width) / 2,
      y: (frameHeight - height) / 2,
      width,
      height,
    },
    background: strategy === "blur-bars" ? "blur" : "flat",
    cropped: false,
  };
}

/** How much of the source image survives, 0 to 1. Useful as a warning. */
export function retainedArea(plan: FramePlan, sourceWidth: number, sourceHeight: number): number {
  return (plan.source.width * plan.source.height) / (sourceWidth * sourceHeight);
}

/* Captions ---------------------------------------------------------------- */

/**
 * Safe area.
 *
 * Every short-form player puts its own furniture over the video: a progress
 * bar and account name along the bottom, a like/share column down the right,
 * and on Reels a header at the top. Text laid out to the frame edges is text
 * the platform covers up, and there is no way to find that out except by
 * posting it.
 *
 * These are conservative rather than exact, because the exact numbers differ
 * per platform and change without notice.
 */
export const SAFE_AREA = {
  top: 0.12,
  bottom: 0.2,
  left: 0.06,
  /** Wider: the action column lives on the right. */
  right: 0.22,
} as const;

export interface CaptionBox {
  lines: string[];
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
}

/**
 * Wrap a caption inside the safe area.
 *
 * `measure` is injected rather than reaching for a canvas, so the wrapping can
 * be tested without a DOM and so the caller can measure in the exact font it
 * will draw with.
 *
 * Shrinks the type a step at a time before it allows a fourth line: three
 * lines is the point where a caption stops being glanceable.
 */
export function layoutCaption({
  text,
  measure,
  frameWidth = FRAME.width,
  frameHeight = FRAME.height,
  fontSize = 56,
  minFontSize = 36,
  maxLines = 3,
}: {
  text: string;
  /** Width of `text` at `fontSize`, in pixels. */
  measure: (text: string, fontSize: number) => number;
  frameWidth?: number;
  frameHeight?: number;
  fontSize?: number;
  minFontSize?: number;
  maxLines?: number;
}): CaptionBox {
  const left = frameWidth * SAFE_AREA.left;
  const maxWidth = frameWidth * (1 - SAFE_AREA.left - SAFE_AREA.right);

  let size = fontSize;
  let lines = wrap(text, maxWidth, size, measure);

  while (lines.length > maxLines && size > minFontSize) {
    size -= 4;
    lines = wrap(text, maxWidth, size, measure);
  }

  // Sits above the bottom furniture rather than in the middle: the centre of
  // the frame is where the gameplay is.
  const lineHeight = size * 1.25;
  const blockHeight = lines.length * lineHeight;
  const y = frameHeight * (1 - SAFE_AREA.bottom) - blockHeight;

  return { lines, x: left, y, maxWidth, fontSize: size };
}

function wrap(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: (text: string, fontSize: number) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}
