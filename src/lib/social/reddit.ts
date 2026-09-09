import "server-only";

/**
 * Reddit feed.
 *
 * Reddit serves a public JSON view of any listing without authentication, so
 * this needs no key. Two rules it respects, both of which Reddit enforces:
 * a descriptive User-Agent, and no aggressive polling. Results are cached for
 * ten minutes.
 *
 * Only the post metadata is used. Post bodies and comments are not reproduced,
 * and every item links back to the thread on Reddit.
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

export const SUBREDDITS = ["GTA6", "GTA", "gtaonline"] as const;

const UA = "web:gta6-money-lab:0.1 (independent fan companion)";

export async function fetchReddit({
  subreddit = "GTA6",
  sort = "hot",
  limit = 12,
}: {
  subreddit?: string;
  sort?: "hot" | "new" | "top";
  limit?: number;
}): Promise<RedditPost[]> {
  // Reject anything that is not a plain subreddit name before it reaches a URL.
  if (!/^[A-Za-z0-9_]{2,24}$/.test(subreddit)) return [];

  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${Math.min(limit, 25)}&raw_json=1`;

  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA },
      next: { revalidate: 600 },
    });
    if (!response.ok) {
      console.warn("[reddit] listing failed", subreddit, response.status);
      return [];
    }

    const body = (await response.json()) as {
      data?: {
        children?: {
          data?: Record<string, unknown>;
        }[];
      };
    };

    return (body.data?.children ?? [])
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
          // Reddit uses these words in place of a URL for text posts.
          thumbnail: thumb.startsWith("http") ? thumb : null,
          flair: (d.link_flair_text as string | null) ?? null,
          isVideo: Boolean(d.is_video),
        };
      })
      .filter((post) => post.id && post.title);
  } catch (error) {
    console.warn("[reddit] fetch threw", error);
    return [];
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
