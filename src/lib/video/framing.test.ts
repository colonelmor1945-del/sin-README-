import { describe, expect, it } from "vitest";

import { FRAME } from "./cutplan";
import { layoutCaption, planFrame, retainedArea, SAFE_AREA } from "./framing";

/** A monospace stand-in: every glyph is 0.5em wide. Exact, so wrapping is testable. */
const measure = (text: string, fontSize: number) => text.length * fontSize * 0.5;

describe("planFrame", () => {
  const landscape = { sourceWidth: 1920, sourceHeight: 1080 };

  it("fills the frame when covering, and says it cropped", () => {
    const plan = planFrame({ ...landscape, strategy: "cover" });
    expect(plan.destination).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(plan.cropped).toBe(true);
  });

  it("throws away most of a 16:9 frame to fill a 9:16 one", () => {
    // The number worth knowing before choosing this: about a third survives.
    const plan = planFrame({ ...landscape, strategy: "cover" });
    const kept = retainedArea(plan, 1920, 1080);
    expect(kept).toBeGreaterThan(0.3);
    expect(kept).toBeLessThan(0.33);
  });

  it("honours the anchor when cropping", () => {
    const left = planFrame({ ...landscape, strategy: "cover", anchor: 0 });
    const right = planFrame({ ...landscape, strategy: "cover", anchor: 1 });
    const middle = planFrame({ ...landscape, strategy: "cover", anchor: 0.5 });

    expect(left.source.x).toBe(0);
    expect(right.source.x).toBe(1920 - left.source.width);
    expect(middle.source.x).toBeCloseTo((1920 - left.source.width) / 2);
  });

  it("clamps an anchor outside the frame instead of drawing off it", () => {
    expect(planFrame({ ...landscape, strategy: "cover", anchor: -3 }).source.x).toBe(0);
    expect(planFrame({ ...landscape, strategy: "cover", anchor: 9 }).source.x).toBe(
      planFrame({ ...landscape, strategy: "cover", anchor: 1 }).source.x,
    );
  });

  it("keeps the whole image with bars, which is why it is the default", () => {
    // The cash counter is top-right and the minimap bottom-left. A centre crop
    // loses both, and they are what the video is about.
    const plan = planFrame(landscape);
    expect(plan.cropped).toBe(false);
    expect(plan.source).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(retainedArea(plan, 1920, 1080)).toBe(1);
  });

  it("centres the letterboxed image and fits it inside the frame", () => {
    const plan = planFrame(landscape);
    expect(plan.destination.width).toBe(FRAME.width);
    expect(plan.destination.x).toBe(0);
    expect(plan.destination.y).toBeGreaterThan(0);
    expect(plan.destination.y + plan.destination.height).toBeLessThanOrEqual(FRAME.height);
  });

  it("asks for a blur behind the bars, or flat when told", () => {
    expect(planFrame(landscape).background).toBe("blur");
    expect(planFrame({ ...landscape, strategy: "letterbox" }).background).toBe("flat");
    expect(planFrame({ ...landscape, strategy: "cover" }).background).toBe("none");
  });

  it("handles footage that is already vertical", () => {
    const plan = planFrame({ sourceWidth: 1080, sourceHeight: 1920, strategy: "cover" });
    expect(plan.cropped).toBe(false);
    expect(plan.destination).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
  });

  it("refuses nonsense dimensions rather than producing NaN geometry", () => {
    expect(() => planFrame({ sourceWidth: 0, sourceHeight: 1080 })).toThrow();
    expect(() => planFrame({ sourceWidth: -1920, sourceHeight: 1080 })).toThrow();
  });
});

describe("layoutCaption", () => {
  it("wraps inside the safe area, not the frame", () => {
    const box = layoutCaption({ text: "a ".repeat(40).trim(), measure });
    const safeWidth = FRAME.width * (1 - SAFE_AREA.left - SAFE_AREA.right);
    for (const line of box.lines) {
      expect(measure(line, box.fontSize)).toBeLessThanOrEqual(safeWidth);
    }
  });

  it("leaves room on the right for the platform's action column", () => {
    const box = layoutCaption({ text: "Everyone buys the nightclub first.", measure });
    expect(box.x + box.maxWidth).toBeLessThan(FRAME.width * 0.8);
  });

  it("sits above the bottom furniture, not in the middle of the gameplay", () => {
    const box = layoutCaption({ text: "Short line.", measure });
    expect(box.y).toBeGreaterThan(FRAME.height * 0.5);
    expect(box.y).toBeLessThan(FRAME.height * (1 - SAFE_AREA.bottom));
  });

  it("shrinks the type rather than running to a fourth line", () => {
    const long = "The acid lab repays in seven point eight in game days which is faster than anything else on this list";
    const box = layoutCaption({ text: long, measure });
    expect(box.lines.length).toBeLessThanOrEqual(3);
    expect(box.fontSize).toBeLessThan(56);
  });

  it("stops shrinking at the floor rather than going unreadable", () => {
    const enormous = "word ".repeat(200).trim();
    const box = layoutCaption({ text: enormous, measure, minFontSize: 36 });
    expect(box.fontSize).toBe(36);
    // It gives up on the line count instead, which is visible and fixable.
    expect(box.lines.length).toBeGreaterThan(3);
  });

  it("never splits a word across lines", () => {
    const box = layoutCaption({ text: "supercalifragilisticexpialidocious ".repeat(4).trim(), measure });
    for (const line of box.lines) {
      for (const word of line.split(" ")) {
        expect(word).toBe("supercalifragilisticexpialidocious");
      }
    }
  });

  it("survives an empty caption", () => {
    expect(layoutCaption({ text: "   ", measure }).lines).toEqual([]);
  });
});
