import { describe, expect, it } from "vitest";

import { DEV_ACCOUNT, devSeedAllowed } from "@/lib/db/seed-dev-account";

/**
 * The seeded development account is a real account with a password that is
 * written down in the source and printed to the console. That is fine on a
 * laptop and is a back door anywhere else, so the conditions that keep it on a
 * laptop are the thing worth testing.
 *
 * Each guard is checked on its own, because the failure that matters is not
 * "all three were removed" — nobody does that. It is one of them being relaxed
 * by someone who has a good reason for that one and has not thought about the
 * other two.
 */
describe("devSeedAllowed", () => {
  it("allows it in a bare local checkout", () => {
    expect(devSeedAllowed({})).toBe(true);
    expect(devSeedAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(devSeedAllowed({ NODE_ENV: "test" })).toBe(true);
  });

  it("refuses in production", () => {
    expect(devSeedAllowed({ NODE_ENV: "production" })).toBe(false);
  });

  it("refuses whenever there is a real database, whatever NODE_ENV says", () => {
    // NODE_ENV is not a reliable signal on its own: plenty of setups run a
    // staging deployment without it set. A connection string is the better
    // tell, because nobody points one at a throwaway.
    expect(
      devSeedAllowed({ DATABASE_URL: "postgres://user:pw@host/db" }),
    ).toBe(false);

    expect(
      devSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgres://localhost/lab",
      }),
    ).toBe(false);
  });

  it("can be switched off by hand", () => {
    expect(devSeedAllowed({ SEED_DEV_ACCOUNT: "0" })).toBe(false);
  });

  it("stays on for any value other than the explicit off switch", () => {
    // "0" and only "0". A vague truthiness check here would mean
    // SEED_DEV_ACCOUNT=false silently leaving it enabled.
    expect(devSeedAllowed({ SEED_DEV_ACCOUNT: "1" })).toBe(true);
  });

  it("refuses if any single guard says no, not only if all do", () => {
    const productionish = { NODE_ENV: "production", SEED_DEV_ACCOUNT: "1" };
    expect(devSeedAllowed(productionish)).toBe(false);
  });
});

describe("DEV_ACCOUNT", () => {
  it("meets the same password rule the registration form enforces", () => {
    // If this drifts below the minimum, the seed creates an account that a
    // person could not have registered, and the next person to tighten the
    // rule finds a fixture that violates it.
    expect(DEV_ACCOUNT.password.length).toBeGreaterThanOrEqual(10);
  });

  it("meets the username rule", () => {
    expect(DEV_ACCOUNT.username).toMatch(/^[a-zA-Z0-9_-]{3,32}$/);
  });

  it("uses a domain that cannot receive mail", () => {
    // .local is reserved and never resolves publicly, so this address cannot
    // collide with a real person's and nothing can be sent to it by accident.
    expect(DEV_ACCOUNT.email.endsWith(".local")).toBe(true);
  });
});
