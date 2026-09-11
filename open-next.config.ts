import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 *
 * Experimental. This exists to answer whether the app can run on Workers at
 * all; nothing is deployed from it. See docs/cloudflare.md for what has been
 * verified and what has not.
 *
 * No incremental cache is configured yet. Every page here is either static or
 * per-user, so there is nothing to revalidate between requests; that changes
 * the moment a page is both shared and revalidated.
 */
export default defineCloudflareConfig();
