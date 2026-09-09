import type { Provenance } from "@/lib/types";

/**
 * The launch target.
 *
 * The whole product refuses to state a number without stating how confident it
 * is, and the release date is the number people care about most. So it gets
 * the same treatment: one place to edit, a provenance label, and a citable
 * source when the label is "verified".
 *
 * HOW TO UPDATE
 * When Rockstar announces or moves the date, change `target`, set
 * `provenance` to "verified", put the announcement URL in `source`, and push
 * the previous value onto `history`. The UI reads all of it.
 */
export interface LaunchTarget {
  /** ISO 8601 with an explicit offset. Never a bare local date. */
  target: string;
  provenance: Provenance;
  /** Who said so. Required in the UI whenever provenance is "verified". */
  source: string;
  sourceUrl?: string;
  /**
   * Every date this project has previously displayed. A release that has moved
   * before is likely to move again, and hiding that would be the same kind of
   * false confidence the rest of the platform exists to avoid.
   */
  history: { date: string; announcedOn: string; note: string }[];
}

export const LAUNCH: LaunchTarget = {
  target: "2026-11-19T00:00:00-05:00",
  provenance: "verified",
  source: "Rockstar Games Newswire",
  sourceUrl:
    "https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026",
  history: [
    {
      date: "2025",
      announcedOn: "2023",
      note: "First window given at announcement.",
    },
    {
      date: "2026-05-26",
      announcedOn: "2025",
      note: "First delay.",
    },
    {
      date: "2026-11-19",
      announcedOn: "November 2025",
      note: "Second delay, six months, for extra polish. The current date.",
    },
  ],
};

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target has passed. */
  released: boolean;
  totalMs: number;
}

export function countdownFrom(target: string, now: number): Countdown {
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, released: true, totalMs: 0 };
  }
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
    released: false,
    totalMs: diff,
  };
}
