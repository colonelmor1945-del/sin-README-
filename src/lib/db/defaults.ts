import type { PlayerProfile } from "@/lib/types";

/**
 * Values both store adapters start an account from.
 *
 * These lived in `store.ts` next to the adapter that first used them, which
 * put them on the wrong side of a cycle: `store.ts` requires `postgres.ts` to
 * pick an adapter, and `postgres.ts` imported these back out of `store.ts`.
 * The require then resolved to a half-built module and `getStore()` handed
 * back `undefined`, so every page behind a login answered 500 the moment a
 * real database was switched on.
 *
 * A module with no imports of its own cannot take part in a cycle, which is
 * the whole reason this file exists.
 */
export const DEFAULT_PROFILE: PlayerProfile = {
  currentMoney: 2_000_000,
  level: 35,
  ownedAssetIds: [],
  completedMissionIds: [],
  playstyle: "fastest-money",
  goal: 10_000_000,
};

/** Credits granted on signup, so a new account can try a plan immediately. */
export const SIGNUP_CREDITS = 10;
