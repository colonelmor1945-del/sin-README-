import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { splitSql } from "@/lib/db/split-sql";

/**
 * Applies the real schema to a real PostgreSQL.
 *
 * PGlite is Postgres compiled to WebAssembly, so this is the actual engine
 * parsing the actual file, not a regex pretending to understand SQL. It needs
 * no Docker and no server, which matters because the point of these tests is
 * that anyone who clones this repo can run them.
 *
 * WHAT THIS IS PROTECTING
 * Someone setting this up for the first time runs schema.sql against a
 * database they just created, on a connection that may drop, from a machine
 * that may not have psql. If that run fails half way and the file cannot
 * simply be run again, they are left with a partly built database and an error
 * about a type that already exists, and the honest fix at that point is to
 * drop everything and start over. So: it must be runnable twice.
 */

const SCHEMA = readFileSync("src/lib/db/schema.sql", "utf8");

/**
 * Runs the script one statement at a time.
 *
 * Not db.exec(SCHEMA): that splits on semicolons, which cuts the dollar-quoted
 * DO blocks in half and fails with a syntax error on a bare "$". The blocks
 * themselves are fine, and PGlite runs one happily on its own. Feeding
 * statements in individually also means a failure names the statement that
 * failed rather than the file.
 */
async function apply(db: PGlite, sql: string): Promise<void> {
  for (const statement of splitSql(sql)) {
    try {
      await db.query(statement);
    } catch (error) {
      throw new Error(
        `failed on: ${statement.slice(0, 90).replace(/\s+/g, " ")}
  ${String(error)}`,
      );
    }
  }
}

/** Tables the application reads or writes by name. */
const CORE_TABLES = [
  "users",
  "sessions",
  "missions",
  "assets",
  "asset_prices",
  "map_locations",
  "money_plans",
  "money_plan_steps",
  "payments",
  "payment_events",
  "crypto_payments",
  "lab_credits",
  "credit_transactions",
  "audit_log",
];

describe("schema.sql", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await apply(db, SCHEMA);
  }, 120_000);

  it("applies to an empty database", async () => {
    const { rows } = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM information_schema.tables
        WHERE table_schema = 'public'`,
    );
    // If the file had failed, beforeAll would have thrown. This asserts it
    // actually built something rather than succeeding at doing nothing.
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(CORE_TABLES.length);
  });

  it("creates every table the application addresses by name", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const present = new Set(rows.map((r) => r.table_name));

    for (const table of CORE_TABLES) {
      expect(present, `missing table: ${table}`).toContain(table);
    }
  });

  it("can be applied a second time without failing", async () => {
    // The whole reason every statement carries a guard. A first-time setup that
    // dies part way has to be resumable by re-running the same file.
    await expect(apply(db, SCHEMA)).resolves.toBeUndefined();
  }, 120_000);

  it("still enforces the provenance values, so a guard did not weaken a type", async () => {
    // Making things idempotent is exactly the kind of edit that can quietly
    // turn a constrained column into a free text one. The database is supposed
    // to be what makes an unlabelled figure impossible to store.
    const { rows } = await db.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'provenance' ORDER BY e.enumsortorder`,
    );

    // 'unverified' is appended rather than inserted: ALTER TYPE ADD VALUE with
    // no BEFORE/AFTER puts it last, and enumsortorder is sort order, not
    // confidence order. Confidence order lives in RANK in lib/provenance.ts,
    // where 'unverified' is the weakest. (ADR-027.)
    expect(rows.map((r) => r.enumlabel)).toEqual([
      "verified",
      "community",
      "estimated",
      "ai_projection",
      "unverified",
    ]);
  });

  it("rejects a provenance value outside that set", async () => {
    await expect(
      db.query(
        `INSERT INTO missions (id, name, strand, region, payout, duration_min,
                               difficulty, crew_required, best_strategy, provenance)
         VALUES ('t', 'T', 's', 'r', 1, 1, 1, 1, 'x', 'rumour')`,
      ),
    ).rejects.toThrow();
  });

  it("stores money as an integer type, never a float", async () => {
    // A float payout is a rounding error waiting to be shown to someone as a
    // number they will act on.
    const { rows } = await db.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name LIKE '%payout%' OR column_name LIKE '%price%'
               OR column_name LIKE '%_net' OR column_name LIKE '%amount%')`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const { column_name, data_type } of rows) {
      expect(
        ["bigint", "integer", "numeric", "smallint"],
        `${column_name} is ${data_type}`,
      ).toContain(data_type);
    }
  });
});
