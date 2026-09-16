import { describe, expect, it } from "vitest";

import { PROVENANCE_META, PROVENANCE_ORDER, weakestProvenance } from "./provenance";
import type { Provenance } from "./types";

/**
 * Guards the failure that ADR-027 actually caused.
 *
 * Adding a fifth tier updated the type, the database enum and the tag
 * component, and missed four separate hardcoded copies of the tier list — in
 * the admin validator, the editor, the legal page and the landing page. The
 * type system did not catch any of them, because a short array of valid
 * members is still a valid array.
 *
 * These assert the relationship instead: whatever the union holds, the list
 * and the metadata hold too.
 */
describe("provenance tiers stay in step", () => {
  it("lists every tier that has metadata", () => {
    const declared = Object.keys(PROVENANCE_META).sort();
    expect([...PROVENANCE_ORDER].sort()).toEqual(declared);
  });

  it("has metadata for every tier it lists", () => {
    for (const tier of PROVENANCE_ORDER) {
      expect(PROVENANCE_META[tier], `no metadata for "${tier}"`).toBeDefined();
      expect(PROVENANCE_META[tier].label).toBeTruthy();
      expect(PROVENANCE_META[tier].short).toBeTruthy();
      expect(PROVENANCE_META[tier].description).toBeTruthy();
    }
  });

  it("lists no tier twice", () => {
    expect(new Set(PROVENANCE_ORDER).size).toBe(PROVENANCE_ORDER.length);
  });

  it("ranks every tier, so none is silently treated as the weakest", () => {
    // weakestProvenance reduces over RANK. A tier missing from RANK would come
    // back as whatever the reducer's fallback is rather than raising.
    for (const tier of PROVENANCE_ORDER) {
      expect(weakestProvenance([{ provenance: tier }])).toBe(tier);
    }
  });

  it("puts the strongest first and the emptiest last", () => {
    expect(PROVENANCE_ORDER[0]).toBe("verified");
    expect(PROVENANCE_ORDER[PROVENANCE_ORDER.length - 1]).toBe("unverified");
  });

  it("treats unverified as weaker than an AI projection", () => {
    // A projection is the output of a process; this is the absence of one.
    const pair: { provenance: Provenance }[] = [
      { provenance: "ai-projection" },
      { provenance: "unverified" },
    ];
    expect(weakestProvenance(pair)).toBe("unverified");
  });
});
