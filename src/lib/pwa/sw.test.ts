import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Tests for the service worker's routing decisions.
 *
 * The worker is plain JavaScript in public/ because it has to be served from
 * the origin root to control the whole scope, so it cannot be imported. This
 * loads the real file and runs it against a fake `self`, capturing the fetch
 * handler it installs. That way these assert the shipped file rather than a
 * copy of its rules that could drift away from it.
 *
 * The rule that matters most is the one about /dashboard. A cached dashboard
 * on a shared phone is one person's data served to the next one, which is a
 * disclosure bug rather than a staleness bug, and it is exactly the kind of
 * thing that gets quietly reintroduced by someone adding a caching rule later.
 */

type FetchHandler = (event: FakeEvent) => void;

interface FakeEvent {
  request: { url: string; method: string; mode?: string };
  respondWith: (value: unknown) => void;
}

function loadWorker(): FetchHandler {
  const source = readFileSync("public/sw.js", "utf8");

  const handlers: Record<string, FetchHandler> = {};
  const self = {
    addEventListener: (type: string, handler: FetchHandler) => {
      handlers[type] = handler;
    },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    location: { origin: "https://money.lab" },
  };

  // The worker only reaches caches inside a handler, and no test here lets one
  // run to completion, so a stub that records nothing is enough.
  const caches = {
    open: async () => ({ addAll: async () => {}, match: async () => undefined, put: async () => {} }),
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  };

  const run = new Function("self", "caches", "fetch", "console", source);
  run(self, caches, async () => new Response(""), console);

  if (!handlers.fetch) throw new Error("the worker did not register a fetch handler");
  return handlers.fetch;
}

/** Does the worker take responsibility for this request, or pass it through? */
function handles(
  onFetch: FetchHandler,
  url: string,
  { method = "GET", mode = "navigate" }: { method?: string; mode?: string } = {},
): boolean {
  let responded = false;
  onFetch({
    request: { url, method, mode },
    respondWith: () => {
      responded = true;
    },
  });
  return responded;
}

describe("service worker routing", () => {
  const onFetch = loadWorker();

  it("never touches anything under /dashboard", () => {
    // Per-user pages. On a shared device a cached one is a disclosure bug.
    expect(handles(onFetch, "https://money.lab/dashboard")).toBe(false);
    expect(handles(onFetch, "https://money.lab/dashboard/plan")).toBe(false);
    expect(handles(onFetch, "https://money.lab/dashboard/economy")).toBe(false);
  });

  it("never touches admin, auth or the API", () => {
    expect(handles(onFetch, "https://money.lab/admin/content")).toBe(false);
    expect(handles(onFetch, "https://money.lab/login")).toBe(false);
    expect(handles(onFetch, "https://money.lab/register")).toBe(false);
    expect(handles(onFetch, "https://money.lab/api/shorts", { mode: "cors" })).toBe(false);
  });

  it("ignores requests that are not GET", () => {
    // A POST is a state change. Replaying one from a cache would be a bug with
    // consequences beyond the browser.
    expect(handles(onFetch, "https://money.lab/", { method: "POST" })).toBe(false);
    expect(handles(onFetch, "https://money.lab/", { method: "DELETE" })).toBe(false);
  });

  it("ignores other origins", () => {
    expect(handles(onFetch, "https://www.youtube.com/feeds/videos.xml")).toBe(false);
    expect(handles(onFetch, "https://i.ytimg.com/vi/abc/hqdefault.jpg", { mode: "no-cors" })).toBe(
      false,
    );
  });

  it("takes the immutable build output and the icons", () => {
    // Content-hashed, so a cache hit can never be the wrong version.
    expect(handles(onFetch, "https://money.lab/_next/static/chunks/main-abc123.js", { mode: "no-cors" })).toBe(true);
    expect(handles(onFetch, "https://money.lab/icon-192.png", { mode: "no-cors" })).toBe(true);
    expect(handles(onFetch, "https://money.lab/apple-touch-icon.png", { mode: "no-cors" })).toBe(true);
  });

  it("takes public pages, which are the same for everyone", () => {
    expect(handles(onFetch, "https://money.lab/")).toBe(true);
    expect(handles(onFetch, "https://money.lab/legal")).toBe(true);
    expect(handles(onFetch, "https://money.lab/offline")).toBe(true);
  });

  it("still answers an unknown navigation, so it can show the offline page", () => {
    // Not cached, but handled: the point is a real page instead of the
    // browser's dinosaur when the network is gone.
    expect(handles(onFetch, "https://money.lab/something-new")).toBe(true);
  });

  it("leaves non-navigation requests to unlisted paths alone", () => {
    expect(handles(onFetch, "https://money.lab/some-data.json", { mode: "cors" })).toBe(false);
  });
});
