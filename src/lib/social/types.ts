/** Shapes shared between the server feed and the client component. */
export interface Short {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnail: string;
  embedUrl: string;
  watchUrl: string;
}

export interface ShortsPage {
  items: Short[];
  nextPageToken: string | null;
  unconfigured: boolean;
  /**
   * Where these came from.
   *
   * "api" is the Data API: searches the whole of YouTube, needs a key, has a
   * quota. "feed" is the official Rockstar channel RSS: no key, no quota, but
   * only ever that one channel. The UI has to say which, because "the latest
   * GTA 6 videos" and "the latest videos Rockstar posted" are different claims
   * and only one of them is true at a time.
   */
  source: "api" | "feed";
}
