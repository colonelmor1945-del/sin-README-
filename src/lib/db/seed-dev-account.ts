/**
 * A standing account for local testing.
 *
 * The in-memory store is per-process and empties on every restart, so testing
 * anything behind a login meant registering again after each one. That is the
 * kind of friction that stops people trying the signed-in half of the product
 * at all, which is most of it.
 *
 * WHY THIS CAN NEVER REACH PRODUCTION
 * Three independent conditions, any one of which is enough to stop it, because
 * a seeded account with a published password is a back door if even one of
 * them is wrong:
 *
 *   1. NODE_ENV must not be "production".
 *   2. DATABASE_URL must be unset. A real database means a real deployment,
 *      and production already refuses to start on the memory store anyway.
 *   3. SEED_DEV_ACCOUNT must not be "0", so anyone who wants the empty-state
 *      experience back can switch it off.
 *
 * The password is deliberately not a secret and is printed on boot. Pretending
 * a hardcoded development credential is confidential is how it ends up trusted
 * somewhere it should not be.
 *
 * The insertion itself lives in store.ts, next to the maps it writes to. That
 * is not squeamishness about layering: seeding through the store's own public
 * methods would deadlock, because those methods wait for seeding to finish.
 */

export const DEV_ACCOUNT = {
  email: "dev@moneylab.local",
  username: "devtester",
  // Ten characters minimum, matching the registration rule.
  password: "vicecity26",
} as const;

/** Takes a plain record so tests can describe an environment without building one. */
export function devSeedAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.DATABASE_URL) return false;
  if (env.SEED_DEV_ACCOUNT === "0") return false;
  return true;
}
