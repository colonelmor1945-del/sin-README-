import { beforeEach, describe, expect, it } from "vitest";

/**
 * Public submissions folded into the ingest pipeline.
 *
 * The claim under test: a visitor's submission is not a second-class item
 * shown on a separate page, it goes through the exact same corroboration
 * count as Reddit and YouTube. Two submissions on the same claim are two
 * independent sources, the same as two polled sources would be. This runs
 * against the real in-memory store (via getStore()) rather than a mock, so
 * the claimKey a submission is filed under is computed the same way the
 * pipeline computes its own.
 *
 * The in-memory store is a single process-wide list, so every test below
 * tags its claim with a random word unrelated to English GTA vocabulary and
 * scopes its assertions to that word's own claimKey — otherwise one test's
 * submissions would corroborate another's.
 */
describe("public submissions in the ingest pipeline", () => {
  let pipeline: typeof import("@/lib/ingest/pipeline");
  let store: typeof import("@/lib/db/store");

  beforeEach(async () => {
    pipeline = await import("@/lib/ingest/pipeline");
    store = await import("@/lib/db/store");
  });

  const tag = () => `zz${Math.random().toString(36).slice(2, 10)}`;

  async function submit(
    claim: string,
    { ipHash = null, sourceUrl = "https://example.com/proof" }: { ipHash?: string | null; sourceUrl?: string } = {},
  ) {
    return store.getStore().createSubmission({
      claim,
      sourceUrl,
      submittedBy: "Tester",
      claimKey: pipeline.claimKey(claim),
      ipHash,
    });
  }

  // claimKey() keeps at most 5 significant words, sorted, so a test claim has
  // to stay at or under that count — otherwise the tag word itself can be the
  // one that gets cut, and the test would be checking the wrong key.

  it("appears in the queue with its provenance capped at community", async () => {
    const word = tag();
    await submit(`${word} heist payout`);

    const run = await pipeline.runIngestion();
    const found = run.items.find((i) => i.claimKey === pipeline.claimKey(`${word} heist payout`));

    expect(found).toBeDefined();
    expect(found!.sourceId).toBe("public-submission");
    expect(found!.provenance).toBe("community");
  });

  it("corroborates two submissions describing the same claim differently", async () => {
    const word = tag();
    // Same four significant words in both, different order and connectives —
    // claimKey sorts them, so word order does not matter, but the set has to
    // match exactly for the two to collide. Distinct ipHash: two different
    // visitors, which is the case this is meant to count as two sources.
    await submit(`${word} heist pays big`, { ipHash: "visitor-a" });
    await submit(`The big ${word} heist pays`, { ipHash: "visitor-b" });

    const run = await pipeline.runIngestion();
    const key = pipeline.claimKey(`${word} heist pays big`);
    const matches = run.items.filter((i) => i.claimKey === key);

    expect(matches).toHaveLength(2);
    expect(matches.every((i) => i.sourceId === "public-submission")).toBe(true);
    expect(matches[0].corroboration).toBe(2);
    expect(matches[1].corroboration).toBe(2);
  });

  it("does not let one visitor corroborate their own submission by resubmitting it", async () => {
    // The exact failure corroborate() exists to prevent, applied to this
    // source: without a per-submitter key, two rows sharing the sourceId
    // "public-submission" look like two sources when they are one person.
    const word = tag();
    await submit(`${word} heist pays big`, { ipHash: "same-visitor" });
    await submit(`The big ${word} heist pays`, { ipHash: "same-visitor" });

    const run = await pipeline.runIngestion();
    const key = pipeline.claimKey(`${word} heist pays big`);
    const matches = run.items.filter((i) => i.claimKey === key);

    expect(matches).toHaveLength(2);
    for (const item of matches) {
      expect(item.corroboration).toBe(1);
    }
  });

  it("does not corroborate two unrelated submissions", async () => {
    const wordA = tag();
    const wordB = tag();
    await submit(`${wordA} heist payout`);
    await submit(`${wordB} income guide`);

    const run = await pipeline.runIngestion();
    const matchA = run.items.find((i) => i.claimKey === pipeline.claimKey(`${wordA} heist payout`));
    const matchB = run.items.find((i) => i.claimKey === pipeline.claimKey(`${wordB} income guide`));

    expect(matchA?.corroboration).toBe(1);
    expect(matchB?.corroboration).toBe(1);
  });

  it("starts life pending, which is the status the queue reads", async () => {
    // The queue only ever surfaces status "pending" rows (pipeline.ts filters
    // on it before mapping to IngestItem); promoting or rejecting a
    // submission is an editor action this task did not build. What matters
    // here is the contract a promote/reject feature will rely on: a fresh
    // submission is pending by default, not some other status that would
    // silently vanish from the queue on day one.
    const submission = await submit(`${tag()} heist pays the most per hour`);
    expect(submission.status).toBe("pending");
  });
});
