import { afterEach, describe, expect, it, vi } from "vitest";

import { hasDatabase } from "@/lib/db/local-postgres";

/**
 * The tests that were missing when every Postgres path was broken.
 *
 * `getStore()` picked its adapter with `require("@/lib/db/postgres")`, which
 * in the Next server build returns an empty object, so it handed back
 * `undefined` and every page behind a login answered 500. Nothing caught it:
 * the unit tests only ever exercised the in-memory store, and opening pages in
 * a browser proved nothing either, because the landing and sign-in pages never
 * read the store at all.
 *
 * So these assert the one thing that was actually false -- that asking for a
 * store returns a store -- in each of the three configurations, rather than
 * asserting anything about what the store then does.
 */
describe("hasDatabase", () => {
  it("is false with nothing configured", () => {
    expect(hasDatabase({})).toBe(false);
  });

  it("is true for a real connection string", () => {
    expect(hasDatabase({ DATABASE_URL: "postgres://host/db" })).toBe(true);
  });

  it("is true for the local database", () => {
    // The case all three call sites used to get wrong: `npm run dev:db` is a
    // real PostgreSQL, and testing DATABASE_URL alone reports there is none.
    expect(hasDatabase({ LOCAL_DB: "1" })).toBe(true);
  });

  it("is false in production without a connection string", () => {
    expect(hasDatabase({ LOCAL_DB: "1", NODE_ENV: "production" })).toBe(false);
  });
});

describe("getStore", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.resetModules();
  });

  it("returns a usable store with no database", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.LOCAL_DB;

    const { getStore } = await import("@/lib/db/store");
    expect(getStore()).toBeDefined();
    expect(typeof getStore().resolveSession).toBe("function");
  });

  it("returns a usable store for the local database", async () => {
    delete process.env.DATABASE_URL;
    process.env.LOCAL_DB = "1";

    const { getStore } = await import("@/lib/db/store");
    const store = getStore();
    // Not `toBeDefined` alone: the bug returned undefined, and the first thing
    // any caller did was reach for a method on it.
    expect(store).toBeDefined();
    expect(typeof store.resolveSession).toBe("function");
  });

  it("returns a usable store for a real connection string", async () => {
    // Set, never connected to. Choosing the adapter must not require a
    // reachable database, or this test would need one.
    process.env.DATABASE_URL = "postgres://user:pw@example.invalid:5432/db";
    delete process.env.LOCAL_DB;

    const { getStore } = await import("@/lib/db/store");
    const store = getStore();
    expect(store).toBeDefined();
    expect(typeof store.resolveSession).toBe("function");
  });

  it("refuses the memory store in production", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.LOCAL_DB;
    vi.stubEnv("NODE_ENV", "production");

    const { getStore } = await import("@/lib/db/store");
    expect(() => getStore()).toThrow(/DATABASE_URL/);
    vi.unstubAllEnvs();
  });
});
