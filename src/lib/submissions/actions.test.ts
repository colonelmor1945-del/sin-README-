import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUDGETS } from "@/lib/ratelimit";

/**
 * The public submission action.
 *
 * No sign-in gates this, so unlike most of the app's server actions this one
 * is reachable by absolutely anyone — which makes the things worth asserting
 * different: a source URL is genuinely required (not just documented as
 * required), the rate limit is keyed on the caller rather than on a field
 * they control, and a submission actually lands in the store computed with
 * the same claimKey the ingest pipeline will look it up by.
 */

let requestHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
  }),
}));

const from = (ip: string) => {
  requestHeaders = new Map([["x-forwarded-for", ip]]);
};

let ipCounter = 0;
const freshIp = () => `10.1.0.${++ipCounter % 250}.${Date.now() % 1000}`;

async function run(fields: Record<string, string>) {
  const { submitClaim } = await import("@/lib/submissions/actions");
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return submitClaim({}, form);
}

describe("submitClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from(freshIp());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a well-formed claim and source URL", async () => {
    const state = await run({
      claim: "The Kortz Center Heist pays about 1.4 million per hour.",
      sourceUrl: "https://www.reddit.com/r/GTA6/comments/example",
    });
    expect(state).toMatchObject({ success: true });
  });

  it("refuses a submission with no source URL", async () => {
    const state = await run({
      claim: "The Kortz Center Heist pays about 1.4 million per hour.",
      sourceUrl: "",
    });
    expect(state.success).toBeUndefined();
    expect(state.field).toBe("sourceUrl");
  });

  it("refuses a source URL that is not actually a URL", async () => {
    const state = await run({
      claim: "The Kortz Center Heist pays about 1.4 million per hour.",
      sourceUrl: "just trust me on this one",
    });
    expect(state.field).toBe("sourceUrl");
  });

  it("refuses a claim that is too short to be a claim", async () => {
    const state = await run({
      claim: "yes",
      sourceUrl: "https://example.com/proof",
    });
    expect(state.field).toBe("claim");
  });

  it("stores the submission under the same claimKey the pipeline computes", async () => {
    const { submitClaim } = await import("@/lib/submissions/actions");
    const { claimKey } = await import("@/lib/ingest/pipeline");
    const store = await import("@/lib/db/store");

    const claim = "The Kortz Center Heist pays about 1.4 million per hour.";
    const form = new FormData();
    form.set("claim", claim);
    form.set("sourceUrl", "https://example.com/proof");

    await submitClaim({}, form);

    const [latest] = await store.getStore().listSubmissions(1);
    expect(latest.claim).toBe(claim);
    expect(latest.claimKey).toBe(claimKey(claim));
    expect(latest.status).toBe("pending");
  });

  it("keeps an optional handle for credit, and stores null without one", async () => {
    const store = await import("@/lib/db/store");

    await run({
      claim: "A distinct claim about the nightclub income formula changing.",
      sourceUrl: "https://example.com/proof-1",
      submittedBy: "TestHandle",
    });
    const [withHandle] = await store.getStore().listSubmissions(1);
    expect(withHandle.submittedBy).toBe("TestHandle");

    await run({
      claim: "Another distinct claim about vehicle export values today.",
      sourceUrl: "https://example.com/proof-2",
    });
    const [withoutHandle] = await store.getStore().listSubmissions(1);
    expect(withoutHandle.submittedBy).toBeNull();
  });

  it("rate limits repeated submissions from the same caller", async () => {
    from("203.0.113.9");
    let lastState;
    for (let i = 0; i < BUDGETS.submission.limit + 1; i++) {
      lastState = await run({
        claim: `Distinct claim number ${i} about a different game mechanic.`,
        sourceUrl: `https://example.com/proof-${i}`,
      });
    }
    expect(lastState?.success).toBeUndefined();
    expect(lastState?.error).toMatch(/too many/i);
  });

  it("does not rate limit a different caller sharing nothing but the form", async () => {
    from("198.51.100.1");
    for (let i = 0; i < BUDGETS.submission.limit; i++) {
      await run({
        claim: `Burns through the limit for this caller ${i} on purpose.`,
        sourceUrl: `https://example.com/burn-${i}`,
      });
    }

    from("198.51.100.2");
    const state = await run({
      claim: "A fresh caller should not inherit someone else's rate limit.",
      sourceUrl: "https://example.com/fresh",
    });
    expect(state.success).toBe(true);
  });
});
