"use client";

import { useState } from "react";

import { toCsv } from "@/lib/content/csv";
import type { Provenance } from "@/lib/types";

/**
 * Carries a claim from the review queue into the dataset.
 *
 * The queue could not promote anything, and could not honestly be made to: an
 * ingested item is a headline and a link, not a mission. Payout, duration and
 * difficulty are not in it and no amount of parsing will find them — a person
 * has to read the source.
 *
 * What a person should not have to do is retype the citation or remember what
 * tier a given source is allowed to reach. So this hands over exactly the two
 * things the pipeline actually established — the evidence, and the ceiling —
 * as a CSV row ready for the bulk importer, with the fields only a human can
 * supply left blank.
 *
 * The ceiling travels as the provenance. The server re-applies it anyway; this
 * just stops an editor starting from a claim they would have to walk back.
 */
export function DraftFromClaim({
  title,
  url,
  provenance,
  claimKey,
}: {
  title: string;
  url: string;
  provenance: Provenance;
  claimKey: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const row = toCsv(
      [
        "id", "name", "strand", "region", "payout", "duration", "difficulty",
        "crewRequired", "bestStrategy", "provenance", "sourceUrl", "prerequisites", "tips",
      ],
      [[
        claimKey.slice(0, 60),
        title.slice(0, 120),
        "", "", "", "", "", "", "",
        provenance,
        url,
        "", "",
      ]],
    );

    try {
      await navigator.clipboard.writeText(row);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; the editor is not blocked by it.
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-[7px] border border-line-strong px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
      title="Copy this claim as a CSV row, with its source and trust ceiling already filled in"
    >
      {copied ? "Copied" : "Draft row"}
    </button>
  );
}
