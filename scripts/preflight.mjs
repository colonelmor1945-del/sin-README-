/**
 * Says whether this environment can be deployed, and what each gap costs.
 *
 * Run with `npm run preflight`, locally or as a deploy step.
 *
 * WHY THIS EXISTS
 * Most of this app degrades on purpose: without an AI key it runs the
 * deterministic planner, without a YouTube key the video feed falls back to
 * the Rockstar channel. Each of those is a deliberate design decision and none
 * of them is an error. The result is that a half-configured deployment looks
 * like a working one until somebody tries the specific thing that is missing.
 *
 * So this separates the two categories that actually matter: what stops the
 * app booting, and what quietly makes it less than it should be. Only the
 * first kind fails the check.
 */

const RED = "[31m";
const YELLOW = "[33m";
const GREEN = "[32m";
const DIM = "[2m";
const OFF = "[0m";

const set = (name) => {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "";
};

/**
 * Blockers. Production will not run, or will run in a way that loses data.
 */
const REQUIRED = [
  {
    name: "DATABASE_URL",
    why: "The in-memory store loses every account on restart, so production refuses to start without this. Free tier at neon.tech or supabase.com. Apply src/lib/db/schema.sql once.",
  },
  {
    name: "APP_URL",
    why: "The public origin. OAuth redirects, canonical URLs, the sitemap and robots.txt all build from it. Wrong here means a sitemap full of localhost, which is worse than no sitemap.",
    // A value that is set but still points at localhost is not configured.
    invalid: (v) => /localhost|127\.0\.0\.1/.test(v),
    invalidWhy: "still points at localhost",
  },
];

/**
 * Optional. Each one names the feature that stays switched off without it, so
 * the output is a list of consequences rather than a list of variables.
 */
const OPTIONAL = [
  ["ANTHROPIC_API_KEY", "The assistant and plan generator run the deterministic heuristic planner instead of Claude."],
  ["YOUTUBE_API_KEY", "The video feed falls back to the official Rockstar channel feed instead of searching all of YouTube."],
  ["GOOGLE_CLIENT_ID", "No “Continue with Google” on the sign-in screens."],
  ["GOOGLE_CLIENT_SECRET", "Same as above. Both halves are needed."],
  ["REDDIT_CLIENT_ID", "The Reddit panel in the community feed stays empty."],
  ["REDDIT_CLIENT_SECRET", "Same as above."],
  ["NEXT_PUBLIC_DISCORD_INVITE", "No Discord widget in the footer."],
  ["DISCORD_GUILD_ID", "No live Discord member count."],
  ["NEXT_PUBLIC_SPOTIFY_PLAYLIST_ID", "No Spotify playlist embed."],
  ["CRON_SECRET", "Scheduled ingestion refuses to run. The endpoint stays closed rather than defaulting to open, which is the right failure but it does mean no automatic updates."],
];

console.log("\nGTA 6 Money Lab — deployment preflight\n");

let blocked = 0;

console.log("Required");
for (const { name, why, invalid, invalidWhy } of REQUIRED) {
  const value = process.env[name];

  if (!set(name)) {
    console.log(`  ${RED}✗${OFF} ${name} ${DIM}not set${OFF}`);
    console.log(`      ${DIM}${why}${OFF}`);
    blocked++;
    continue;
  }

  if (invalid?.(value)) {
    console.log(`  ${RED}✗${OFF} ${name} ${DIM}${invalidWhy}${OFF}`);
    console.log(`      ${DIM}${why}${OFF}`);
    blocked++;
    continue;
  }

  console.log(`  ${GREEN}✓${OFF} ${name}`);
}

console.log("\nOptional");
let off = 0;
for (const [name, consequence] of OPTIONAL) {
  if (set(name)) {
    console.log(`  ${GREEN}✓${OFF} ${name}`);
    continue;
  }
  console.log(`  ${YELLOW}○${OFF} ${name}`);
  console.log(`      ${DIM}${consequence}${OFF}`);
  off++;
}

console.log("");

if (blocked > 0) {
  console.log(
    `${RED}Not deployable.${OFF} ${blocked} required ${blocked === 1 ? "value is" : "values are"} missing or wrong.\n`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}Deployable.${OFF}${off > 0 ? ` ${off} optional ${off === 1 ? "feature is" : "features are"} switched off — see above.` : ""}\n`,
);
