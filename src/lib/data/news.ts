import type { Provenance } from "@/lib/types";

/**
 * Intel feed.
 *
 * The editorial rule that makes this section worth reading: every entry says
 * what it changes for the reader's money plan, and carries the same provenance
 * label as the rest of the platform. A rumour is published as a rumour.
 *
 * PLACEHOLDER CONTENT. These entries are fictional examples written to
 * exercise the component. Do not ship them as real reporting. Replace with an
 * editor-managed feed backed by the news_items table before launch.
 */

export type NewsCategory =
  | "official"
  | "patch"
  | "economy"
  | "rumour"
  | "community";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  /** ISO date. Sorted newest first. */
  publishedAt: string;
  source: string;
  sourceUrl?: string;
  /** What this changes for the reader. The reason the entry exists. */
  impact: string;
  /** Assets or missions this entry touches, for cross-linking. */
  affects: string[];
  provenance: Provenance;
}

export const NEWS_CATEGORIES: { id: NewsCategory; label: string }[] = [
  { id: "official", label: "Official" },
  { id: "patch", label: "Patch notes" },
  { id: "economy", label: "Economy" },
  { id: "rumour", label: "Rumour" },
  { id: "community", label: "Community" },
];

export const NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Nightclub popularity decay reported as steeper than expected",
    summary:
      "Multiple players running the same promo schedule report income falling faster than the in-game description implies. The reports agree on the direction but not the magnitude.",
    category: "economy",
    publishedAt: "2026-09-06",
    source: "Cross-checked player reports",
    impact:
      "If it holds, the nightclub payback period is longer than our tracker currently shows. Treat the buy call on it as weaker until this is confirmed.",
    affects: ["Vice Beach Nightclub"],
    provenance: "community",
  },
  {
    id: "n2",
    title: "Acid lab supply cost unchanged after the latest update",
    summary:
      "Sale run values and resupply costs both came back identical to pre-update figures across a dozen logged runs.",
    category: "patch",
    publishedAt: "2026-09-04",
    source: "Community run logs",
    impact:
      "The acid lab keeps its position as the fastest capital payback in the dataset. No change to the recommended first purchase.",
    affects: ["Mobile Acid Lab"],
    provenance: "community",
  },
  {
    id: "n3",
    title: "Document forgery prices still sliding",
    summary:
      "The office has fallen for eleven consecutive samples with no sign of a floor. The slide started after the supply change and has not flattened.",
    category: "economy",
    publishedAt: "2026-09-02",
    source: "Money Lab price sampling",
    impact:
      "Our call stays at wait. Buying into a falling asset before the trend flattens costs you the difference for no gain.",
    affects: ["Document Forgery Office"],
    provenance: "estimated",
  },
  {
    id: "n4",
    title: "Claims of a hidden third heist strand remain unconfirmed",
    summary:
      "A widely shared post describes a mission strand that no other source has reproduced. No footage, no corroboration, and the original poster has not responded to requests for detail.",
    category: "rumour",
    publishedAt: "2026-08-30",
    source: "Single unverified post",
    impact:
      "Nothing. We are not adding it to the mission database and you should not plan around it. Listed here so you know we looked at it and rejected it.",
    affects: [],
    provenance: "ai-projection",
  },
  {
    id: "n5",
    title: "Port Skim night window confirmed by a second group",
    summary:
      "The roughly one third payout drop in daylight has now been reproduced independently, with consistent numbers across both sets of runs.",
    category: "community",
    publishedAt: "2026-08-27",
    source: "Two independent run groups",
    impact:
      "Port Skim moves from estimated to community data in the mission database. The night window timing is now worth planning around.",
    affects: ["Port Skim"],
    provenance: "community",
  },
];

export const newsById = (id: string) => NEWS.find((n) => n.id === id);
