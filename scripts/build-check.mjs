/**
 * A production build that cannot disturb a running dev server.
 *
 * `next build` writes to .next, which is also where `next dev` keeps the
 * assets it is currently serving. Running both against the same directory
 * leaves the dev server serving a 404 for its own stylesheet: pages still
 * compile, requests still return 200, and every Tailwind class silently stops
 * applying. Nothing in either log says so.
 *
 * So verification builds go to .next-check instead. Nothing serves from there;
 * it exists to prove the build passes.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-check" },
});

process.exit(result.status ?? 1);
