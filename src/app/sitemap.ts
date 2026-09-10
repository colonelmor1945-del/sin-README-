import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * The sitemap.
 *
 * Public pages only, and every one of them is a page a person could
 * legitimately land on from a search result. Listing routes that redirect to
 * /login would train a crawler that this site wastes its time.
 *
 * `priority` is a hint and a weak one, so it is used only to say which page is
 * the front door rather than to rank the rest against each other.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/fund`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/legal`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
