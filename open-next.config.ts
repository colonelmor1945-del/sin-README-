import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 *
 * Experimental. This exists to answer whether the app can run on Workers at
 * all; nothing is deployed from it. See docs/cloudflare.md for what has been
 * verified and what has not.
 *
 * No incremental cache is configured. Every page here is either static or
 * per-user, so there is nothing to revalidate between requests.
 *
 * THE SOCIAL READS USED TO BE THE EXCEPTION
 * A Reddit thread is shared between users and revalidated on a timer, which is
 * the one shape this config does not cover: without an incremental cache, the
 * Next data cache has nothing behind it on Workers, so `next: { revalidate }`
 * stops holding between requests and every view becomes an upstream call.
 *
 * That is now handled in `src/lib/social/cache.ts` instead of here, and the
 * choice was deliberate. The alternative was to configure an incremental
 * cache, and both implementations on offer — KV and R2 — are durable stores.
 * `withRegionalCache` does not change that; it is a wrapper that puts the
 * Cache API in front of one of those stores, not a substitute for it. Putting
 * other people's comments in durable storage turns a disposable copy into a
 * record we would owe them the ability to delete, and that is a much larger
 * commitment than a cache. An in-isolate cache keeps the upstream calls down
 * without making it.
 *
 * If a genuinely shared, revalidated *page* ever appears, this is where it
 * gets solved, and the storage question comes with it.
 */
export default defineCloudflareConfig();
