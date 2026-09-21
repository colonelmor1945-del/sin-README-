import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchReddit, parseRedditRss } from "./reddit";

// Captured from https://www.reddit.com/r/GTA6/top/.rss on 21 September 2026,
// first three entries, post bodies removed.
const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/reddit-gta6-top.xml", import.meta.url)),
  "utf8",
);

describe("parseRedditRss", () => {
  const posts = parseRedditRss(FIXTURE, "GTA6");

  it("reads every entry and not the feed's own title", () => {
    expect(posts.map((p) => p.title)).toEqual([
      "Spotify teasing GTA6 Collabs",
      "Metro Boomin",
      "I hope they bring back these guys.",
    ]);
  });

  it("takes ids, authors, links and dates from the entry", () => {
    const [first] = posts;
    expect(first.id).toBe("1wi7tfs");
    expect(first.author).toBe("poorna_sus14");
    expect(first.subreddit).toBe("GTA6");
    expect(first.permalink).toMatch(/^https:\/\/www\.reddit\.com\/r\/GTA6\/comments\/1wi7tfs\//);
    expect(first.createdAt).toBeGreaterThan(Date.parse("2026-01-01"));
  });

  it("decodes entities in thumbnail urls so they actually load", () => {
    expect(posts[0].thumbnail).toContain("width=140&height=140");
    expect(posts[0].thumbnail).not.toContain("&amp;");
  });

  it("reports engagement as unknown, never as zero", () => {
    for (const post of posts) {
      expect(post.score).toBeNull();
      expect(post.comments).toBeNull();
    }
  });

  it("decodes named and numeric entities in titles", () => {
    const xml = `<feed><entry><id>t3_abc</id><link href="https://www.reddit.com/r/GTA6/comments/abc/x/" /><title>Cars &amp; cash &#8217;26 &#x2014; &quot;Vice&quot;</title></entry></feed>`;
    expect(parseRedditRss(xml, "GTA6")[0].title).toBe("Cars & cash ’26 — \"Vice\"");
  });

  it("skips entries missing an id, a title or a reddit link", () => {
    const xml = [
      "<entry><title>no id</title><link href=\"https://www.reddit.com/r/a/\" /></entry>",
      "<entry><id>t3_a1</id><link href=\"https://www.reddit.com/r/a/\" /></entry>",
      "<entry><id>t3_a2</id><title>offsite</title><link href=\"https://evil.example/r/a/\" /></entry>",
    ].join("");
    expect(parseRedditRss(xml, "a")).toEqual([]);
  });

  it("drops a thumbnail that is not https", () => {
    const xml = `<entry><id>t3_a1</id><title>t</title><link href="https://www.reddit.com/r/a/c/" /><media:thumbnail url="http://x/y.jpg" /></entry>`;
    expect(parseRedditRss(xml, "a")[0].thumbnail).toBeNull();
  });
});

describe("fetchReddit without credentials", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("REDDIT_CLIENT_ID", "");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "");
    (globalThis as { __redditRss?: Map<string, unknown> }).__redditRss?.clear();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the public feed instead of reporting itself unconfigured", async () => {
    fetchMock.mockResolvedValue(new Response(FIXTURE, { status: 200 }));
    const feed = await fetchReddit({ subreddit: "GTA6", sort: "top", limit: 2 });

    expect(feed).toMatchObject({ source: "rss", unconfigured: false, failed: false });
    expect(feed.posts).toHaveLength(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://www.reddit.com/r/GTA6/top/.rss?limit=25&t=week",
    );
  });

  it("asks for the same url whatever limit the caller wants, so callers share a cache", async () => {
    fetchMock.mockImplementation(async () => new Response(FIXTURE, { status: 200 }));
    await fetchReddit({ subreddit: "GTA6", sort: "hot", limit: 14 });
    await fetchReddit({ subreddit: "GTA6", sort: "hot", limit: 25 });
    expect(new Set(fetchMock.mock.calls.map((c) => String(c[0])))).toEqual(
      new Set(["https://www.reddit.com/r/GTA6/hot/.rss?limit=25"]),
    );
  });

  it("serves the last good posts when rate limited", async () => {
    fetchMock.mockResolvedValueOnce(new Response(FIXTURE, { status: 200 }));
    await fetchReddit({ subreddit: "GTA6", sort: "top" });

    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    const feed = await fetchReddit({ subreddit: "GTA6", sort: "top" });
    expect(feed.failed).toBe(false);
    expect(feed.posts).toHaveLength(3);
  });

  it("reports failure when rate limited with nothing kept", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    const feed = await fetchReddit({ subreddit: "GTA6", sort: "new" });
    expect(feed).toMatchObject({ failed: true, posts: [] });
  });

  it("never puts an unvalidated subreddit into a url", async () => {
    const feed = await fetchReddit({ subreddit: "GTA6/../../api" });
    expect(feed.failed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
