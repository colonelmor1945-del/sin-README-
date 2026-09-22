import "server-only";

import { hashPassword } from "@/lib/auth/password";
import { localDbEnabled } from "@/lib/db/local-postgres";
import { DEFAULT_PROFILE, SIGNUP_CREDITS } from "@/lib/db/defaults";
import { postgresStore } from "@/lib/db/postgres";
import { DEV_ACCOUNT, devSeedAllowed } from "@/lib/db/seed-dev-account";
import type { CreditReason, MoneyPlan, PlayerProfile, Tier } from "@/lib/types";

/**
 * Repository interface plus an in-memory development adapter.
 *
 * Phase 1 runs on this adapter so the product is demonstrable without
 * provisioning Postgres. The interface mirrors src/lib/db/schema.sql one to
 * one, so the Postgres adapter is a straight translation with no changes to
 * calling code.
 *
 * The in-memory adapter is per-process and resets on restart. Do not ship it.
 */

export interface Account {
  id: string;
  email: string;
  username: string;
  tier: Tier;
  role: "member" | "editor" | "admin";
  createdAt: string;
}

/** Never leaves the data layer. Nothing outside this file returns it. */
interface AccountRecord extends Account {
  passwordHash: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

export interface Store {
  /* Identity */
  createUser(input: {
    email: string;
    username: string;
    passwordHash: string;
  }): Promise<Account>;
  getAccount(id: string): Promise<Account | null>;
  upsertAccount(account: Account): Promise<Account>;
  findByEmail(email: string): Promise<(Account & { passwordHash: string }) | null>;
  emailTaken(email: string): Promise<boolean>;
  /**
   * Erase a user and everything personal attached to them.
   *
   * Not a soft delete and not a flag: the row goes. The schema carries the
   * rest — everything personal cascades from `users(id)`, while `payments`,
   * `support_contributions` and `audit_log` are ON DELETE SET NULL, so the
   * financial and audit records survive with nobody attached to them. That
   * split is deliberate: erasure is a right, and keeping books is a separate
   * legal obligation that anonymised rows satisfy without holding a person.
   */
  deleteAccount(userId: string): Promise<void>;
  usernameTaken(username: string): Promise<boolean>;

  /* Sessions */
  createSession(tokenHash: string, userId: string, ttlMs: number): Promise<void>;
  resolveSession(tokenHash: string): Promise<Account | null>;
  deleteSession(tokenHash: string): Promise<void>;

  /* Player data */
  getProfile(userId: string): Promise<PlayerProfile>;
  saveProfile(userId: string, profile: PlayerProfile): Promise<void>;

  listPlans(userId: string): Promise<MoneyPlan[]>;
  savePlan(userId: string, plan: MoneyPlan): Promise<void>;
  setStepDone(userId: string, planId: string, order: number, done: boolean): Promise<void>;

  /* Usage and credits */
  bumpDailyQueries(userId: string): Promise<number>;
  getDailyQueries(userId: string): Promise<number>;
  getCredits(userId: string): Promise<number>;
  /** Atomic in the SQL adapter. Returns the new balance, or null if short. */
  spendCredits(userId: string, amount: number, reason: CreditReason): Promise<number | null>;
  grantCredits(userId: string, amount: number, reason: CreditReason): Promise<number>;

