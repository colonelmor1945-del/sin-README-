/**
 * The release date, held to the rules the rest of the product is held to.
 *
 * Two of these tests are about this repository: a bare local date would drift
 * with the server's time zone, and a "verified" label with no source behind it
 * is exactly the kind of confident emptiness the provenance system exists to
 * prevent.
 *
 * The third is about the other repository. The Engine's countdown PWA carries
 * the same date in three files of its own, and the two projects cannot import
 * from one another yet. So each side pins the shared value and fails loudly
 * when the other moves alone. Rockstar has already moved this date twice, and
 * the failure mode is quiet: one app counts to one date while the other sends a
 * notification about a different one.
 */
import { describe, expect, it } from "vitest";

import { LAUNCH } from "./launch";

describe("LAUNCH", () => {
  it("is the date the Engine's countdown also counts to", () => {
    // Mirrored in apps/countdown/{public/index.html,public/sw.js,src/worker.ts}
    // in the-lab-neural-engine, guarded there by src/release-date.test.ts.
    expect(LAUNCH.target).toBe("2026-11-19T00:00:00-05:00");
  });

  it("carries an explicit offset rather than a bare local date", () => {
    expect(LAUNCH.target).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
    expect(Number.isNaN(Date.parse(LAUNCH.target))).toBe(false);
  });

  it("cites a source whenever it claims to be verified", () => {
    if (LAUNCH.provenance !== "verified") return;
    expect(LAUNCH.source.trim()).not.toBe("");
    expect(LAUNCH.sourceUrl ?? "").toMatch(/^https:\/\//);
  });

  it("keeps every date it has previously shown", () => {
    // A release that has moved before is likely to move again, and hiding that
    // would be the same false confidence the labels exist to prevent.
    expect(LAUNCH.history.length).toBeGreaterThan(0);
    for (const past of LAUNCH.history) {
      expect(past.date).not.toBe(LAUNCH.target);
      expect(past.note.trim()).not.toBe("");
    }
  });
});
