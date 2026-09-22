import "server-only";

import { Pool } from "pg";

import {
  localDbEnabled,
  localPool,
  type PgClientLike,
  type PgLike,
} from "@/lib/db/local-postgres";
import { DEFAULT_PROFILE, SIGNUP_CREDITS } from "@/lib/db/defaults";
import type { Account, Store } from "@/lib/db/store";
import type {
  CreditReason,
  MoneyPlan,
  PlanHorizon,
  PlanStrategy,
  PlayerProfile,
  Tier,
} from "@/lib/types";

/**
 * PostgreSQL adapter.
 *
 * A straight translation of the Store interface onto src/lib/db/schema.sql.
 * Nothing outside this file knows which adapter is running.
 *
 * Three things worth knowing before editing:
 *
 *  - **Every write that touches two tables runs in a transaction.** Credits are
 *    the sharp example: the balance and the ledger row must move together or
 *    the ledger stops being an audit trail. `spendCredits` also takes a row
 *    lock, because two concurrent requests reading the same balance is how you
 *    hand out free model calls.
 *  - **The enums differ between TypeScript and SQL.** The database uses
 *    snake_case (`fastest_money`, `ai_projection`) because that is the SQL
 *    convention; the application uses kebab-case. The mapping lives here and
 *    nowhere else.
 *  - **Money is BIGINT**, which node-postgres returns as a string to avoid
 *    silent precision loss. Every read of a money column goes through
 *    `Number()` deliberately: in-game balances are far below 2^53, so this is
 *    safe, but do not copy the pattern onto a column that could exceed it.
 */

const g = globalThis as { __pgPool?: Pool };

/**
 * Exported so `content/postgres.ts` uses this one rather than opening a second.
 * It had its own copy that read DATABASE_URL alone, so with the local database
 * the user store worked and every content write threw.
 */
export function pool(): PgLike {
  if (g.__pgPool) return g.__pgPool as unknown as PgLike;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // No connection string, but a local PGlite database is allowed. Every call
    // site expects pool() to return synchronously, and opening the database is
    // asynchronous, so this hands back a thin object that awaits it per call
    // rather than making twenty call sites await a pool.
    if (localDbEnabled()) {
      return {
        query: async (text, values) => (await localPool()).query(text, values),
        connect: async () => (await localPool()).connect(),
      } as PgLike;
    }

    throw new Error("DATABASE_URL is not set, so the Postgres adapter cannot start.");
  }

  g.__pgPool = new Pool({
    connectionString,
    // Managed Postgres almost always terminates TLS with its own certificate
    // chain. Opt out only when the URL says the connection is local.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  g.__pgPool.on("error", (error) => {
    // An idle client dying is normal with managed Postgres. Log it, do not
    // let it take the process down.
    console.warn("[postgres] idle client error", error.message);
  });

  return g.__pgPool as unknown as PgLike;
}