  /* Admin */
  countUsers(): Promise<{ total: number; byTier: Record<Tier, number> }>;
}

// Re-exported so the existing importers do not all have to change, but they
// live in `defaults.ts` now so `postgres.ts` can read them without importing
// this module and closing a cycle.
export { DEFAULT_PROFILE, SIGNUP_CREDITS };

const today = () => new Date().toISOString().slice(0, 10);

interface Row {
  account: AccountRecord;
  profile: PlayerProfile;
  plans: MoneyPlan[];
  queries: Map<string, number>;
  credits: number;
}

/**
 * Module-level state hung off globalThis so it survives hot reloads in dev.
 * Without this every file save would log everyone out.
 */
interface Db {
  rows: Map<string, Row>;
  byEmail: Map<string, string>;
  byUsername: Map<string, string>;
  sessions: Map<string, SessionRecord>;
}

const g = globalThis as { __labDb?: Db };
const db: Db =
  g.__labDb ??
  (g.__labDb = {
    rows: new Map(),
    byEmail: new Map(),
    byUsername: new Map(),
    sessions: new Map(),
  });

const publicAccount = (r: AccountRecord): Account => ({
  id: r.id,
  email: r.email,
  username: r.username,
  tier: r.tier,
  role: r.role,
  createdAt: r.createdAt,
});

export const memoryStore: Store = {
  async createUser({ email, username, passwordHash }) {
    const id = crypto.randomUUID();
    const record: AccountRecord = {
      id,
      email: email.toLowerCase(),
      username,
      tier: "free",
      // The first account to register owns the instance. Every later signup is
      // a plain member. In the Postgres adapter this becomes an explicit
      // bootstrap step rather than a race on row count.
      role: db.rows.size === 0 ? "admin" : "member",
      createdAt: new Date().toISOString(),
      passwordHash,
    };

    db.rows.set(id, {
      account: record,
      profile: { ...DEFAULT_PROFILE },
      plans: [],
      queries: new Map(),
      credits: SIGNUP_CREDITS,
    });
    db.byEmail.set(record.email, id);
    db.byUsername.set(username.toLowerCase(), id);

    return publicAccount(record);
  },

  async deleteAccount(userId) {
    const row = db.rows.get(userId);
    if (!row) return;

    db.rows.delete(userId);
    db.byEmail.delete(row.account.email);
    db.byUsername.delete(row.account.username.toLowerCase());

    // Sessions are keyed by token hash, so the only way to find this user's is
    // to walk them. Leaving one behind would keep a deleted account signed in.
    for (const [tokenHash, session] of db.sessions) {
      if (session.userId === userId) db.sessions.delete(tokenHash);
    }
  },

  async getAccount(id) {
    const row = db.rows.get(id);
    return row ? publicAccount(row.account) : null;
  },

  async upsertAccount(account) {
    const row = db.rows.get(account.id);
    if (row) row.account = { ...row.account, ...account };
    return account;
  },

  async findByEmail(email) {
    await devSeed;
    const id = db.byEmail.get(email.toLowerCase());
    const row = id ? db.rows.get(id) : undefined;
    if (!row) return null;
    return { ...publicAccount(row.account), passwordHash: row.account.passwordHash };
  },

  async emailTaken(email) {
    await devSeed;
    return db.byEmail.has(email.toLowerCase());
  },

  async usernameTaken(username) {
    await devSeed;
    return db.byUsername.has(username.toLowerCase());
  },

  async createSession(tokenHash, userId, ttlMs) {
    db.sessions.set(tokenHash, {
      tokenHash,
      userId,
      expiresAt: Date.now() + ttlMs,
    });
  },

  async resolveSession(tokenHash) {
    await devSeed;
    const session = db.sessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      db.sessions.delete(tokenHash);
      return null;
    }
    const row = db.rows.get(session.userId);
    return row ? publicAccount(row.account) : null;
  },

  async deleteSession(tokenHash) {
    db.sessions.delete(tokenHash);
  },

  async getProfile(userId) {
    return db.rows.get(userId)?.profile ?? { ...DEFAULT_PROFILE };
  },

  async saveProfile(userId, profile) {
    const row = db.rows.get(userId);
    if (row) row.profile = profile;
  },

  async listPlans(userId) {
    return db.rows.get(userId)?.plans ?? [];
  },

  async savePlan(userId, plan) {
    const row = db.rows.get(userId);
    if (row) row.plans = [plan, ...row.plans].slice(0, 20);
  },

  async setStepDone(userId, planId, order, done) {
    const plan = db.rows.get(userId)?.plans.find((p) => p.id === planId);
    const step = plan?.steps.find((s) => s.order === order);
    if (step) step.done = done;
  },

