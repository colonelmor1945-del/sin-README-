import { describe, expect, it } from "vitest";

import { parseThread, timeAgo } from "./reddit";

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