async function transaction<T>(run: (client: PgClientLike) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* Enum mapping ----------------------------------------------------------- */

const STRATEGY_TO_SQL: Record<PlanStrategy, string> = {
  "fastest-money": "fastest_money",
  safest: "safest",
  "max-profit": "max_profit",
  "low-investment": "low_investment",
  solo: "solo",
  multiplayer: "multiplayer",
};

const STRATEGY_FROM_SQL = Object.fromEntries(
  Object.entries(STRATEGY_TO_SQL).map(([ts, sql]) => [sql, ts as PlanStrategy]),
) as Record<string, PlanStrategy>;

/** Ledger reasons collapse onto the coarser credit_entry_kind enum. */
const CREDIT_KIND: Record<CreditReason, string> = {
  "signup-grant": "grant",
  "monthly-grant": "grant",
  purchase: "purchase",
  "ai-assistant": "spend",
  "money-plan": "spend",
  "creator-lab": "spend",
  "admin-adjustment": "admin_adjustment",
};

interface UserRow {
  id: string;
  email: string;
  username: string;
  plan: Tier;
  role: Account["role"];
  created_at: Date;
  password_hash: string | null;
}

const toAccount = (row: UserRow): Account => ({
  id: row.id,
  email: row.email,
  username: row.username,
  tier: row.plan,
  role: row.role,
  createdAt: row.created_at.toISOString(),
});

/* Adapter ---------------------------------------------------------------- */

export const postgresStore: Store = {
  async createUser({ email, username, passwordHash }) {
    return transaction(async (client) => {
      // The first account to register owns the instance. Done inside the
      // transaction so two simultaneous first signups cannot both win.
      const { rows: existing } = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM users WHERE deleted_at IS NULL",
      );
      const role = existing[0].count === "0" ? "admin" : "member";

      const { rows } = await client.query<UserRow>(
        `INSERT INTO users (email, username, auth_provider, auth_subject, role, password_hash)
         VALUES ($1, $2, 'password', $1, $3, $4)
         RETURNING id, email, username, plan, role, created_at, password_hash`,
        [email.toLowerCase(), username, role, passwordHash],
      );
      const user = rows[0];

      await client.query(
        "INSERT INTO user_profiles (user_id, current_money, level, playing_style, goal) VALUES ($1, $2, $3, $4, $5)",
        [
          user.id,
          DEFAULT_PROFILE.currentMoney,
          DEFAULT_PROFILE.level,
          STRATEGY_TO_SQL[DEFAULT_PROFILE.playstyle],
          DEFAULT_PROFILE.goal,
        ],
      );

      // Balance and ledger move together, always.
      await client.query(
        "INSERT INTO lab_credits (user_id, balance) VALUES ($1, $2)",
        [user.id, SIGNUP_CREDITS],
      );
      await client.query(
        "INSERT INTO credit_transactions (user_id, amount, kind, description) VALUES ($1, $2, 'grant', 'Signup grant')",
        [user.id, SIGNUP_CREDITS],
      );

      return toAccount(user);
    });
  },

  async getAccount(id) {
    const { rows } = await pool().query<UserRow>(
      "SELECT id, email, username, plan, role, created_at, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  },

  async upsertAccount(account) {
    await pool().query(
      "UPDATE users SET plan = $2, role = $3, username = $4, updated_at = now() WHERE id = $1",
      [account.id, account.tier, account.role, account.username],
    );
    return account;
  },

  async findByEmail(email) {
    const { rows } = await pool().query<UserRow>(
      "SELECT id, email, username, plan, role, created_at, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email.toLowerCase()],
    );
    if (!rows[0]) return null;
    return { ...toAccount(rows[0]), passwordHash: rows[0].password_hash ?? "" };
  },

  async deleteAccount(userId) {
    /*
     * A real DELETE, not `deleted_at = now()`.
     *
     * The soft-delete column exists and every read already filters on it, so
     * setting it would have been the smaller change. It is the wrong one for
     * this: a soft-deleted row still holds the address, the username, the
     * password hash, the saved plans and the AI conversations. That is not
     * erasure, it is the same personal data with a flag next to it — and the
     * UNIQUE constraint on email would also stop that person ever signing up
     * again with their own address.
     *
     * `deleted_at` is the right mechanism for suspending an account, which is
     * a different feature with a different actor. This one is the user asking
     * to be gone.
     *
     * The schema does the rest. Everything personal cascades from users(id);
     * payments, support_contributions and audit_log are ON DELETE SET NULL, so
     * the books and the audit trail survive with nobody attached.
     */
    await pool().query("DELETE FROM users WHERE id = $1", [userId]);
  },

  async emailTaken(email) {
    const { rowCount } = await pool().query(
      "SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email.toLowerCase()],
    );
    return (rowCount ?? 0) > 0;
  },

  async usernameTaken(username) {
    const { rowCount } = await pool().query(
      "SELECT 1 FROM users WHERE lower(username) = lower($1) AND deleted_at IS NULL",
      [username],
    );
    return (rowCount ?? 0) > 0;
  },

  /* Sessions ------------------------------------------------------------- */

  async createSession(tokenHash, userId, ttlMs) {
    await pool().query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)",
      [tokenHash, userId, String(ttlMs)],
    );
  },

  async resolveSession(tokenHash) {
    // Expired rows are filtered here rather than trusted to a cleanup job, so
    // a job that stops running can never resurrect a session.
    const { rows } = await pool().query<UserRow>(
      `SELECT u.id, u.email, u.username, u.plan, u.role, u.created_at, u.password_hash
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.expires_at > now()
          AND u.deleted_at IS NULL`,
      [tokenHash],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  },

  async deleteSession(tokenHash) {
    await pool().query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  },

  /* Player data ---------------------------------------------------------- */

  async getProfile(userId) {
    const { rows } = await pool().query<{
      current_money: string;
      level: number;
      playing_style: string;
      goal: string;
    }>(
      "SELECT current_money, level, playing_style, goal FROM user_profiles WHERE user_id = $1",
      [userId],
    );
    if (!rows[0]) return { ...DEFAULT_PROFILE };

    const [owned, done] = await Promise.all([
      pool().query<{ asset_id: string }>(
        "SELECT asset_id FROM user_assets WHERE user_id = $1",
        [userId],
      ),
      pool().query<{ mission_id: string }>(
        "SELECT mission_id FROM user_missions WHERE user_id = $1",
        [userId],
      ),
    ]);

    return {
      // BIGINT arrives as a string. In-game balances sit far below 2^53.
      currentMoney: Number(rows[0].current_money),
      level: rows[0].level,
      goal: Number(rows[0].goal),
      playstyle: STRATEGY_FROM_SQL[rows[0].playing_style] ?? DEFAULT_PROFILE.playstyle,
      ownedAssetIds: owned.rows.map((r) => r.asset_id),
      completedMissionIds: done.rows.map((r) => r.mission_id),
    };
  },

  async saveProfile(userId, profile) {
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO user_profiles (user_id, current_money, level, playing_style, goal)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
           SET current_money = EXCLUDED.current_money,
               level         = EXCLUDED.level,
               playing_style = EXCLUDED.playing_style,
               goal          = EXCLUDED.goal,
               updated_at    = now()`,
        [
          userId,
          profile.currentMoney,
          profile.level,
          STRATEGY_TO_SQL[profile.playstyle],
          profile.goal,
        ],
      );

      // Owned assets are a set, so replace rather than diff. The list is small
      // and this cannot drift out of sync the way an incremental update can.
      await client.query("DELETE FROM user_assets WHERE user_id = $1", [userId]);
      if (profile.ownedAssetIds.length > 0) {
        await client.query(
          `INSERT INTO user_assets (user_id, asset_id)
           SELECT $1, unnest($2::text[])
           ON CONFLICT DO NOTHING`,
          [userId, profile.ownedAssetIds],
        );
      }
    });
  },

  /* Money plans ---------------------------------------------------------- */

  async listPlans(userId) {
    const { rows } = await pool().query<{
      id: string;
      goal: string;
      starting_cash: string;
      strategy: string;
      summary: string;
      risks: string[];
      generated_by: string;
      created_at: Date;
    }>(
      `SELECT id, goal, starting_cash, strategy, summary, risks, generated_by, created_at
         FROM money_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );
    if (rows.length === 0) return [];

    const { rows: steps } = await pool().query<{
      plan_id: string;
      step_order: number;
      horizon: PlanHorizon;
      title: string;
      detail: string;
      kind: string;
      est_minutes: number;
      est_profit: string;
      required_cash: string;
      completed_at: Date | null;
    }>(
      `SELECT plan_id, step_order, horizon, title, detail, kind, est_minutes, est_profit,
              required_cash, completed_at
         FROM money_plan_steps
        WHERE plan_id = ANY($1::uuid[])
        ORDER BY step_order`,
      [rows.map((r) => r.id)],
    );

    return rows.map<MoneyPlan>((plan) => ({
      id: plan.id,
      objective: Number(plan.goal),
      startingCash: Number(plan.starting_cash),
      strategy: STRATEGY_FROM_SQL[plan.strategy] ?? "fastest-money",
      summary: plan.summary,
      risks: plan.risks ?? [],
      provenance: "ai-projection",
      generatedBy: plan.generated_by === "claude" ? "claude" : "heuristic",
      createdAt: plan.created_at.toISOString(),
      steps: steps
        .filter((s) => s.plan_id === plan.id)
        .map((s) => ({
          order: s.step_order,
          horizon: s.horizon,
          title: s.title,
          detail: s.detail,
          kind: s.kind as MoneyPlan["steps"][number]["kind"],
          estMinutes: s.est_minutes,
          estProfit: Number(s.est_profit),
          requiredCash: Number(s.required_cash),
          done: s.completed_at !== null,
        })),
    }));
  },

  async savePlan(userId, plan) {
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO money_plans
           (id, user_id, goal, starting_cash, strategy, summary, risks, status, generated_by, model_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)`,
        [
          plan.id,
          userId,
          plan.objective,
          plan.startingCash,
          STRATEGY_TO_SQL[plan.strategy],
          plan.summary,
          plan.risks,
          plan.generatedBy,
          plan.generatedBy === "claude" ? (process.env.ANTHROPIC_MODEL ?? "claude-opus-5") : null,
        ],
      );

      for (const step of plan.steps) {
        await client.query(
          `INSERT INTO money_plan_steps
             (plan_id, step_order, horizon, title, detail, kind, est_minutes, est_profit, required_cash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            plan.id,
            step.order,
            step.horizon,
            step.title,
            step.detail,
            step.kind,
            step.estMinutes,
            Math.round(step.estProfit),
            Math.round(step.requiredCash),
          ],
        );
      }
    });
  },

  async setStepDone(userId, planId, order, done) {
    // The join on user_id is the authorisation check. Without it, any signed-in
    // user could tick a step on somebody else's plan.
    await pool().query(
      `UPDATE money_plan_steps s
          SET completed_at = CASE WHEN $4 THEN now() ELSE NULL END
         FROM money_plans p
        WHERE s.plan_id = p.id
          AND p.id = $2
          AND p.user_id = $1
          AND s.step_order = $3`,
      [userId, planId, order, done],
    );
  },

  /* Usage and credits ---------------------------------------------------- */

  async bumpDailyQueries(userId) {
    const { rows } = await pool().query<{ queries: number }>(
      `INSERT INTO ai_usage_daily (user_id, usage_day, queries)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, usage_day)
       DO UPDATE SET queries = ai_usage_daily.queries + 1
       RETURNING queries`,
      [userId],
    );
    return rows[0]?.queries ?? 0;
  },

  async getDailyQueries(userId) {
    const { rows } = await pool().query<{ queries: number }>(
      "SELECT queries FROM ai_usage_daily WHERE user_id = $1 AND usage_day = CURRENT_DATE",
      [userId],
    );
    return rows[0]?.queries ?? 0;
  },

  async getCredits(userId) {
    const { rows } = await pool().query<{ balance: number }>(
      "SELECT balance FROM lab_credits WHERE user_id = $1",
      [userId],
    );
    return rows[0]?.balance ?? 0;
  },

  async spendCredits(userId, amount, reason) {
    return transaction(async (client) => {
      // FOR UPDATE holds the row for the length of the transaction. Without it
      // two concurrent requests both read the old balance and both succeed,
      // which hands out a free model call every time it happens.
      const { rows } = await client.query<{ balance: number }>(
        "SELECT balance FROM lab_credits WHERE user_id = $1 FOR UPDATE",
        [userId],
      );

      const balance = rows[0]?.balance ?? 0;
      if (balance < amount) return null;

      const { rows: updated } = await client.query<{ balance: number }>(
        "UPDATE lab_credits SET balance = balance - $2, updated_at = now() WHERE user_id = $1 RETURNING balance",
        [userId, amount],
      );

      await client.query(
        "INSERT INTO credit_transactions (user_id, amount, kind, description, reference) VALUES ($1, $2, $3, $4, $5)",
        [userId, -amount, CREDIT_KIND[reason], reason, reason],
      );

      return updated[0].balance;
    });
  },

  async grantCredits(userId, amount, reason) {
    return transaction(async (client) => {
      const { rows } = await client.query<{ balance: number }>(
        `INSERT INTO lab_credits (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
           SET balance = lab_credits.balance + EXCLUDED.balance, updated_at = now()
         RETURNING balance`,
        [userId, amount],
      );

      await client.query(
        "INSERT INTO credit_transactions (user_id, amount, kind, description) VALUES ($1, $2, $3, $4)",
        [userId, amount, CREDIT_KIND[reason], reason],
      );

      return rows[0].balance;
    });
  },

  /* Admin ---------------------------------------------------------------- */

  async countUsers() {
    const { rows } = await pool().query<{ plan: Tier; count: string }>(
      "SELECT plan, count(*)::text AS count FROM users WHERE deleted_at IS NULL GROUP BY plan",
    );

    const byTier: Record<Tier, number> = { free: 0, pro: 0, elite: 0 };
    let total = 0;
    for (const row of rows) {
      byTier[row.plan] = Number(row.count);
      total += Number(row.count);
    }
    return { total, byTier };
  },
};

/** Cheap connectivity check for a health endpoint or a startup log. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool().query("SELECT 1");
    return true;
  } catch (error) {
    console.warn("[postgres] ping failed", error);
    return false;
  }
}
