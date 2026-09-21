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
 *
 * WITHOUT A KEY
 * There is a second, keyless path. Every YouTube channel publishes an Atom
 * feed at /feeds/videos.xml, which needs no credentials and has no quota. It
 * cannot search, so it only ever returns the official Rockstar channel, but
 * that is the single most relevant source there is and it means the feed shows
 * real video on a fresh checkout instead of an empty panel. The page says
 * which of the two it is looking at rather than passing one off as the other.
 *
 * THAT FEED IS DOWN FOR EVERYONE
 * Since February 2026 /feeds/videos.xml answers 404 for every channel,
 * YouTube's own included, with or without a browser user agent (checked again
 * 21 September 2026; reported by FreshRSS, RSS-Bridge, n8n and others). It is
 * still tried, since it may come back, but it can no longer be the thing a
 * fresh checkout relies on.
 *
 * So there is a third step: a fixed list of official Rockstar uploads, each
 * confirmed through YouTube's oEmbed endpoint, which is keyless and still
 * answers. Titles and thumbnails come from oEmbed, not from this file, and a
 * video that stops answering drops out. The panel labels it as a curated list,
 * not a feed. A YOUTUBE_API_KEY (free, 10,000 units a day) is the real fix.
 */

import type { Short, ShortsPage } from "@/lib/social/types";
export type { Short, ShortsPage };

const SEARCH = "https://www.googleapis.com/youtube/v3/search";

/**
 * The official Rockstar Games channel.
 *
 * Read out of the feed itself rather than typed from memory: the id that
 * looked right returned a 404, and this one returns the channel with the
 * Grand Theft Auto VI videos on it.
 */
const ROCKSTAR_CHANNEL = "UC6VcWc1rAoWdBCM0JxrRQ3A";
const FEED = "https://www.youtube.com/feeds/videos.xml";

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

  // No key: fall back to the official channel feed rather than an empty panel.
  // Still no invented content, just a narrower and honestly labelled source.
  if (!key) return fetchChannelFeed().then(orCurated);

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
    // Quota is the common case here and it comes back tomorrow. The channel
    // feed is not rate limited, so it keeps the page alive in the meantime.
    // Mid-scroll, the fallback would re-append the same videos. End the list.
    if (pageToken) {
      return { items: [], nextPageToken: null, unconfigured: false, source: "api" };
    }
    return fetchChannelFeed().then(orCurated);
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

  return {
    items,
    nextPageToken: body.nextPageToken ?? null,
    unconfigured: false,
    source: "api",
  };
}

/**
 * The keyless path: the official channel's Atom feed.
 *
 * Parsed with a regex rather than an XML library on purpose. The feed is a
 * fixed, machine generated shape from one publisher, the four fields we want
 * are unambiguous in it, and adding a parser dependency to read one document
 * would cost more than it is worth. If YouTube ever changes the shape, this
 * returns nothing rather than something wrong.
 */
async function fetchChannelFeed(): Promise<ShortsPage> {
  const url = new URL(FEED);
  url.searchParams.set("channel_id", ROCKSTAR_CHANNEL);

  let xml: string;
  try {
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) {
      console.warn("[youtube] channel feed failed", response.status);
      return { items: [], nextPageToken: null, unconfigured: true, source: "feed" };
    }
    xml = await response.text();
  } catch (error) {
    console.warn("[youtube] channel feed unreachable", error);
    return { items: [], nextPageToken: null, unconfigured: true, source: "feed" };
  }

  const channel = /<author>\s*<name>([^<]*)<\/name>/.exec(xml)?.[1] ?? "Rockstar Games";

  const items: Short[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = /<yt:videoId>([\w-]+)<\/yt:videoId>/.exec(entry)?.[1];
    if (!id) continue;

    items.push({
      id,
      title: decodeEntities(/<title>([^<]*)<\/title>/.exec(entry)?.[1] ?? "Untitled"),
      channel,
      publishedAt: /<published>([^<]*)<\/published>/.exec(entry)?.[1] ?? "",
      thumbnail: /<media:thumbnail url="([^"]+)"/.exec(entry)?.[1] ?? "",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  // The feed is a fixed window of recent uploads, so there is no next page.
  return { items, nextPageToken: null, unconfigured: items.length === 0, source: "feed" };
}

/**
 * Official Rockstar uploads, by id only.
 *
 * Nothing else about them is typed here: the title, channel and thumbnail are
 * read from oEmbed at fetch time, so this list cannot misdescribe a video, and
 * one that is removed or made private simply stops appearing.
 */
export const CURATED_OFFICIAL = ["VQRLujxTm3c", "QdBZY2fkU-0"] as const;
const OEMBED = "https://www.youtube.com/oembed";

async function orCurated(page: ShortsPage): Promise<ShortsPage> {
  return page.items.length > 0 ? page : fetchCurated();
}

export async function fetchCurated(): Promise<ShortsPage> {
  const found = await Promise.all(
    CURATED_OFFICIAL.map(async (id): Promise<Short | null> => {
      const url = new URL(OEMBED);
      url.searchParams.set("url", `https://www.youtube.com/watch?v=${id}`);
      url.searchParams.set("format", "json");
      try {
        // A day: these are fixed videos, the check is only "does it still exist".
        const response = await fetch(url, { next: { revalidate: 86_400 } });
        if (!response.ok) return null;
        const body = (await response.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        // Refuse anything oEmbed does not attribute to Rockstar. The list is
        // "official uploads", and that is checked, not assumed.
        if (!body.title || body.author_name !== "Rockstar Games") return null;
        return {
          id,
          title: body.title,
          channel: body.author_name,
          publishedAt: "",
          thumbnail: body.thumbnail_url ?? "",
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
          watchUrl: `https://www.youtube.com/watch?v=${id}`,
        };
      } catch {
        return null;
      }
    }),
  );
  const items = found.filter((s): s is Short => s !== null);
  return { items, nextPageToken: null, unconfigured: items.length === 0, source: "curated" };
}

/**
 * The five entities XML defines. Titles routinely contain & and the odd
 * quote, and a raw &amp; on screen looks like a bug to everyone who sees it.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
