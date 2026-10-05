import { beforeEach, describe, expect, it } from "vitest";

/**
 * Entitlements: the daily query count and the daily cost cap.
 *
 * The claim under test is the one the pricing.ts header comment makes and
 * nothing used to enforce: a paid account cannot be made to cost more in
 * model spend than its subscription in a day, no matter how long the model's
 * replies run. dailyQueries bounds request count; it cannot bound cost,
 * because two requests are not the same price. So these tests run both gates
 * against a real store (the in-memory adapter, via getStore()) rather than a
 * mock, the same way session.test.ts does — a mock would answer whatever the
 * test asked it to.
 */

describe("entitlements", () => {
  let entitlements: typeof import("@/lib/entitlements");
  let store: typeof import("@/lib/db/store");
  let pricing: typeof import("@/lib/pricing");

  beforeEach(async () => {
    entitlements = await import("@/lib/entitlements");
    store = await import("@/lib/db/store");
    pricing = await import("@/lib/pricing");
  });

  async function makeAccount() {
    const s = store.getStore();
    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    return s.createUser({
      email: `ent${stamp}@example.com`,
      username: `ent${stamp}`.slice(0, 30),
      passwordHash: "not-checked-here",
    });
  }

  describe("consumeQuery — request count", () => {
    it("allows requests up to the tier's daily limit", async () => {
      const account = await makeAccount();
      const limit = entitlements.TIERS.free.dailyQueries;
      for (let i = 0; i < limit; i++) {
        const result = await entitlements.consumeQuery(account.id, "free");
        expect(result.allowed).toBe(true);
      }
    });

    it("refuses the request once the daily limit is used up", async () => {
      const account = await makeAccount();
      const limit = entitlements.TIERS.free.dailyQueries;
      for (let i = 0; i < limit; i++) {
        await entitlements.consumeQuery(account.id, "free");
      }
      const result = await entitlements.consumeQuery(account.id, "free");
      expect(result).toMatchObject({ allowed: false, reason: "daily-limit", limit });
    });
  });

  describe("consumeQuery — cost cap", () => {
    it("refuses a paid-tier request once today's spend reaches the cap, even with queries left", async () => {
      const account = await makeAccount();
      const cap = pricing.DAILY_COST_CAP_MINOR.pro as number;

      // Nowhere near the 150/day query limit, but a handful of maxed-out
      // replies already spent the day's model budget.
      await store.getStore().bumpDailySpend(account.id, cap);

      const result = await entitlements.consumeQuery(account.id, "pro");
      expect(result).toMatchObject({ allowed: false, reason: "cost-cap" });
      expect(result.used).toBeLessThan(entitlements.TIERS.pro.dailyQueries);
    });

    it("allows a paid-tier request while today's spend is still under the cap", async () => {
      const account = await makeAccount();
      const cap = pricing.DAILY_COST_CAP_MINOR.pro as number;

      await store.getStore().bumpDailySpend(account.id, cap - 1);

      const result = await entitlements.consumeQuery(account.id, "pro");
      expect(result.allowed).toBe(true);
    });

    it("never applies a cost cap to the free tier, which has none", async () => {
      const account = await makeAccount();
      // An amount that would blow through any paid tier's cap many times over.
      await store.getStore().bumpDailySpend(account.id, 100_000);

      const result = await entitlements.consumeQuery(account.id, "free");
      expect(result.allowed).toBe(true);
    });
  });

  describe("recordUsageCost", () => {
    it("accumulates what real provider usage cost against the daily total", async () => {
      const account = await makeAccount();
      const before = await store.getStore().getDailySpend(account.id);

      await entitlements.recordUsageCost(account.id, 42);
      await entitlements.recordUsageCost(account.id, 8);

      expect(await store.getStore().getDailySpend(account.id)).toBe(before + 50);
    });

    it("makes a spend recorded this way count toward the cap on the next request", async () => {
      const account = await makeAccount();
      const cap = pricing.DAILY_COST_CAP_MINOR.pro as number;

      // A single request whose real usage, once billed, exactly exhausts the
      // day's budget — the exact scenario a fixed request count cannot catch.
      await entitlements.recordUsageCost(account.id, cap);

      const result = await entitlements.consumeQuery(account.id, "pro");
      expect(result).toMatchObject({ allowed: false, reason: "cost-cap" });
    });

    it("does nothing for a non-positive amount", async () => {
      const account = await makeAccount();
      await entitlements.recordUsageCost(account.id, 0);
      await entitlements.recordUsageCost(account.id, -5);
      expect(await store.getStore().getDailySpend(account.id)).toBe(0);
    });
  });
});
