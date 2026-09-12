import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchReddit, parseRedditRss, parseThread, timeAgo } from "./reddit";

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


/**
 * A comments response, trimmed to the fields the parser reads.
 *
 * Reddit answers with a two-element array: the post listing, then the comment
 * forest. Replies arrive as a nested listing, or as the empty string when
 * there are none, which is the shape most naive parsers crash on.
 */
function payload() {
  return [
    {
      data: {
        children: [
          {
            data: {
              id: "abc123",
              title: "Best money method so far",
              author: "vice_runner",
              subreddit: "GTA6",
              score: 412,
              num_comments: 37,
              created_utc: 1_760_000_000,
              permalink: "/r/GTA6/comments/abc123/best_money_method_so_far/",
              selftext: "Ran the port job twelve times.\n\nNumbers below.",
              link_flair_text: "Discussion",
              is_self: true,
              url: "https://www.reddit.com/r/GTA6/comments/abc123/",
            },
          },
        ],
      },
    },
    {
      data: {
        children: [
          {
            kind: "t1",
            data: {
              id: "c1",
              author: "someone",
              body: "This matches what I got.",
              score: 22,
              created_utc: 1_760_000_100,
              permalink: "/r/GTA6/comments/abc123/_/c1/",
              replies: {
                data: {
                  children: [
                    {
                      kind: "t1",
                      data: {
                        id: "c2",
                        author: "vice_runner",
                        body: "Good, that rules out my sample.",
                        score: 9,
                        created_utc: 1_760_000_200,
                        permalink: "/r/GTA6/comments/abc123/_/c2/",
                        replies: "",
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            kind: "t1",
            data: {
              id: "c3",
              author: "[deleted]",
              body: "[removed]",
              score: 0,
              created_utc: 1_760_000_300,
              permalink: "/r/GTA6/comments/abc123/_/c3/",
              replies: "",
            },
          },
          // Reddit's load-more stub. It has no body and must not become a comment.
          { kind: "more", data: { id: "morestub", count: 12 } },
        ],
      },
    },
  ];
}

describe("parseThread", () => {
  it("reads the post", () => {
    const thread = parseThread(payload(), "abc123");
    expect(thread?.title).toBe("Best money method so far");
    expect(thread?.author).toBe("vice_runner");
    expect(thread?.score).toBe(412);
    expect(thread?.body).toContain("port job twelve times");
    expect(thread?.permalink).toBe(
      "https://www.reddit.com/r/GTA6/comments/abc123/best_money_method_so_far/",
    );
  });

  it("flattens replies into a depth number", () => {
    const thread = parseThread(payload(), "abc123");
    const depths = thread?.comments.map((c) => [c.id, c.depth]);
    expect(depths).toEqual([
      ["c1", 0],
      ["c2", 1],
      ["c3", 0],
    ]);
  });

  it("drops the load-more stub rather than rendering it as a comment", () => {
    const thread = parseThread(payload(), "abc123");
    expect(thread?.comments.some((c) => c.id === "morestub")).toBe(false);
  });

  it("marks the thread author's own replies", () => {
    const thread = parseThread(payload(), "abc123");
    expect(thread?.comments.find((c) => c.id === "c2")?.isOp).toBe(true);
    expect(thread?.comments.find((c) => c.id === "c1")?.isOp).toBe(false);
  });

  it("marks removed comments instead of hiding the gap", () => {
    const thread = parseThread(payload(), "abc123");
    expect(thread?.comments.find((c) => c.id === "c3")?.removed).toBe(true);
  });

  it("survives a thread with no comments at all", () => {
    const [post] = payload();
    const thread = parseThread([post], "abc123");
    expect(thread?.comments).toEqual([]);
  });

  it("returns null rather than a half-built thread on junk", () => {
    expect(parseThread(null, "abc123")).toBeNull();
    expect(parseThread([], "abc123")).toBeNull();
    expect(parseThread([{ data: { children: [] } }], "abc123")).toBeNull();
  });

  it("separates an image post from a link post", () => {
    const withImage = payload();
    Object.assign(withImage[0].data.children[0].data, {
      is_self: false,
      url: "https://i.redd.it/shot.jpg",
    });
    expect(parseThread(withImage, "abc123")?.image).toBe("https://i.redd.it/shot.jpg");
    expect(parseThread(withImage, "abc123")?.linkUrl).toBeNull();

    const withLink = payload();
    Object.assign(withLink[0].data.children[0].data, {
      is_self: false,
      url: "https://rockstargames.com/VI",
    });
    expect(parseThread(withLink, "abc123")?.linkUrl).toBe("https://rockstargames.com/VI");
    expect(parseThread(withLink, "abc123")?.image).toBeNull();
  });
});

describe("timeAgo", () => {
  it("reads as live without a client clock", () => {
    const now = 1_760_000_000_000;
    expect(timeAgo(now - 30_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});
