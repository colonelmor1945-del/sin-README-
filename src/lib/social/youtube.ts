import "server-only";

/**
 * YouTube Shorts feed.
 *
 * Uses the official YouTube Data API v3 search endpoint and the official
 * privacy-enhanced embed player. Both are supported, documented surfaces.
 *
 * WHY NOT THE SAME FOR TIKTOK AND INSTAGRAM
 * Neither platform exposes a public API for browsing videos by topic. TikTok's
 * Display API and Instagram's oEmbed both require an approved app and both are
 * scoped to content the authenticated user owns or to individual known URLs.
 * An "infinite feed of GTA 6 TikToks" can only be built by scraping, which
 * breaks their terms and is the kind of thing that gets an app blocked. So
 * this file covers YouTube, and TikTok and Reels are handled as curated
 * embeds of specific posts we choose.
 *
 * Quota note: search.list costs 100 units against a default 10,000 unit daily
 * quota, so roughly 100 searches a day. Results are cached for an hour, which
 * keeps a busy day inside the free tier.
 */

import type { Short, ShortsPage } from "@/lib/social/types";
export type { Short, ShortsPage };

const SEARCH = "https://www.googleapis.com/youtube/v3/search";

export { SHORT_QUERIES } from "@/lib/social/queries";
import { SHORT_QUERIES as QUERIES } from "@/lib/social/queries";

export async function fetchShorts({
  query = QUERIES[0],
  pageToken,
}: {
  query?: string;
  pageToken?: string;
}): Promise<ShortsPage> {
  const key = process.env.YOUTUBE_API_KEY;

  // No key, no invented content. The UI renders an explanation instead.
  if (!key) return { items: [], nextPageToken: null, unconfigured: true };

  const url = new URL(SEARCH);
  url.searchParams.set("key", key);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  // The API has no Shorts filter. Short duration is the closest proxy, and it
  // is what every client that claims a Shorts feed is actually doing.
  url.searchParams.set("videoDuration", "short");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("q", query);
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const response = await fetch(url, {
    // An hour of cache keeps a busy day inside the free quota.
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    // A quota error is not an outage. Say nothing rather than show a broken UI.
    console.warn("[youtube] search failed", response.status);
    return { items: [], nextPageToken: null, unconfigured: false };
  }

  const body = (await response.json()) as {
    nextPageToken?: string;
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
      };
    }[];
  };

  const items: Short[] = (body.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const id = item.id!.videoId!;
      return {
        id,
        title: item.snippet?.title ?? "Untitled",
        channel: item.snippet?.channelTitle ?? "Unknown channel",
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnail:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          "",
        // youtube-nocookie defers tracking cookies until the viewer presses play.
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    });

  return { items, nextPageToken: body.nextPageToken ?? null, unconfigured: false };
}
