import { describe, expect, it } from "vitest";

import { parseAffects } from "./store";

/**
 * Cross-links carry a type because the join table constrains one, and a flat
 * id cannot say whether "nightclub" is an asset or a mission. Guessing wrong
 * points the economy tracker at the wrong record.
 */
describe("parseAffects", () => {
  it("reads type and id", () => {
    expect(parseAffects("asset:nightclub")).toEqual([
      { type: "asset", id: "nightclub" },
    ]);
  });

  it("accepts commas and newlines, because a spreadsheet gives both", () => {
    expect(parseAffects("asset:a, mission:b\nmap_location:c")).toEqual([
      { type: "asset", id: "a" },
      { type: "mission", id: "b" },
      { type: "map_location", id: "c" },
    ]);
  });

  it("drops an id with no type rather than guessing one", () => {
    expect(parseAffects("nightclub")).toEqual([]);
  });

  it("drops a type the join table would reject", () => {
    // entity_type has a CHECK constraint; an unknown type fails the insert and
    // would take the whole transaction with it.
    expect(parseAffects("player:someone")).toEqual([]);
  });

  it("drops a type with no id", () => {
    expect(parseAffects("asset:")).toEqual([]);
  });

  it("keeps a colon that belongs to the id", () => {
    expect(parseAffects("asset:ns:thing")).toEqual([
      { type: "asset", id: "ns:thing" },
    ]);
  });

  it("survives an empty cell", () => {
    expect(parseAffects("")).toEqual([]);
    expect(parseAffects("   ")).toEqual([]);
  });

  it("caps the list rather than letting one row write forever", () => {
    const many = Array.from({ length: 40 }, (_, i) => `asset:a${i}`).join(",");
    expect(parseAffects(many)).toHaveLength(20);
  });
});
