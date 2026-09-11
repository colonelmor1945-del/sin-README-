import "server-only";

import { readFileSync } from "node:fs";

import { splitSql } from "@/lib/db/split-sql";

/**
 * A real PostgreSQL, on disk, with nothing to install.
 *
 * PGlite is PostgreSQL compiled to WebAssembly. Pointed at a directory it
 * persists, so a local checkout gets accounts that survive a restart, real
 * transactions, real foreign keys and the real CHECK constraints — running the
 * same schema.sql that production runs.
 *
 * WHY THIS RATHER THAN THE IN-MEMORY STORE
 * The memory store is a set of Maps. It cannot fail the way Postgres fails, so
 * a query that violates a constraint, deadlocks, or returns rows in a
 * different order is a bug that only ever appears in production. This closes
 * that gap for the cost of a second of startup.
 *
 * WHY THIS RATHER THAN ASKING EVERYONE FOR A NEON URL
 * Because then everyone needs an account, a password manager entry and a
 * network connection to run the app at all, and the first thing a new
 * contributor hits is a signup form for a third party.
 *
 * IT IS NOT A DEPLOYMENT TARGET
 * Single process, single connection, a file in the working tree. Production
 * still requires DATABASE_URL and still refuses to start without it.
 */

/** The shape src/lib/db/postgres.ts actually uses. Far smaller than pg's Pool. */
export interface PgLike {
  query<R = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
  connect(): Promise<PgClientLike>;
}

export interface PgClientLike {
  query<R = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
  release(): void;
}

/**
 * Where the database lives. Ignored by git; delete it to start clean.
 *
 * Read when the database is opened rather than when this module is loaded,
 * because a test that sets it in a hook would otherwise be too late: the
 * module has already been imported by then, through the store.
 *
 * "memory://" gives a real PostgreSQL that leaves nothing behind, which is
 * what the tests use.
 */
function dataDir(): string {
  return process.env.LOCAL_DB_DIR ?? ".data/postgres";
}

/**
 * Opt in, with LOCAL_DB=1. `npm run dev:db` sets it.
 *
 * Deliberately not enabled by the absence of DATABASE_URL alone. A deployment
 * that has lost its connection string must fail loudly, not quietly start
 * writing accounts into a file in its own container that disappears on the
 * next deploy — which is the worse version of the problem this solves.
 *
 * Opt in rather than default because it costs a second of startup and writes
 * to the working tree, and `npm run dev` should stay the fastest possible way
 * to look at the product.
 */
export function localDbEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.DATABASE_URL) return false;
  return env.LOCAL_DB === "1";
}

const g = globalThis as { __localPg?: Promise<PgLike> };

export function localPool(): Promise<PgLike> {
  // The dev server re-evaluates modules on hot reload. Without this, each
  // reload opens the same directory again and the second one fails on a lock.
  g.__localPg ??= boot();
  return g.__localPg;
}

async function boot(): Promise<PgLike> {
  // Imported here rather than at the top so the WebAssembly build is never
  // pulled into a production bundle. It is a devDependency; a production
  // install does not even have it on disk.
  const { PGlite } = await import("@electric-sql/pglite");

  const dir = dataDir();

  // PGlite creates its own directory but not the parent, so on a fresh
  // checkout, where .data does not exist yet, it fails with an ENOENT from
  // mkdir. Making the whole path first is the entire fix, and without it the
  // very first run of npm run dev:db crashes.
  if (!dir.includes("://")) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
  }

  const db = await PGlite.create(dir);

  await applySchema(db);
  await seedAccount(db);

  const wrap = async <R>(text: string, values?: unknown[]) => {
    const result = await db.query<R>(text, values as unknown[] | undefined);
    return {
      rows: result.rows,
      // pg calls it rowCount, PGlite calls it affectedRows, and the adapter
      // reads rowCount to decide whether a row existed.
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };

  const client: PgClientLike = {
    query: wrap,
    // One connection, so there is nothing to give back. Kept so the adapter's
    // try/finally reads the same against both backends.
    release: () => {},
  };

  return {
    query: wrap,
    connect: async () => client,
  };
}

/**
 * Creates the development account, once, and then never again.
 *
 * Unlike the in-memory seed this one persists, so it is created on the first
 * run against an empty directory and left alone afterwards. If you change its
 * password in a running database it stays changed, which is correct: it is a
 * real row now, not a fixture regenerated on every boot.
 *
 * It is the first account, so it takes the admin role.
 */
async function seedAccount(db: {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}): Promise<void> {
  const { DEV_ACCOUNT, devSeedAllowed } = await import("@/lib/db/seed-dev-account");
  if (!devSeedAllowed()) return;

  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [
    DEV_ACCOUNT.email,
  ]);
  if (existing.rows.length > 0) return;

  const { hashPassword } = await import("@/lib/auth/password");

  await db.query(
    `INSERT INTO users (email, username, auth_provider, auth_subject, role, password_hash)
     VALUES ($1, $2, 'password', $1, 'admin', $3)`,
    [DEV_ACCOUNT.email, DEV_ACCOUNT.username, await hashPassword(DEV_ACCOUNT.password)],
  );

  console.log(
    [
      "",
      "  Development account created",
      `    ${DEV_ACCOUNT.email}`,
      `    ${DEV_ACCOUNT.password}`,
      `  Admin. Stored in ${dataDir()}, so it survives restarts.`,
      "",
    ].join("\n"),
  );
}

/**
 * Applies schema.sql, every time, because it is written to be safe to reapply.
 *
 * That is what makes this work without a migration step: a checkout that is
 * three schema changes behind picks up the missing tables on the next start.
 * It does not alter existing tables — the file only ever creates what is
 * absent — so a changed column still needs a real migration.
 */
async function applySchema(db: {
  query: (text: string) => Promise<unknown>;
}): Promise<void> {
  const sql = readFileSync("src/lib/db/schema.sql", "utf8");

  for (const statement of splitSql(sql)) {
    try {
      await db.query(statement);
    } catch (error) {
      throw new Error(
        `local database: failed on "${statement.slice(0, 80).replace(/\s+/g, " ")}"\n  ${String(error)}`,
      );
    }
  }
}
