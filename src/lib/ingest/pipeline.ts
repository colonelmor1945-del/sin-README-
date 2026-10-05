import "server-only";

import crypto from "node:crypto";

import { getStore } from "@/lib/db/store";
import { POLLABLE, capProvenance, sourceById, type Source } from "@/lib/ingest/sources";
import { fetchReddit } from "@/lib/social/reddit";
import { fetchShorts } from "@/lib/social/youtube";
import type { Provenance } from "@/lib/types";

/**
 * Ingestion pipeline.
 *
 * Polls the sources that can be polled, normalises what comes back, applies the
 * trust ceiling, and puts everything in a review queue.
 *
 * The one rule: **nothing here writes to the live dataset.** Items land in the
 * queue and a person promotes them. That is not caution for its own sake. The
 * platform's entire claim is that a number's provenance is trustworthy, and an
 * unattended job that could push a Reddit rumour into the economy tracker would
 * make that claim false at 3am with nobody watching.
 *
 * What the pipeline gives you in exchange for that restraint is the expensive
 * part: fresh candidates, deduplicated, already grouped by claim, with the
 * corroboration count attached so an editor can see at a glance whether two
 * independent people said the same thing.
 */

export interface IngestItem {
  /** Stable across runs, so re-polling does not duplicate. */
  id: string;
  sourceId: string;
  title: string;
  url: string;
  /** Epoch millis. */
  publishedAt: number;
  /** What this could be at most, after the source ceiling is applied. */
  provenance: Provenance;
  /** Populated by the grouping pass. */
  claimKey: string;
  corroboration: number;
  /** Engagement, where the source reports it. Signal, not truth. */
  score?: number;
  /** Credit for a visitor submission. Never set by the polled sources. */
  submittedBy?: string | null;
  /**
   * What corroborate() actually counts as "independent", when that is finer
   * than the source itself. Defaults to sourceId, which is right for Reddit
   * and YouTube: every post from one of those is the same avenue. It is wrong
   * for visitor submissions, where the avenue is shared by everyone who has
   * ever used the form — there, this is set per submitter, so two different
   * people agreeing counts as two sources and one person submitting the same
   * claim twice does not count itself twice.
   */
  corroborationKey?: string;
}

export interface SourceRun {
  sourceId: string;
  ok: boolean;
  found: number;
  error?: string;
  ms: number;
}

export interface IngestRun {
  startedAt: string;
  ms: number;
  items: IngestItem[];
  runs: SourceRun[];
}

const idFor = (sourceId: string, url: string) =>
  crypto.createHash("sha1").update(`${sourceId}:${url}`).digest("hex").slice(0, 16);

/**
 * Reduces a headline to the claim it is making.
 *
 * Crude on purpose. Two posts about the nightclub payback should collide even
 * when worded differently, and the cost of a false collision is an editor
 * seeing two related items grouped, which is fine. The cost of missing a
 * collision is an uncorroborated claim looking corroborated, which is not.
 */
const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "in", "on", "of", "to", "for", "and",
  "or", "my", "your", "this", "that", "with", "how", "what", "why", "gta",
  "gta6", "grand", "theft", "auto", "vi", "6",
]);

export function claimKey(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

  // Sorted so word order does not split a claim, capped so a long title does
  // not become unique by accident.
  return [...new Set(words)].sort().slice(0, 5).join("-") || "unclassified";
}

/* Adapters --------------------------------------------------------------- */

async function pollReddit(source: Source): Promise<{ items: IngestItem[]; run: SourceRun }> {
  const t0 = Date.now();
  const feed = await fetchReddit({ subreddit: "GTA6", sort: "hot", limit: 25 });

  if (feed.unconfigured || feed.failed) {
    return {
      items: [],
      run: {
        sourceId: source.id,
        ok: false,
        found: 0,
        ms: Date.now() - t0,
        error: feed.unconfigured ? "No Reddit credentials configured" : "Reddit refused the request (rate limited or down)",
      },
    };
  }

  const items = feed.posts.map<IngestItem>((post) => ({
    id: idFor(source.id, post.permalink),
    sourceId: source.id,
    title: post.title,
    url: post.permalink,
    publishedAt: post.createdAt,
    // Proposed at the source ceiling, then capped. Belt and braces: the cap is
    // what actually decides, and it runs on every item regardless.
    provenance: capProvenance("community", source),
    claimKey: claimKey(post.title),
    corroboration: 1,
    score: post.score ?? undefined,
  }));

  return { items, run: { sourceId: source.id, ok: true, found: items.length, ms: Date.now() - t0 } };
}

