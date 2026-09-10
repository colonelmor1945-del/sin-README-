/**
 * Where this site lives.
 *
 * Canonical URLs, the sitemap, robots.txt and the structured data all have to
 * agree on one absolute origin, and getting it wrong is the kind of mistake
 * that costs weeks: a sitemap full of localhost URLs is worse than no sitemap,
 * because a crawler will fetch it, fail on every entry, and trust the next one
 * less.
 *
 * So there is one function, everything reads it, and it comes from APP_URL,
 * which is the same variable the OAuth redirect already uses. One place to set
 * when the domain is registered.
 */

const FALLBACK = "http://localhost:3000";

export function siteUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return FALLBACK;

  // A trailing slash here turns every derived URL into a double slash.
  return raw.replace(/\/+$/, "");
}

/** True once APP_URL is a real, public origin rather than the local fallback. */
export function isPublicSite(): boolean {
  return !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(siteUrl());
}
