import "server-only";

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
