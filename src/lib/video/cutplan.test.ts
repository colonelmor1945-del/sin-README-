import { describe, expect, it } from "vitest";

import { PLATFORMS, planCut, toCaption } from "./cutplan";
import type { CreatorIdea, ScriptBeat } from "@/lib/types";

function idea(beats: ScriptBeat[], runtimeSeconds: number): CreatorIdea {
  return {
    topic: "Which business to buy first",
    momentum: 340,
    titles: ["t"],
    thumbnailConcept: "c",
    hook: "h",
    angle: "a",
    seoKeywords: ["k"],
    script: beats,
    runtimeSeconds,
    provenance: "ai-projection",
  };
}

const beat = (at: number, label: string, narration = "Line."): ScriptBeat => ({
  at,
  label,
  narration,
  onScreen: "Cold open on the nightclub exterior, then a hard cut.",
});

describe("toCaption", () => {
  it("leaves a short line alone", () => {
    expect(toCaption("Everyone buys the nightclub first.")).toBe(
      "Everyone buys the nightclub first.",
    );
  });

  it("collapses the whitespace a generated script brings", () => {
    expect(toCaption("Two   lines\nbecome one")).toBe("Two lines become one");
  });

  it("cuts at a sentence end when there is one in range", () => {
    const text = "Everyone buys the nightclub first. It takes eleven hours to break even and that is the whole problem.";
    expect(toCaption(text)).toBe("Everyone buys the nightclub first.");
  });

  it("cuts on a word and marks it when there is no sentence end", () => {
    const out = toCaption("a".repeat(20) + " " + "b".repeat(80));
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(69);
  });

  it("never splits a word", () => {
    const input = "supercalifragilistic expialidocious ".repeat(6);
    const words = new Set(input.trim().split(" "));
    const out = toCaption(input).replace("…", "").trimEnd();

    // The property that matters is that no fragment survives, not which word
    // happens to be last.
    for (const word of out.split(" ")) {
      expect(words.has(word), `"${word}" is not a whole word from the input`).toBe(true);
    }
  });
});

describe("planCut", () => {
  const script = [
    beat(0, "Hook", "Everyone buys the nightclub first."),
    beat(8, "Setup", "Here is what the numbers actually say."),
    beat(20, "Body", "The acid lab repays in seven point eight days."),
    beat(45, "Close", "Buy the lab. Then the club."),
  ];

  it("gives every beat an end from the next one's start", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120, target: 180 });
    expect(plan.segments.map((s) => [s.sourceStart, s.sourceEnd])).toEqual([
      [0, 8],
      [8, 20],
      [20, 45],
      [45, 60],
    ]);
  });

  it("lays the kept beats end to end with no gaps", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120, target: 180 });
    let expected = 0;
    for (const segment of plan.segments) {
      expect(segment.start).toBe(expected);
      expected = segment.end;
    }
    expect(plan.duration).toBe(60);
  });

  it("captions from the narration, never from the stage directions", () => {
    // onScreen is written for a person holding a camera. Burning it in would
    // put "Cold open on the nightclub exterior" in the finished video.
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120 });
    for (const segment of plan.segments) {
      expect(segment.caption).not.toContain("Cold open");
    }
    expect(plan.segments[0].caption).toBe("Everyone buys the nightclub first.");
  });

  it("drops from the middle to fit, never the hook or the close", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120, target: 30 });
    const kept = plan.segments.map((s) => s.label);
    expect(kept).toContain("Hook");
    expect(kept).toContain("Close");
    expect(plan.dropped.length).toBeGreaterThan(0);
  });

  it("drops the longest middle beat first, to buy time with fewest cuts", () => {
    // Body is 25s, Setup is 12s. Cutting Body alone gets under the target.
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120, target: 35 });
    expect(plan.dropped).toEqual(["Body"]);
    expect(plan.segments.map((s) => s.label)).toEqual(["Hook", "Setup", "Close"]);
  });

  it("closes the gap left by a dropped beat", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 120, target: 35 });
    expect(plan.segments[1].start).toBe(plan.segments[0].end);
  });

  it("says so rather than trimming the hook when even hook plus close overrun", () => {
    const long = [beat(0, "Hook"), beat(40, "Close")];
    const plan = planCut({ idea: idea(long, 80), sourceDuration: 120, target: 30 });
    expect(plan.segments.map((s) => s.label)).toEqual(["Hook", "Close"]);
    expect(plan.warnings.join(" ")).toMatch(/kept rather than cut/i);
  });

  it("clamps a target above the platform cap", () => {
    const plan = planCut({
      idea: idea(script, 600),
      sourceDuration: 900,
      platform: "reels",
      target: 9999,
    });
    expect(plan.duration).toBeLessThanOrEqual(PLATFORMS.reels.maxSeconds);
    // The cap is hard: past it the upload is rejected, so the tail is trimmed
    // even though the closing beat is otherwise protected.
    expect(plan.warnings.join(" ")).toMatch(/trimmed to fit|falls past/i);
  });

  it("trims a beat that runs past the end of the footage", () => {
    // The normal case: the script was written before anyone recorded anything.
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 30, target: 180 });
    const last = plan.segments[plan.segments.length - 1];
    expect(last.sourceEnd).toBeLessThanOrEqual(30);
    expect(plan.warnings.join(" ")).toMatch(/footage is 30s/i);
  });

  it("never renders black by planning past the footage", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 10, target: 180 });
    for (const segment of plan.segments) {
      expect(segment.sourceEnd).toBeLessThanOrEqual(10);
    }
    expect(plan.duration).toBeLessThanOrEqual(10);
  });

  it("says so when the footage starts after the whole script", () => {
    const plan = planCut({ idea: idea(script, 60), sourceDuration: 0, target: 180 });
    expect(plan.segments).toEqual([]);
    expect(plan.warnings.join(" ")).toMatch(/none of the script lands/i);
  });

  it("refuses an empty script rather than producing an empty video", () => {
    const plan = planCut({ idea: idea([], 60), sourceDuration: 120 });
    expect(plan.warnings[0]).toMatch(/no script/i);
  });

  it("sorts beats that arrive out of order", () => {
    const jumbled = [beat(20, "Body"), beat(0, "Hook"), beat(8, "Setup")];
    const plan = planCut({ idea: idea(jumbled, 30), sourceDuration: 60, target: 180 });
    expect(plan.segments.map((s) => s.label)).toEqual(["Hook", "Setup", "Body"]);
  });
});
