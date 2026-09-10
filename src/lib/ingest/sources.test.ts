import { describe, expect, it } from "vitest";

import {
  CORROBORATION_REQUIRED,
  POLLABLE,
  SOURCES,
  canAutoIngest,
  capProvenance,
  sourceById,
  type Source,
} from "@/lib/ingest/sources";
import type { Provenance } from "@/lib/types";

/**
 * Tests for the trust ceiling.
 *
 * This is the load-bearing wall. If capProvenance ever lets an item through
 * above its source's tier, the platform can publish a Reddit rumour as a
 * verified fact, and the one thing that separates it from every other GTA guide
 * is gone.
 *
 * So these do not test the happy path. They try to get something promoted.
 */

const ALL: Provenance[] = ["ai-projection", "estimated", "community", "verified"];

const source = (over: Partial<Source> = {}): Source => ({
  id: "test",
  label: "Test",
  tier: "community",
  ceiling: "community",
  autoPublish: false,
  homepage: "https://example.com",
  intervalMinutes: 30,
  note: "",
  ...over,
});

describe("capProvenance", () => {
  it("refuses to promote anything above a community ceiling", () => {
    const s = source({ ceiling: "community" });
    expect(capProvenance("verified", s)).toBe("community");
  });

  it("refuses to promote anything above an estimated ceiling", () => {
    const s = source({ ceiling: "estimated" });
    expect(capProvenance("verified", s)).toBe("estimated");
    expect(capProvenance("community", s)).toBe("estimated");
  });

  it("pins everything to ai-projection when that is the ceiling", () => {
    const s = source({ ceiling: "ai-projection" });
    for (const p of ALL) {
      expect(capProvenance(p, s)).toBe("ai-projection");
    }
  });

  it("leaves a proposal at or below the ceiling alone", () => {
    const s = source({ ceiling: "community" });
    expect(capProvenance("estimated", s)).toBe("estimated");
    expect(capProvenance("ai-projection", s)).toBe("ai-projection");
    expect(capProvenance("community", s)).toBe("community");
  });

  it("never returns something above the ceiling, for any pairing", () => {
    // Exhaustive: every proposal against every ceiling. The invariant is that
    // the result is never more confident than the ceiling allows.
    const rank = (p: Provenance) => ALL.indexOf(p);
    for (const ceiling of ALL) {
      for (const proposed of ALL) {
        const result = capProvenance(proposed, source({ ceiling }));
        expect(rank(result)).toBeLessThanOrEqual(rank(ceiling));
      }
    }
  });
});

describe("source registry", () => {
  it("gives exactly one source a verified ceiling", () => {
    const official = SOURCES.filter((s) => s.ceiling === "verified");
    expect(official).toHaveLength(1);
    expect(official[0].tier).toBe("official");
  });

  it("never lets a community source claim a verified ceiling", () => {
    for (const s of SOURCES) {
      if (s.tier === "community") expect(s.ceiling).not.toBe("verified");
    }
  });

  it("allows no source to auto-publish", () => {
    // Every item goes through the review queue. If this ever flips to true for
    // something, an unattended job can write to the live dataset, and that is
    // the failure the queue exists to prevent.
    expect(SOURCES.every((s) => !s.autoPublish)).toBe(true);
  });

  it("excludes the unpollable official source from the poll list", () => {
    const newswire = sourceById("rockstar-newswire")!;
    expect(canAutoIngest(newswire)).toBe(false);
    expect(POLLABLE).not.toContain(newswire);
  });

  it("gives every pollable source a sane interval", () => {
    for (const s of POLLABLE) {
      // Faster than ten minutes is rude to the source and pointless for data
      // that moves on the scale of days.
      expect(s.intervalMinutes).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps source ids unique", () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
});

describe("corroboration thresholds", () => {
  it("requires two independent sources for community", () => {
    expect(CORROBORATION_REQUIRED.community).toBe(2);
  });

  it("has no threshold for verified", () => {
    // Verified comes from being official, never from agreement between
    // unofficial sources. A thousand people repeating a rumour is a rumour.
    expect(CORROBORATION_REQUIRED.verified).toBeUndefined();
  });
});
