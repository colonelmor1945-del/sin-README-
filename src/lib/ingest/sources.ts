import type { Provenance } from "@/lib/types";

/**
 * Source registry.
 *
 * This file is the reason the ingestion pipeline cannot quietly destroy the
 * product. Every source carries a trust tier, and a tier is a **ceiling**: no
 * amount of cross-checking, model summarising or editor enthusiasm can promote
 * an item above what its origin justifies.
 *
 * The failure mode this prevents is specific and fatal. Pull a rumour off
 * Reddit, run it through a language model, write a confident paragraph, publish
 * it as a number in the economy tracker, and the platform has become exactly
 * the thing it exists to replace. The difference between this product and every
 * other GTA guide is not the data, it is the discipline about where the data
 * came from.
 */

export type TrustTier =
  /** Rockstar themselves. The only tier that can produce Verified. */
  | "official"
  /** Established outlets with editorial standards. Community at best. */
  | "press"
  /** Players, forums, video creators. Unverified until cross-checked. */
  | "community";

export interface Source {
  id: string;
  label: string;
  tier: TrustTier;
  /** Highest provenance an item from here may ever carry. */
  ceiling: Provenance;
  /**
   * Whether an item may reach the live dataset without a human approving it.
   * True for exactly one source, and only because it is the primary record.
   */
  autoPublish: boolean;
  homepage: string;
  /** Minutes between polls. Slow on purpose; none of this is breaking news. */
  intervalMinutes: number;
  note: string;
}

export const SOURCES: Source[] = [
  {
    id: "rockstar-newswire",
    label: "Rockstar Newswire",
    tier: "official",
    ceiling: "verified",
    // Manual. See canAutoIngest below: this one cannot be polled.
    autoPublish: false,
    homepage: "https://www.rockstargames.com/newswire",
    intervalMinutes: 0,
    note: "The only source that can produce Verified, and the only one a human has to enter by hand. No RSS, no public API, and the page is a JavaScript shell, so there is nothing to poll.",
  },
  {
    id: "reddit-gta6",
    label: "r/GTA6",
    tier: "community",
    ceiling: "community",
    autoPublish: false,
    homepage: "https://www.reddit.com/r/GTA6/",
    intervalMinutes: 20,
    note: "High volume, low signal. A post reaches Community only when a second independent source says the same thing.",
  },
  {
    id: "youtube-gta6",
    label: "YouTube",
    tier: "community",
    ceiling: "community",
    autoPublish: false,
    homepage: "https://www.youtube.com",
    intervalMinutes: 60,
    note: "Creators often measure things carefully. They also repeat each other, so two videos are not two sources.",
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

/**
 * Whether a source can be polled at all.
 *
 * Rockstar publish no feed. /newswire/rss and every variant answer 404, there
 * is no public posts endpoint, and the newswire page itself is a four kilobyte
 * shell that fills in from JavaScript. Reading it would take a headless
 * browser, which is both fragile and precisely the behaviour their robots.txt
 * is signalling against.
 *
 * This is a constraint worth stating rather than working around, because it
 * lands in the right place: **Verified entries are typed in by a person who
 * has read the announcement and pasted its URL.** An automated scraper granting
 * the highest trust tier in the product would have been the weakest link in the
 * whole design. Nothing else can reach Verified, so nothing else needs to.
 */
export const canAutoIngest = (source: Source) => source.intervalMinutes > 0;

export const POLLABLE = SOURCES.filter(canAutoIngest);

/** Ranked worst to best, so a ceiling can be applied by comparison. */
const RANK: Provenance[] = ["unverified", "ai-projection", "estimated", "community", "verified"];

/**
 * Applies a source's ceiling to a proposed provenance.
 *
 * Called on every item before it is stored. There is no path into the dataset
 * that skips this.
 */
export function capProvenance(proposed: Provenance, source: Source): Provenance {
  return RANK.indexOf(proposed) > RANK.indexOf(source.ceiling)
    ? source.ceiling
    : proposed;
}

/**
 * How many independent sources are needed before a claim earns a provenance.
 *
 * Two for Community, which is what "cross-checked" has meant throughout this
 * codebase. Verified is not on this table at all: it comes from being official,
 * never from agreement between unofficial sources. A thousand people repeating
 * a rumour is still a rumour.
 */
export const CORROBORATION_REQUIRED: Partial<Record<Provenance, number>> = {
  community: 2,
  estimated: 1,
};
