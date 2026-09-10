/*
 * Service worker.
 *
 * The guiding rule here is that this platform's whole argument is that its
 * numbers are current and labelled. A service worker that serves yesterday's
 * payouts from a cache without saying so would break that argument silently,
 * which is worse than being offline. So this caches almost nothing, and what
 * it does cache is on an explicit allowlist rather than a pattern that might
 * one day match something personal.
 *
 * What is cached:
 *   - /_next/static/*  Content-hashed and immutable. A new build produces new
 *                      filenames, so a stale entry can never be served for new
 *                      code. Cache-first is free correctness here.
 *   - the app icons    Same reasoning, they change with the file name.
 *   - PUBLIC_PAGES     A short list of pages that are identical for everyone.
 *
 * What is never cached, and why:
 *   - /api/*           Responses are per-user and often per-second.
 *   - /dashboard/*     Per-user. On a shared phone a cached dashboard is one
 *     /admin/*         person's data served to the next one. Not a staleness
 *     /login,/register bug, a disclosure bug.
 *   - anything not GET, and anything cross-origin.
 */

const VERSION = "v1";
const STATIC_CACHE = `money-lab-static-${VERSION}`;
const PAGE_CACHE = `money-lab-pages-${VERSION}`;

/** Pages that are the same for every visitor, signed in or not. */
const PUBLIC_PAGES = ["/", "/legal", "/fund", "/offline"];

/** Prefixes that must never reach a cache, checked before anything else. */
const NEVER_CACHE = ["/api/", "/dashboard", "/admin", "/login", "/register"];

const PRECACHE = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll is atomic: one 404 and nothing is cached. That is the right
      // failure mode, since a half-populated cache is harder to reason about
      // than an empty one.
      cache.addAll(PRECACHE).catch((error) => {
        console.warn("[sw] precache failed", error);
      }),
    ),
  );
  // Take over immediately. Safe here because the only cache-first entries are
  // content-hashed, so a new worker cannot serve old code for a new URL.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("money-lab-") && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Anything that changes state on the server, or belongs to someone else's
  // origin, is none of this worker's business.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Immutable build output. Cache-first, and a hit never needs revalidating.
  if (url.pathname.startsWith("/_next/static/") || isIcon(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Public pages. Network first so the live version always wins, with the
  // cached copy as a fallback when the network does not answer.
  if (request.mode === "navigate" && PUBLIC_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  // Every other navigation goes to the network, and shows the offline page
  // rather than anything stale if it cannot get there.
  if (request.mode === "navigate") {
    event.respondWith(networkOnlyWithOfflinePage(request));
  }
});

function isIcon(pathname) {
  return (
    pathname.startsWith("/icon-") ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/favicon-32.png"
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Only full, successful responses. A 206 or an opaque response in the cache
  // will be replayed as-is later and produce a broken asset.
  if (response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    return (await caches.match("/offline")) ?? Response.error();
  }
}

async function networkOnlyWithOfflinePage(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match("/offline")) ?? Response.error();
  }
}
