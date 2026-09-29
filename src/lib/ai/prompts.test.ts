import { describe, expect, it } from "vitest";

import { ASSETS } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { PROVENANCE_ORDER } from "@/lib/provenance";
import { SYSTEM_PROMPT, datasetDigest, profileBlock } from "@/lib/ai/prompts";

/**
 * What the model is told.
 *
 * This layer had no tests, which is the wrong place to have none: the model is
 * the one component that can produce a confident sentence about a number
 * nobody verified. Everything else in the product either renders a label or
 * refuses. The model has to be told, and the telling is this file.
 *
 * So these assert the properties that can be removed without anything
 * appearing to break -- no screen goes blank, no request fails, the answers
 * just quietly stop being trustworthy.
 */
describe("the dataset digest", () => {
  const digest = datasetDigest();

  it("labels every single row with its provenance", () => {
    // The one that matters. Drop `data: ${provenance}` from the template and
    // the model still gets every figure, still answers fluently, and has lost
    // the only signal telling it which numbers are confirmed. Nothing fails.
    const rows = digest.split("\n").filter((l) => l.startsWith("- "));
    expect(rows.length).toBe(MISSIONS.length + ASSETS.length);

    for (const row of rows) {
      expect(row, `row without a provenance label: ${row}`).toMatch(/\| data: \S+$/);
    }
  });

  it("uses only tiers that exist", () => {
    const tiers = [...digest.matchAll(/\| data: (\S+)$/gm)].map((m) => m[1]);
    expect(tiers.length).toBeGreaterThan(0);
    for (const tier of tiers) {
      expect(PROVENANCE_ORDER).toContain(tier);
    }
  });

  it("names every mission and asset it was given, and nothing else", () => {
    // The digest is the model's entire world. A name missing here is a thing
    // the model will not recommend; a name here that is not in the dataset is
    // a thing it can cite that does not exist.
    for (const mission of MISSIONS) expect(digest).toContain(mission.name);
    for (const asset of ASSETS) expect(digest).toContain(asset.name);
  });

  it("says in the text itself that the data is placeholder", () => {
    // Belt and braces with the system prompt: if the two are ever separated,
    // the digest still carries the warning attached to the numbers.
    expect(digest).toMatch(/fictional placeholder/i);
    expect(digest).toMatch(/nothing in it is verified/i);
  });
});

describe("the system prompt", () => {
  it("keeps the four honesty rules", () => {
    // Quoted loosely so wording can be improved, strictly enough that
    // deleting a rule fails.
    expect(SYSTEM_PROMPT).toMatch(/never present a number as confirmed.*verified/is);
    expect(SYSTEM_PROMPT).toMatch(/community-reported|estimated|projection/i);
    expect(SYSTEM_PROMPT).toMatch(/do not fill gaps with invented/i);
    expect(SYSTEM_PROMPT).toMatch(/never invent mission names/i);
  });

  it("disclaims any affiliation with Rockstar", () => {
    // A fan platform that reads as official is the fastest route to a letter
    // from Take-Two, and the model speaks in the product's voice.
    expect(SYSTEM_PROMPT).toMatch(/not affiliated with Rockstar/i);
  });

  it("puts real-money trading and cheating out of scope", () => {
    expect(SYSTEM_PROMPT).toMatch(/real-money trading/i);
    expect(SYSTEM_PROMPT).toMatch(/modding|cheat/i);
  });
});

describe("the cache prefix", () => {
  /**
   * The prefix is system prompt plus digest, and it is what carries the cache
   * breakpoint. It has to be identical for every user on every request.
   *
   * If anything per-user leaked into it the product would still work
   * perfectly and every request would miss the cache, which is a cost
   * regression that no test and no screen would ever show.
   */
  const profileA = {
    level: 12,
    hoursPerDay: 2,
    cash: 500_000,
    ownedAssetIds: [ASSETS[0]?.id ?? "x"],
    completedMissionIds: [MISSIONS[0]?.id ?? "y"],
  };
  const profileB = {
    level: 60,
    hoursPerDay: 8,
    cash: 9_000_000,
    ownedAssetIds: [],
    completedMissionIds: [],
  };

  it("does not vary with the player", () => {
    expect(datasetDigest()).toBe(datasetDigest());
    expect(SYSTEM_PROMPT).not.toMatch(/level \d+/i);
  });

  it("keeps the player's details out of the frozen part", () => {
    const prefix = `${SYSTEM_PROMPT}\n\n---\n\nDATASET\n\n${datasetDigest()}`;
    const a = profileBlock(profileA as never);
    const b = profileBlock(profileB as never);

    // The two profiles must produce different text -- otherwise this test
    // would pass by the blocks being empty.
    expect(a).not.toBe(b);
    expect(prefix).not.toContain(a);
    expect(prefix).not.toContain(b);
  });
});
