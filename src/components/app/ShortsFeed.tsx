"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "@phosphor-icons/react/dist/ssr";

import { Panel, cx } from "@/components/ui/primitives";
import { SHORT_QUERIES } from "@/lib/social/queries";
import type { Short, ShortsPage } from "@/lib/social/types";

/**
 * Infinite Shorts feed.
 *
 * Each card is a thumbnail until it is clicked, and only then does the iframe
 * mount. Twelve autoplaying YouTube iframes on one page is the fastest way to
 * make a phone unusable, and the click-to-play version also means no tracking
 * cookie is set for anyone who scrolls past.
 *
 * Paging is driven by an IntersectionObserver on a sentinel element rather
 * than a scroll listener, so nothing runs per frame.
 */
export function ShortsFeed({ initial }: { initial: ShortsPage }) {
  const [query, setQuery] = useState<(typeof SHORT_QUERIES)[number]>(SHORT_QUERIES[0]);
  const [items, setItems] = useState<Short[]>(initial.items);
  const [pageToken, setPageToken] = useState<string | null>(initial.nextPageToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (nextQuery: (typeof SHORT_QUERIES)[number], token: string | null, reset: boolean) => {
      if (loading) return;
      if (!reset && !token) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL("/api/shorts", window.location.origin);
        url.searchParams.set("q", nextQuery);
        if (token && !reset) url.searchParams.set("pageToken", token);

        const response = await fetch(url);
        const body = (await response.json()) as ShortsPage & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load more.");

        setItems((prev) => (reset ? body.items : [...prev, ...body.items]));
        setPageToken(body.nextPageToken);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  useEffect(() => {
    const node = sentinel.current;
    if (!node || initial.unconfigured) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) load(query, pageToken, false);
      },
      // Start fetching before the reader reaches the end of the list.
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, query, pageToken, initial.unconfigured]);

  if (initial.unconfigured) {
    return (
      <Panel className="px-6 py-16 text-center">
        <h2 className="text-sm font-medium text-ink">The video feed needs a key</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-muted">
          Set <span className="tabular text-ink">YOUTUBE_API_KEY</span> in the
          environment and this fills with GTA 6 Shorts. Until then it stays
          empty rather than showing placeholder videos.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Feed topic">
        {SHORT_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            aria-pressed={query === q}
            onClick={() => {
              setQuery(q);
              setPlaying(null);
              load(q, null, true);
            }}
            className={cx(
              "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              query === q
                ? "border-accent bg-accent-dim text-accent"
                : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {q.replace("GTA 6 ", "")}
          </button>
        ))}
      </nav>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((short) => (
          <Panel key={short.id} className="overflow-hidden">
            <div className="relative aspect-[9/16] w-full bg-surface-2">
              {playing === short.id ? (
                <iframe
                  src={`${short.embedUrl}&autoplay=1`}
                  title={short.title}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(short.id)}
                  className="group absolute inset-0 h-full w-full"
                  aria-label={`Play ${short.title}`}
                >
                  {short.thumbnail ? (
                    <Image
                      src={short.thumbnail}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover opacity-85 transition-opacity group-hover:opacity-100"
                    />
                  ) : null}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-accent/90 text-white transition-transform group-hover:scale-110">
                      <Play size={22} weight="fill" />
                    </span>
                  </span>
                </button>
              )}
            </div>

            <div className="p-4">
              <h3 className="line-clamp-2 text-[13px] leading-snug text-ink">
                {short.title}
              </h3>
              <p className="mt-1.5 text-[11px] text-ink-faint">{short.channel}</p>
              <a
                href={short.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[11px] text-accent hover:text-accent-soft"
              >
                Open on YouTube
              </a>
            </div>
          </Panel>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-center text-[13px] text-down">
          {error}
        </p>
      ) : null}

      <div ref={sentinel} className="h-16" />

      {loading ? (
        <p className="pb-6 text-center text-[12px] text-ink-faint">Loading more</p>
      ) : !pageToken && items.length > 0 ? (
        <p className="pb-6 text-center text-[12px] text-ink-faint">
          That is everything YouTube returns for this topic. Try another.
        </p>
      ) : null}
    </div>
  );
}
