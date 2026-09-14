import type { RedditThread } from "./reddit";

/**
 * A thread that never existed, for looking at the thread screen.
 *
 * The Reddit panels report "not connected" rather than showing placeholder
 * posts, which is the right call in the product and an awkward one while
 * building: without credentials there is no way to see the layout at all.
 * This fills that gap without weakening the rule. It is reachable only at
 * /dashboard/feed/thread/sample, only outside production, and the page says
 * on screen that it is invented.
 *
 * The content is deliberately shaped like the awkward cases rather than the
 * happy one: a long body, a deep reply chain, a removed comment mid-thread,
 * a one-word reply and a very long unbroken token, because those are what
 * break a layout.
 */
export const SAMPLE_THREAD: RedditThread = {
  id: "sample",
  title: "Ran the port job 12 times and timed every one. Numbers inside.",
  author: "vice_runner",
  subreddit: "GTA6",
  score: 1247,
  commentCount: 38,
  createdAt: 0, // Filled in at read time so the timestamps stay believable.
  permalink: "https://www.reddit.com/r/GTA6/",
  body: `Got tired of guides quoting payouts with no time attached, so I ran the same job twelve times and timed every one from load-in to payout.

Average was 19m40s for $148k. Worst run was 26 minutes because I lost the truck on the bridge and had to restart the chase. Best was 16m02s.

That works out to roughly $451k/hour if nothing goes wrong, and about $340k/hour if you assume one bad run in five, which matches what I actually got over the twelve.

Caveat: I am playing solo. No idea how this changes with a crew.`,
  flair: "Discussion",
  image: null,
  linkUrl: null,
  comments: [
    {
      id: "s1",
      author: "portside_mike",
      body: "This matches my numbers almost exactly. I had 19m10s over nine runs. The bridge chase is the whole variance — if you take the tunnel instead it basically never goes wrong.",
      score: 284,
      createdAt: 0,
      depth: 0,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: false,
    },
    {
      id: "s2",
      author: "vice_runner",
      body: "Tunnel is slower on paper but if it removes the restart risk it wins. Going to time that next.",
      score: 96,
      createdAt: 0,
      depth: 1,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: true,
      removed: false,
    },
    {
      id: "s3",
      author: "portside_mike",
      body: "Post them when you do.",
      score: 31,
      createdAt: 0,
      depth: 2,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: false,
    },
    {
      id: "s4",
      author: "[deleted]",
      body: "[removed]",
      score: 0,
      createdAt: 0,
      depth: 0,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: true,
    },
    {
      id: "s5",
      author: "econ_nerd",
      body: "Replying to the removed one above: they were quoting a site that just multiplies the payout by three and calls it an hourly rate. Worth ignoring entirely.",
      score: 142,
      createdAt: 0,
      depth: 1,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: false,
    },
    {
      id: "s6",
      author: "leafy",
      body: "Source?",
      score: 4,
      createdAt: 0,
      depth: 0,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: false,
    },
    {
      id: "s7",
      author: "econ_nerd",
      body: "Their own methodology page: https://example.invalid/methodology/hourly-rates-explained-in-detail-with-sources-and-notes",
      score: 18,
      createdAt: 0,
      depth: 1,
      permalink: "https://www.reddit.com/r/GTA6/",
      isOp: false,
      removed: false,
    },
  ],
};

/** Minutes ago, per comment, so the thread reads as a conversation over time. */
const AGES_MIN = [0, 190, 170, 150, 140, 120, 95, 60];

/** Stamped at read time: a fixture with frozen dates reads as broken. */
export function sampleThread(now = Date.now()): RedditThread {
  return {
    ...SAMPLE_THREAD,
    createdAt: now - AGES_MIN[0] * 60_000 - 4 * 3_600_000,
    comments: SAMPLE_THREAD.comments.map((comment, i) => ({
      ...comment,
      createdAt: now - (AGES_MIN[i + 1] ?? 30) * 60_000,
    })),
  };
}
