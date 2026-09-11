/**
 * The dev server, backed by a real PostgreSQL on disk.
 *
 * `npm run dev` uses the in-memory store, which is fast and forgets everything
 * on restart. This uses PGlite — PostgreSQL compiled to WebAssembly — pointed
 * at .data/postgres, so accounts, plans and credits survive, and the app runs
 * against the same schema.sql and the same adapter production uses.
 *
 * Nothing to install and no account anywhere. Delete .data to start clean.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, LOCAL_DB: "1" },
});

process.exit(result.status ?? 1);
