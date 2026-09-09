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
}
