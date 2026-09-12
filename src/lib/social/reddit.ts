import "server-only";

import { cached } from "./cache";

/**
 * Reddit feed.
 *
 * Originally written against the public .json listings. Those now answer 403
 * for unauthenticated server-side requests: Reddit closed that route after the
 * 2023 API changes and it only still works from a browser with a residential
 * IP. Anything built on it looks fine in local testing and returns nothing the
 * moment it is deployed.
 *
 * So this talks to the real API. Register an app at
 * https://www.reddit.com/prefs/apps as type "script", then set
 * REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. It is free.
 *
 * Only post metadata is used. Bodies and comments are not reproduced, and
 * every item links back to the thread.
 */

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  comments: number;
  createdAt: number;
  permalink: string;
  thumbnail: string | null;
  flair: string | null;
  isVideo: boolean;
}

export interface RedditFeed {
  posts: RedditPost[];
  /** No credentials set. The UI explains rather than showing an empty list. */
  unconfigured: boolean;
  /** Credentials exist but Reddit refused. Different problem, different fix. */
  failed: boolean;
}

export const SUBREDDITS = ["GTA6", "GTA", "gtaonline"] as const;

const UA = "web:gta6-money-lab:0.1 (independent fan companion)";

/** Ten minutes. A hot listing does not reorder faster than a reader reads. */
const LISTING_TTL_MS = 10 * 60_000;

/**
 * Application-only token, cached in module scope.
 *
 * Reddit issues these for an hour. Requesting one per page view would burn the
 * rate limit for no reason, so the token is held and refreshed a minute early.
 */
interface CachedToken {
  value: string;
  expiresAt: number;
}

const g = globalThis as { __redditToken?: CachedToken };

async function accessToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  const cached = g.__redditToken;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": UA,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[reddit] token request failed", response.status);
      return null;
    }

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) return null;

    g.__redditToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000,
    };
    return body.access_token;
  } catch (error) {
    console.warn("[reddit] token request threw", error);
    return null;
  }
}

export async function fetchReddit({
  subreddit = "GTA6",
  sort = "hot",
  limit = 12,
}: {
  subreddit?: string;
  sort?: "hot" | "new" | "top";
  limit?: number;
}): Promise<RedditFeed> {
  // Reject anything that is not a plain subreddit name before it reaches a URL.
  if (!/^[A-Za-z0-9_]{2,24}$/.test(subreddit)) {
    return { posts: [], unconfigured: false, failed: true };
  }

  const token = await accessToken();
  if (!token) return { posts: [], unconfigured: true, failed: false };

  return cached(
    `reddit:listing:${subreddit}:${sort}:${limit}`,
    LISTING_TTL_MS,
    () => loadListing(subreddit, sort, limit, token),
  );
}

async function loadListing(
  subreddit: string,
  sort: string,
  limit: number,
  token: string,
): Promise<RedditFeed> {
  try {
    const response = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/${sort}?limit=${Math.min(limit, 25)}&raw_json=1`,
      {
        headers: { authorization: `Bearer ${token}`, "user-agent": UA },
        next: { revalidate: 600 },
      },
    );

    if (!response.ok) {
      console.warn("[reddit] listing failed", subreddit, response.status);
      return { posts: [], unconfigured: false, failed: true };
    }

    const body = (await response.json()) as {
      data?: { children?: { data?: Record<string, unknown> }[] };
    };

    const posts = (body.data?.children ?? [])
      .map((child) => child.data)
      .filter((d): d is Record<string, unknown> => Boolean(d))
      .filter((d) => !d.stickied)
      .map((d) => {
        const thumb = typeof d.thumbnail === "string" ? d.thumbnail : "";
        return {
          id: String(d.id ?? ""),
          title: String(d.title ?? ""),
          author: String(d.author ?? "unknown"),
          subreddit: String(d.subreddit ?? subreddit),
          score: Number(d.score ?? 0),
          comments: Number(d.num_comments ?? 0),
          createdAt: Number(d.created_utc ?? 0) * 1000,
          permalink: `https://www.reddit.com${String(d.permalink ?? "")}`,
          // Reddit puts words like "self" and "default" here for text posts.
          thumbnail: thumb.startsWith("http") ? thumb : null,
          flair: (d.link_flair_text as string | null) ?? null,
          isVideo: Boolean(d.is_video),
        };
      })
      .filter((post) => post.id && post.title);

    return { posts, unconfigured: false, failed: false };
  } catch (error) {
    console.warn("[reddit] fetch threw", error);
    return { posts: [], unconfigured: false, failed: true };
  }
}

/** Relative time, so the feed reads as live without a client-side clock. */
export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* Threads ---------------------------------------------------------------- */

/**
 * A single comment, already flattened.
 *
 * Reddit nests replies arbitrarily deep. Rendering that faithfully on a phone
 * produces a column six words wide, so the tree is flattened to a `depth`
 * number that the UI caps when it indents. The shape stays a list, which is
 * also what makes it trivial to test.
 */
export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdAt: number;
  depth: number;
  permalink: string;
  /** Posted by the author of the thread itself. Worth marking in the UI. */
  isOp: boolean;
  /** Reddit keeps removed comments in the tree with a tombstone body. */
  removed: boolean;
}

export interface RedditThread {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  commentCount: number;
  createdAt: number;
  permalink: string;
  /** Markdown as Reddit stores it. Rendered as plain text, never as HTML. */
  body: string;
  flair: string | null;
  /** Direct image URL for an image post, so the thread reads without leaving. */
  image: string | null;
  /** A link post points somewhere else; that destination belongs on screen. */
  linkUrl: string | null;
  comments: RedditComment[];
}

