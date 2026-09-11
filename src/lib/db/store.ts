import "server-only";

import { hashPassword } from "@/lib/auth/password";
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
 * Postgres whenever DATABASE_URL is set, the in-memory adapter otherwise.
 * The import is lazy so a deployment without a database never pulls the pg
 * driver into the bundle, and a local checkout needs no Postgres at all.
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
    return memoryStore;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { postgresStore } = require("@/lib/db/postgres") as typeof import("@/lib/db/postgres");
  return postgresStore;
}
