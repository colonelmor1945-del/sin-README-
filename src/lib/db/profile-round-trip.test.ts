import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { splitSql } from "@/lib/db/split-sql";

/**
 * A profile written and read back, against a real PostgreSQL.
 *
 * WHY THIS EXISTS
 * `completedMissionIds` was read out of `user_missions` and never written to
 * it. The in-memory store kept the list, so every test passed and every local
 * session behaved — and on a real database the answer was always an empty
 * array. The profile form lost the player's missions, and the plan generator,
 * which people pay for, was told they had completed nothing.
 *
 * A unit test against the memory adapter could not have caught that, because
 * the memory adapter was the half that worked. So this runs the real SQL from
 * `postgres.ts` against Postgres compiled to WebAssembly: same engine, same
 * statements, no Docker.
 */

const SCHEMA = readFileSync("src/lib/db/schema.sql", "utf8");

/** The two statements from `saveProfile`, verbatim in shape. */
const SAVE_ASSETS = `INSERT INTO user_assets (user_id, asset_id)
   SELECT $1, unnest($2::text[])
   ON CONFLICT DO NOTHING`;
const SAVE_MISSIONS = `INSERT INTO user_missions (user_id, mission_id)
   SELECT $1, m.id FROM missions m WHERE m.id = ANY($2::text[])
   ON CONFLICT DO NOTHING`;

let db: PGlite;
let userId: string;

beforeAll(async () => {
  db = new PGlite();
  for (const statement of splitSql(SCHEMA)) await db.query(statement);

  const user = await db.query<{ id: string }>(
    `INSERT INTO users (email, username, password_hash, auth_provider, auth_subject)
     VALUES ('mission@example.com', 'missionplayer', 'scrypt$fake', 'password', 'mission@example.com')
     RETURNING id`,
  );
  userId = user.rows[0].id;

  // Missions are a foreign key, so they have to exist before anyone completes
  // them. Two real ids and nothing else.
  await db.query(
    `INSERT INTO missions (id, name, strand, region, payout, duration_min, difficulty, provenance)
     VALUES ('m-one', 'One', 'solo', 'Vice City', 1000, 10, 2, 'community'),
            ('m-two', 'Two', 'solo', 'Vice City', 3000, 20, 3, 'community')`,
  );
}, 60_000);

async function saveMissions(ids: string[]) {
  await db.query("DELETE FROM user_missions WHERE user_id = $1", [userId]);
  if (ids.length > 0) await db.query(SAVE_MISSIONS, [userId, ids]);
}

async function readMissions(): Promise<string[]> {
  const result = await db.query<{ mission_id: string }>(
    "SELECT mission_id FROM user_missions WHERE user_id = $1 ORDER BY mission_id",
    [userId],
  );
  return result.rows.map((r) => r.mission_id);
}

describe("completed missions", () => {
  it("come back out after being written", async () => {
    await saveMissions(["m-one", "m-two"]);
    expect(await readMissions()).toEqual(["m-one", "m-two"]);
  });

  it("are replaced, not accumulated, when the profile is saved again", async () => {
    await saveMissions(["m-one", "m-two"]);
    await saveMissions(["m-two"]);
    expect(await readMissions()).toEqual(["m-two"]);
  });

  it("can be cleared", async () => {
    await saveMissions(["m-one"]);
    await saveMissions([]);
    expect(await readMissions()).toEqual([]);
  });

  it("survive a duplicate in the same save", async () => {
    // The form could send the same id twice. ON CONFLICT DO NOTHING plus the
    // UNIQUE (user_id, mission_id) constraint is what makes that harmless.
    await saveMissions(["m-one", "m-one"]);
    expect(await readMissions()).toEqual(["m-one"]);
  });

  it("ignore a mission that no longer exists instead of losing the whole save", async () => {
    // This is why the insert selects through `missions` rather than inserting
    // the array directly. A deleted mission still named in somebody's profile
    // would otherwise fail the transaction and take their money and level
    // down with it.
    await saveMissions(["m-one", "m-deleted-last-week"]);
    expect(await readMissions()).toEqual(["m-one"]);
  });

  it("are indexed by user, because every profile read filters on it", async () => {
    const result = await db.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'user_missions'",
    );
    const defs = result.rows.map((r) => r.indexdef).join("\n");
    expect(defs).toMatch(/\(user_id/);
  });

  it("do the same for owned assets, which share the pattern", async () => {
    await db.query(
      `INSERT INTO assets (id, name, kind, region, price, provenance)
       VALUES ('a-one', 'One', 'business', 'Vice City', 1000, 'community')`,
    );
    await db.query("DELETE FROM user_assets WHERE user_id = $1", [userId]);
    await db.query(SAVE_ASSETS, [userId, ["a-one"]]);
    const result = await db.query<{ asset_id: string }>(
      "SELECT asset_id FROM user_assets WHERE user_id = $1",
      [userId],
    );
    expect(result.rows.map((r) => r.asset_id)).toEqual(["a-one"]);
  });
});
