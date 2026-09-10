import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * What crawlers may read.
 *
 * The public pages are the whole point of being indexed, so they are open. The
 * signed-in product is not: /dashboard is per-user, /admin is privileged, and
 * /api returns data rather than pages. None of them would rank for anything,
 * and a crawler following them just burns the crawl budget that the pages we
 * actually want indexed are competing for.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/api/", "/offline"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
