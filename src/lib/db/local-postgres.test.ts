import { beforeAll, describe, expect, it } from "vitest";

import { localDbEnabled } from "@/lib/db/local-postgres";

/**
 * Boots the local database the way the dev server does.
 *
 * This is the test that would have caught the thing a browser check could not:
 * loading a page proves nothing here, because the landing page and the sign-in
 * page never read the store, and /dashboard is redirected by middleware before
 * it gets that far. The database was not being opened at all and every request
 * still returned 200.
 */
describe("localDbEnabled", () => {
  it("is off unless asked for", () => {
    expect(localDbEnabled({})).toBe(false);
    expect(localDbEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("is on with LOCAL_DB=1", () => {
    expect(localDbEnabled({ LOCAL_DB: "1" })).toBe(true);
  });

  it("refuses in production, however it is asked", () => {
    expect(localDbEnabled({ LOCAL_DB: "1", NODE_ENV: "production" })).toBe(false);
  });

  it("stands aside for a real database", () => {
    // A deployment that has lost its connection string has to fail loudly,
    // not quietly start writing accounts into a file in its own container.
    expect(
      localDbEnabled({ LOCAL_DB: "1", DATABASE_URL: "postgres://host/db" }),
    ).toBe(false);
  });
});

describe("the local database", () => {
  let pool: Awaited<ReturnType<typeof import("@/lib/db/local-postgres").localPool>>;

  beforeAll(async () => {
    process.env.LOCAL_DB = "1";
    // A real PostgreSQL that leaves nothing on disk.
    process.env.LOCAL_DB_DIR = "memory://";

    const { localPool } = await import("@/lib/db/local-postgres");
    pool = await localPool();
  }, 120_000);

  it("applies the schema on first boot", async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = rows.map((r) => r.table_name);

    expect(names).toContain("users");
    expect(names).toContain("payments");
    expect(names).toContain("money_plans");
  });

  it("seeds the development account as an admin", async () => {
    const { DEV_ACCOUNT } = await import("@/lib/db/seed-dev-account");

    const { rows } = await pool.query<{
      email: string;
      role: string;
      password_hash: string | null;
    }>("SELECT email, role, password_hash FROM users WHERE email = $1", [
      DEV_ACCOUNT.email,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
    // Stored as a scrypt hash, never as the password itself.
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain(DEV_ACCOUNT.password);
  });

  it("gives back a usable rowCount, which pg has and PGlite calls something else", async () => {
    const { rowCount } = await pool.query("SELECT 1 FROM users WHERE email = $1", [
      "nobody@example.invalid",
    ]);
    expect(rowCount).toBe(0);
  });

  it("supports transactions through connect(), which the adapter relies on", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO users (email, username, auth_provider, auth_subject)
         VALUES ('rollback@moneylab.local', 'rollbackme', 'password', 'rollback@moneylab.local')`,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const { rows } = await pool.query("SELECT 1 FROM users WHERE email = $1", [
      "rollback@moneylab.local",
    ]);
    // The in-memory store cannot fail this test, because it has no
    // transactions to get wrong. That is the whole reason for running the real
    // engine locally.
    expect(rows).toHaveLength(0);
  });

  it("enforces the constraints the schema declares", async () => {
    // The email CHECK, which replaced CITEXT. A store built out of Maps would
    // have accepted this happily.
    await expect(
      pool.query(
        `INSERT INTO users (email, username, auth_provider, auth_subject)
         VALUES ('Mixed@Case.local', 'mixedcase', 'password', 'x')`,
      ),
    ).rejects.toThrow();
  });
});
