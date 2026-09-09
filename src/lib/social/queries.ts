/**
 * Curated topics for the video feed.
 *
 * Kept in its own client-safe module and used as the allowed set on the API
 * route, so the endpoint cannot be turned into an open proxy onto our quota.
 */
export const SHORT_QUERIES = [
  "GTA 6 money guide",
  "GTA 6 business guide",
  "GTA 6 tips",
  "GTA 6 gameplay",
  "GTA 6 heist",
  "GTA 6 Vice City",
] as const;

export type ShortQuery = (typeof SHORT_QUERIES)[number];