export interface RedditThreadResult {
  thread: RedditThread | null;
  unconfigured: boolean;
  failed: boolean;
  /** The id looked well formed but Reddit has nothing under it. */
  missing: boolean;
}

/** Reddit ids are base36. Anything else must not reach a URL. */
const THREAD_ID = /^[a-z0-9]{4,12}$/;

const MAX_DEPTH = 6;

/**
 * Five minutes.
 *
 * This is the honest number: it is the widest window in which the app can be
 * showing a comment its author has already deleted on Reddit. A short TTL
 * bounds that exposure, it does not remove it.
 */
const THREAD_TTL_MS = 5 * 60_000;

/** Bodies Reddit leaves behind when a comment is deleted or removed. */
function isTombstone(body: string): boolean {
  return body === "[deleted]" || body === "[removed]";
}

function walkComments(
  children: unknown[],
  op: string,
  depth: number,
  out: RedditComment[],
  limit: number,
): void {
  for (const child of children) {
    if (out.length >= limit) return;

    const node = child as { kind?: string; data?: Record<string, unknown> };
    // "more" is Reddit's load-more stub, not a comment. It has no body.
    if (node.kind !== "t1" || !node.data) continue;

    const d = node.data;
    const body = String(d.body ?? "");
    const id = String(d.id ?? "");
    if (!id) continue;

    out.push({
      id,
      author: String(d.author ?? "unknown"),
      body,
      score: Number(d.score ?? 0),
      createdAt: Number(d.created_utc ?? 0) * 1000,
      depth: Math.min(depth, MAX_DEPTH),
      permalink: `https://www.reddit.com${String(d.permalink ?? "")}`,
      isOp: String(d.author ?? "") === op && op !== "",
      removed: isTombstone(body),
    });

    const replies = d.replies as
      | { data?: { children?: unknown[] } }
      | string
      | undefined;
    // Reddit sends "" rather than an empty object when there are no replies.
    if (replies && typeof replies !== "string" && replies.data?.children) {
      walkComments(replies.data.children, op, depth + 1, out, limit);
    }
  }
}

/**
 * One thread, with its comments.
 *
 * The listing endpoint gives titles and scores; this is the only call that
 * returns bodies, so it is the only place the app reproduces what somebody
 * else wrote. Every comment keeps its author and its own permalink, and the
 * UI links back to the thread, which is what Reddit's terms ask for.
 */
export async function fetchThread({
  id,
  sort = "top",
  limit = 60,
}: {
  id: string;
  sort?: "top" | "new" | "confidence";
  limit?: number;
}): Promise<RedditThreadResult> {
  if (!THREAD_ID.test(id)) {
    return { thread: null, unconfigured: false, failed: false, missing: true };
  }

  const token = await accessToken();
  if (!token) {
    return { thread: null, unconfigured: true, failed: false, missing: false };
  }

  // Sort is part of the key: "top" and "new" are different answers.
  return cached(`reddit:thread:${id}:${sort}`, THREAD_TTL_MS, () =>
    loadThread(id, sort, limit, token),
  );
}

async function loadThread(
  id: string,
  sort: string,
  limit: number,
  token: string,
): Promise<RedditThreadResult> {
  try {
    const response = await fetch(
      `https://oauth.reddit.com/comments/${id}?sort=${sort}&limit=${Math.min(limit, 100)}&depth=${MAX_DEPTH}&raw_json=1`,
      {
        headers: { authorization: `Bearer ${token}`, "user-agent": UA },
        next: { revalidate: 300 },
      },
    );

    if (response.status === 404) {
      return { thread: null, unconfigured: false, failed: false, missing: true };
    }

    if (!response.ok) {
      console.warn("[reddit] thread failed", id, response.status);
      return { thread: null, unconfigured: false, failed: true, missing: false };
    }

    const body = await response.json();
    const thread = parseThread(body, id);
    if (!thread) {
      return { thread: null, unconfigured: false, failed: false, missing: true };
    }

    return { thread, unconfigured: false, failed: false, missing: false };
  } catch (error) {
    console.warn("[reddit] thread threw", error);
    return { thread: null, unconfigured: false, failed: true, missing: false };
  }
}

/**
 * Split out from the fetch so the parsing can be tested without a network.
 *
 * Reddit answers a comments call with a two-element array: the post on its
 * own, then the comment forest.
 */
export function parseThread(payload: unknown, id: string): RedditThread | null {
  if (!Array.isArray(payload) || payload.length < 1) return null;

  const postListing = payload[0] as {
    data?: { children?: { data?: Record<string, unknown> }[] };
  };
  const post = postListing?.data?.children?.[0]?.data;
  if (!post || !post.title) return null;

  const author = String(post.author ?? "unknown");
  const url = typeof post.url === "string" ? post.url : "";
  const isSelf = Boolean(post.is_self);

  const comments: RedditComment[] = [];
  const commentListing = payload[1] as {
    data?: { children?: unknown[] };
  } | undefined;
  if (commentListing?.data?.children) {
    walkComments(commentListing.data.children, author, 0, comments, 200);
  }

  return {
    id: String(post.id ?? id),
    title: String(post.title),
    author,
    subreddit: String(post.subreddit ?? ""),
    score: Number(post.score ?? 0),
    commentCount: Number(post.num_comments ?? 0),
    createdAt: Number(post.created_utc ?? 0) * 1000,
    permalink: `https://www.reddit.com${String(post.permalink ?? "")}`,
    body: String(post.selftext ?? ""),
    flair: (post.link_flair_text as string | null) ?? null,
    image: !isSelf && /\.(jpg|jpeg|png|gif|webp)$/i.test(url) ? url : null,
    linkUrl: !isSelf && url && !/\.(jpg|jpeg|png|gif|webp)$/i.test(url) ? url : null,
    comments,
  };
}
