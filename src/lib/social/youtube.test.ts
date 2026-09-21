import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CURATED_OFFICIAL, fetchShorts } from "./youtube";

const oembed = (id: string, author = "Rockstar Games") =>
  Response.json({
    title: `Official video ${id}`,
    author_name: author,
    thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  });

describe("fetchShorts without a key", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("YOUTUBE_API_KEY", "");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls to the curated list when the channel feed 404s, as it has since February", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/feeds/videos.xml") return new Response("", { status: 404 });
      const id = new URL(url.searchParams.get("url")!).searchParams.get("v")!;
      return oembed(id);
    });

    const page = await fetchShorts({});

    expect(page.source).toBe("curated");
    expect(page.unconfigured).toBe(false);
    expect(page.nextPageToken).toBeNull();
    expect(page.items.map((s) => s.id)).toEqual([...CURATED_OFFICIAL]);
    // Titles come from oEmbed, not from the code.
    expect(page.items[0].title).toBe(`Official video ${CURATED_OFFICIAL[0]}`);
    expect(page.items[0].embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  });

  it("drops a video oEmbed no longer answers for", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/feeds/videos.xml") return new Response("", { status: 404 });
      const id = new URL(url.searchParams.get("url")!).searchParams.get("v")!;
      return id === CURATED_OFFICIAL[0] ? new Response("", { status: 404 }) : oembed(id);
    });

    const page = await fetchShorts({});
    expect(page.items.map((s) => s.id)).toEqual([CURATED_OFFICIAL[1]]);
  });

  it("refuses a video oEmbed attributes to anyone but Rockstar", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/feeds/videos.xml") return new Response("", { status: 404 });
      const id = new URL(url.searchParams.get("url")!).searchParams.get("v")!;
      return oembed(id, "Some Reupload Channel");
    });

    const page = await fetchShorts({});
    expect(page.items).toEqual([]);
    expect(page.unconfigured).toBe(true);
  });

  it("prefers the channel feed when it answers", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname !== "/feeds/videos.xml") throw new Error("should not reach oEmbed");
      return new Response(
        `<feed><author><name>Rockstar Games</name></author><entry><yt:videoId>abc_123</yt:videoId><title>New &amp; shiny</title><published>2026-09-01T00:00:00Z</published></entry></feed>`,
      );
    });

    const page = await fetchShorts({});
    expect(page.source).toBe("feed");
    expect(page.items[0]).toMatchObject({ id: "abc_123", title: "New & shiny" });
  });
});

describe("fetchShorts with a key", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ends the list mid-scroll on a quota error rather than re-appending the fallback", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 403 }));
    const page = await fetchShorts({ pageToken: "NEXT" });
    expect(page).toEqual({ items: [], nextPageToken: null, unconfigured: false, source: "api" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