async function pollYouTube(source: Source): Promise<{ items: IngestItem[]; run: SourceRun }> {
  const t0 = Date.now();
  const page = await fetchShorts({});

  // The curated list is a fixed set of old official videos, not news. Feeding
  // it in would stamp them with today's date.
  if (page.unconfigured || page.source === "curated") {
    return {
      items: [],
      run: {
        sourceId: source.id,
        ok: false,
        found: 0,
        ms: Date.now() - t0,
        error: "No YouTube API key configured, and the keyless channel feed is down",
      },
    };
  }

  const items = page.items.map<IngestItem>((short) => ({
    id: idFor(source.id, short.watchUrl),
    sourceId: source.id,
    title: short.title,
    url: short.watchUrl,
    publishedAt: short.publishedAt ? Date.parse(short.publishedAt) : Date.now(),
    provenance: capProvenance("community", source),
    claimKey: claimKey(short.title),
    corroboration: 1,
  }));

  return { items, run: { sourceId: source.id, ok: true, found: items.length, ms: Date.now() - t0 } };
}

const ADAPTERS: Record<string, (s: Source) => Promise<{ items: IngestItem[]; run: SourceRun }>> = {
  "reddit-gta6": pollReddit,
  "youtube-gta6": pollYouTube,
};

/**
 * Reads back what visitors have submitted through /submit.
 *
 * Not a poll: nothing is fetched from anywhere, because unlike Reddit or
 * YouTube a submission cannot be re-fetched — it only exists because someone
 * typed it in. Only pending submissions are read, so once an editor promotes
 * or rejects one it drops out of the queue on its own. capProvenance still
 * runs, same as every other source, because a form on this site is not a
 * reason to skip the ceiling that keeps a claim from outranking its origin.
 */
async function loadPublicSubmissions(): Promise<{ items: IngestItem[]; run: SourceRun }> {
  const t0 = Date.now();
  const source = sourceById("public-submission")!;
  try {
    const submissions = await getStore().listSubmissions(200);
    const items = submissions
      .filter((s) => s.status === "pending")
      .map<IngestItem>((s) => ({
        id: s.id,
        sourceId: source.id,
        title: s.claim,
        url: s.sourceUrl,
        publishedAt: Date.parse(s.createdAt),
        provenance: capProvenance("community", source),
        claimKey: s.claimKey,
        corroboration: 1,
        // Per-submitter, not per-source: see IngestItem.corroborationKey. A
        // submission with no captured IP corroborates only with itself —
        // safer than either guessing it is the same person as another
        // anonymous row, or letting it count as a source no one can trace.
        corroborationKey: `public:${s.ipHash ?? s.id}`,
        submittedBy: s.submittedBy,
      }));
    return {
      items,
      run: { sourceId: source.id, ok: true, found: items.length, ms: Date.now() - t0 },
    };
  } catch (error) {
    return {
      items: [],
      run: {
        sourceId: source.id,
        ok: false,
        found: 0,
        ms: Date.now() - t0,
        error: (error as Error).message,
      },
    };
  }
}

/* Run -------------------------------------------------------------------- */

/**
 * Counts how many *independent sources* back each claim.
 *
 * Independent means different sources, not different posts. Ten Reddit threads
 * repeating each other is one source agreeing with itself, and treating that as
 * corroboration is how rumours get promoted.
 */
function corroborate(items: IngestItem[]): IngestItem[] {
  const sourcesPerClaim = new Map<string, Set<string>>();
  for (const item of items) {
    const set = sourcesPerClaim.get(item.claimKey) ?? new Set<string>();
    set.add(item.corroborationKey ?? item.sourceId);
    sourcesPerClaim.set(item.claimKey, set);
  }
  return items.map((item) => ({
    ...item,
    corroboration: sourcesPerClaim.get(item.claimKey)?.size ?? 1,
  }));
}

export async function runIngestion(): Promise<IngestRun> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  // Sources are polled in parallel and failures are isolated: one dead source
  // must not stop the others, and a run that half worked is still worth having.
  // The submissions table is read alongside them rather than through the same
  // POLLABLE loop, because it is a database read, not a poll of anything.
  const [results, submissions] = await Promise.all([
    Promise.all(
      POLLABLE.map(async (source) => {
        const adapter = ADAPTERS[source.id];
        if (!adapter) {
          return {
            items: [] as IngestItem[],
            run: { sourceId: source.id, ok: false, found: 0, ms: 0, error: "No adapter" },
          };
        }
        try {
          return await adapter(source);
        } catch (error) {
          return {
            items: [] as IngestItem[],
            run: {
              sourceId: source.id,
              ok: false,
              found: 0,
              ms: 0,
              error: (error as Error).message,
            },
          };
        }
      }),
    ),
    loadPublicSubmissions(),
  ]);

  // Corroborated together: a visitor submission and a Reddit thread on the
  // same claim are two independent sources exactly as much as two Reddit
  // threads are one, and a claim should not need to pick which list it is on
  // to be counted honestly.
  const items = corroborate([...results.flatMap((r) => r.items), ...submissions.items]);

  return {
    startedAt,
    ms: Date.now() - t0,
    // Best corroborated first, then newest. An editor working top down sees
    // the claims most worth their attention first.
    items: items.sort(
      (a, b) => b.corroboration - a.corroboration || b.publishedAt - a.publishedAt,
    ),
    runs: [...results.map((r) => r.run), submissions.run],
  };
}

/** Human-readable source label for the queue UI. */
export const labelFor = (sourceId: string) => sourceById(sourceId)?.label ?? sourceId;