  async bumpDailyQueries(userId) {
    const row = db.rows.get(userId);
    if (!row) return 0;
    const key = today();
    const next = (row.queries.get(key) ?? 0) + 1;
    row.queries.set(key, next);
    return next;
  },

  async getDailyQueries(userId) {
    return db.rows.get(userId)?.queries.get(today()) ?? 0;
  },

  async getCredits(userId) {
    return db.rows.get(userId)?.credits ?? 0;
  },

  async spendCredits(userId, amount) {
    const row = db.rows.get(userId);
    if (!row || row.credits < amount) return null;
    row.credits -= amount;
    return row.credits;
  },

  async grantCredits(userId, amount) {
    const row = db.rows.get(userId);
    if (!row) return 0;
    row.credits += amount;
    return row.credits;
  },

  async countUsers() {
    const byTier: Record<Tier, number> = { free: 0, pro: 0, elite: 0 };
    for (const row of db.rows.values()) byTier[row.account.tier] += 1;
    return { total: db.rows.size, byTier };
  },
};

/**
 * Creates the development account once, on first use.
 *
 * It has to finish before a sign-in attempt is answered, or the first login
 * after a restart races the seed and is told the account does not exist. So
 * every method that reads identity waits on this.
 *
 * It calls createUser, which deliberately does NOT wait: a seed that waited
 * for itself would deadlock. Membership is checked against the map directly
 * for the same reason.
 */
const devSeed: Promise<void> = (async () => {
  // The local database seeds itself, in local-postgres.ts, because its account
  // persists and this one does not.
  if (localDbEnabled()) return;
  if (!devSeedAllowed()) return;
  if (db.byEmail.has(DEV_ACCOUNT.email)) return;

  await memoryStore.createUser({
    email: DEV_ACCOUNT.email,
    username: DEV_ACCOUNT.username,
    passwordHash: await hashPassword(DEV_ACCOUNT.password),
  });

  // Seeded before anyone can register, so it takes the admin role the first
  // account gets. That is the point: the admin screens are behind that role
  // and are otherwise the hardest part of the product to reach.
  console.log(
    [
      "",
      "  Development account ready",
      `    ${DEV_ACCOUNT.email}`,
      `    ${DEV_ACCOUNT.password}`,
      "  Admin. In memory, so it is recreated on every restart.",
      "  Set SEED_DEV_ACCOUNT=0 to turn it off.",
      "",
    ].join("\n"),
  );
})();

/**
 * Adapter selection.
 *
 * Postgres whenever DATABASE_URL is set or a local database was asked for, the
 * in-memory adapter otherwise.
 *
 * WHY THIS IS NOT A LAZY REQUIRE ANY MORE
 * It used to be, so that a deployment without a database never pulled the pg
 * driver into the bundle. It did not work. `require()` of an ESM module in the
 * Next server build hands back an empty object, so `postgresStore` was
 * `undefined` and `getStore()` returned `undefined` -- every page behind a
 * login answered 500 the moment either Postgres path was switched on. Nobody
 * had noticed because nobody had switched one on yet.
 *
 * So the import is static and the driver is always in the server bundle. That
 * is a real cost and it is the smaller one: the deployment that the lazy
 * require was saving space for is the same deployment that sets DATABASE_URL
 * and needs the driver anyway.
 *
 * In production the memory adapter is refused outright rather than silently
 * accepted: it loses every account on restart, and discovering that after
 * launch is not a recoverable mistake.
 */
export function getStore(): Store {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL is not set. The in-memory store loses every account on restart and must not run in production.",
      );
    }

    // A local PGlite database, if one was asked for. Same adapter and the same
    // SQL as production, so constraint violations and transaction behaviour
    // show up locally instead of on the deployment.
    return localDbEnabled() ? postgresStore : memoryStore;
  }

  return postgresStore;
}
