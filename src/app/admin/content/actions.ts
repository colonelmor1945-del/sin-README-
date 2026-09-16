"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { saveAsset, saveMission } from "@/lib/content/store";
import { getAssets, getMapPins, getMissions } from "@/lib/content/store";
import { getNews, parseAffects, saveMapPin, saveNews } from "@/lib/content/store";
import { parseTable, toCsv } from "@/lib/content/csv";
import { recordAudit } from "@/lib/audit";
import type { Asset, MapPin, Mission } from "@/lib/types";
import type { NewsItem } from "@/lib/data/news";

/**
 * Content edit actions.
 *
 * Every one starts with requireAdmin. A server action is a public HTTP endpoint
 * with a generated name, not a private function, and forgetting the check here
 * would let anyone who found the action id rewrite the dataset.
 *
 * The schemas are the same shape the database enforces. Validating in both
 * places is deliberate: the constraint is what guarantees the data, and the
 * schema is what turns a violation into a message a person can act on instead
 * of a Postgres error string.
 */

export interface EditState {
  ok?: boolean;
  error?: string;
  field?: string;
}

// Kept in step with the Provenance union in src/lib/types.ts by hand, because
// z.enum needs a literal tuple. ADR-027 added "unverified" to that union and
// to the database enum, and this list was missed: a row stored at that tier
// could not be edited here, since its own value failed validation on the way
// back in.
const Provenance = z.enum([
  "verified",
  "community",
  "estimated",
  "ai-projection",
  "unverified",
]);

const MissionInput = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens."),
  name: z.string().min(3).max(120),
  strand: z.string().min(2).max(60),
  region: z.string().min(2).max(60),
  payout: z.coerce.number().int().min(0).max(1_000_000_000),
  duration: z.coerce.number().int().min(1).max(600),
  difficulty: z.coerce.number().int().min(1).max(5),
  crewRequired: z.coerce.number().int().min(1).max(8),
  bestStrategy: z.string().max(120),
  provenance: Provenance,
});

const MapPinInput = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens."),
  name: z.string().min(2).max(120),
  kind: z.enum(["mission", "business", "property", "money-spot", "vehicle", "activity"]),
  region: z.string().min(2).max(60),
  // Viewport percentages, not coordinates. The database checks this too.
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  detail: z.string().max(400),
  value: z.coerce.number().int().min(0).max(1_000_000_000),
  provenance: Provenance,
});

const AssetInput = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens."),
  name: z.string().min(3).max(120),
  category: z.enum(["business", "property", "vehicle", "service"]),
  region: z.string().min(2).max(60),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  dailyNet: z.coerce.number().int().min(0).max(100_000_000),
  upkeep: z.coerce.number().int().min(0).max(100_000_000),
  unlockLevel: z.coerce.number().int().min(1).max(999),
  note: z.string().max(400),
  provenance: Provenance,
});

/**
 * Guards the one promotion that must never be automatic.
 *
 * Verified means Rockstar said it, and the only evidence for that is a link to
 * where they said it. Without this an editor can promote a guess to the highest
 * trust tier in the product with a dropdown, which is the failure the whole
 * provenance system exists to prevent.
 */
function checkVerifiedCitation(provenance: string, sourceUrl: string): string | null {
  if (provenance !== "verified") return null;

  if (!/^https:\/\/(www\.)?rockstargames\.com\//i.test(sourceUrl.trim())) {
    return "Verified requires a link to the Rockstar announcement that says so. Anything else is Community at best.";
  }
  return null;
}

export async function updateMission(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const { userId } = await requireAdmin();

  const parsed = MissionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }

  const citation = checkVerifiedCitation(
    parsed.data.provenance,
    String(formData.get("sourceUrl") ?? ""),
  );
  if (citation) return { error: citation, field: "provenance" };

  // Fields the editor does not own are carried through unchanged.
  const mission: Mission = {
    ...parsed.data,
    prerequisites: String(formData.get("prerequisites") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10),
    tips: String(formData.get("tips") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10),
    image: String(formData.get("image") ?? ""),
  };

  const result = await saveMission(mission);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    actorId: userId,
    action: "content.mission.update",
    subject: mission.id,
    // The tier is the field worth being able to answer questions about later.
    metadata: { provenance: mission.provenance, name: mission.name },
  });

  revalidatePath("/dashboard/missions");
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function updateAsset(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const { userId } = await requireAdmin();

  const parsed = AssetInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }

  const citation = checkVerifiedCitation(
    parsed.data.provenance,
    String(formData.get("sourceUrl") ?? ""),
  );
  if (citation) return { error: citation, field: "provenance" };

  // trend, advice and history are derived from the price series on read, never
  // stored, so a saved opinion cannot outlive the numbers behind it.
  const asset: Asset = {
    ...parsed.data,
    trend: "flat",
    advice: "analyze",
    history: [parsed.data.price, parsed.data.price],
  };

  const result = await saveAsset(asset);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    actorId: userId,
    action: "content.asset.update",
    subject: asset.id,
    metadata: { provenance: asset.provenance, name: asset.name },
  });

  revalidatePath("/dashboard/economy");
  revalidatePath("/admin/content");
  return { ok: true };
}

/* Bulk ------------------------------------------------------------------- */

/**
 * Import and export, because launch week is not a form-at-a-time problem.
 *
 * The dataset has to be rebuilt from verified sources the week the game ships.
 * The editor writes one record per submit, which makes the bottleneck the fact
 * that one person types. A spreadsheet lets two people work at once and paste
 * straight from a source; this is the way back in.
 *
 * Nothing here is a shortcut past the rules. Every row goes through the same
 * schema and the same citation guard the form uses, and a row that fails is
 * reported by line number with the reason rather than being skipped quietly.
 */

const MISSION_COLUMNS = [
  "id", "name", "strand", "region", "payout", "duration", "difficulty",
  "crewRequired", "bestStrategy", "provenance", "sourceUrl", "prerequisites", "tips",
];

const ASSET_COLUMNS = [
  "id", "name", "category", "region", "price", "dailyNet", "upkeep",
  "unlockLevel", "note", "provenance", "sourceUrl",
];

export async function exportMissionsCsv(): Promise<string> {
  await requireAdmin();
  const missions = await getMissions();
  return toCsv(
    MISSION_COLUMNS,
    missions.map((m) => [
      m.id, m.name, m.strand, m.region,
      String(m.payout), String(m.duration), String(m.difficulty), String(m.crewRequired),
      m.bestStrategy, m.provenance, "",
      (m.prerequisites ?? []).join("\n"),
      (m.tips ?? []).join("\n"),
    ]),
  );
}

export async function exportAssetsCsv(): Promise<string> {
  await requireAdmin();
  const assets = await getAssets();
  return toCsv(
    ASSET_COLUMNS,
    assets.map((a) => [
      a.id, a.name, a.category, a.region,
      String(a.price), String(a.dailyNet), String(a.upkeep), String(a.unlockLevel),
      a.note, a.provenance, "",
    ]),
  );
}

export interface ImportState {
  ok?: boolean;
  /** How many rows were written. */
  saved?: number;
  /** One line per rejected row, already naming its line number. */
  problems?: string[];
  error?: string;
}

/** Rows are 1-indexed and the header is line 1, so a row's line is index + 2. */
const lineOf = (index: number) => index + 2;

export async function importMissionsCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { userId } = await requireAdmin();

  const text = String(formData.get("csv") ?? "");
  if (text.trim() === "") return { error: "Paste some CSV, or upload a file." };

  const { rows, error } = parseTable(text, ["id", "name", "provenance"]);
  if (error) return { error };

  const problems: string[] = [];
  let saved = 0;

  for (const [index, row] of rows.entries()) {
    const parsed = MissionInput.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`Line ${lineOf(index)} (${row.id || "no id"}): ${String(issue.path[0])} — ${issue.message}`);
      continue;
    }

    const citation = checkVerifiedCitation(parsed.data.provenance, row.sourceUrl ?? "");
    if (citation) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${citation}`);
      continue;
    }

    const result = await saveMission({
      ...parsed.data,
      prerequisites: splitLines(row.prerequisites),
      tips: splitLines(row.tips),
      image: row.image ?? "",
    });

    if (!result.ok) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${result.error}`);
      continue;
    }
    saved++;
  }

  if (saved > 0) {
    await recordAudit({
      actorId: userId,
      action: "content.mission.import",
      subject: `${saved} missions`,
      metadata: { saved, rejected: problems.length },
    });
    revalidatePath("/dashboard/missions");
    revalidatePath("/admin/content");
  }

  return { ok: problems.length === 0, saved, problems };
}

export async function importAssetsCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { userId } = await requireAdmin();

  const text = String(formData.get("csv") ?? "");
  if (text.trim() === "") return { error: "Paste some CSV, or upload a file." };

  const { rows, error } = parseTable(text, ["id", "name", "provenance"]);
  if (error) return { error };

  const problems: string[] = [];
  let saved = 0;

  for (const [index, row] of rows.entries()) {
    const parsed = AssetInput.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`Line ${lineOf(index)} (${row.id || "no id"}): ${String(issue.path[0])} — ${issue.message}`);
      continue;
    }

    const citation = checkVerifiedCitation(parsed.data.provenance, row.sourceUrl ?? "");
    if (citation) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${citation}`);
      continue;
    }

    // Same as the form: trend, advice and history are derived on read, never
    // stored, so a saved opinion cannot outlive the numbers behind it.
    const result = await saveAsset({
      ...parsed.data,
      trend: "flat",
      advice: "analyze",
      history: [parsed.data.price, parsed.data.price],
    });
    if (!result.ok) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${result.error}`);
      continue;
    }
    saved++;
  }

  if (saved > 0) {
    await recordAudit({
      actorId: userId,
      action: "content.asset.import",
      subject: `${saved} assets`,
      metadata: { saved, rejected: problems.length },
    });
    revalidatePath("/dashboard/economy");
    revalidatePath("/admin/content");
  }

  return { ok: problems.length === 0, saved, problems };
}

/** Multi-line cells carry list fields, which is what a spreadsheet can express. */
function splitLines(value: string | undefined): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

const MAP_COLUMNS = [
  "id", "name", "kind", "region", "x", "y", "detail", "value", "provenance", "sourceUrl",
];

export async function exportMapPinsCsv(): Promise<string> {
  await requireAdmin();
  const pins = await getMapPins();
  return toCsv(
    MAP_COLUMNS,
    pins.map((p) => [
      p.id, p.name, p.kind, p.region,
      String(p.x), String(p.y), p.detail, String(p.value),
      p.provenance, "",
    ]),
  );
}

export async function importMapPinsCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { userId } = await requireAdmin();

  const text = String(formData.get("csv") ?? "");
  if (text.trim() === "") return { error: "Paste some CSV, or upload a file." };

  const { rows, error } = parseTable(text, ["id", "name", "provenance"]);
  if (error) return { error };

  const problems: string[] = [];
  let saved = 0;

  for (const [index, row] of rows.entries()) {
    const parsed = MapPinInput.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`Line ${lineOf(index)} (${row.id || "no id"}): ${String(issue.path[0])} — ${issue.message}`);
      continue;
    }

    const citation = checkVerifiedCitation(parsed.data.provenance, row.sourceUrl ?? "");
    if (citation) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${citation}`);
      continue;
    }

    const result = await saveMapPin(parsed.data as MapPin);
    if (!result.ok) {
      problems.push(`Line ${lineOf(index)} (${row.id}): ${result.error}`);
      continue;
    }
    saved++;
  }

  if (saved > 0) {
    await recordAudit({
      actorId: userId,
      action: "content.map.import",
      subject: `${saved} map locations`,
      metadata: { saved, rejected: problems.length },
    });
    revalidatePath("/dashboard/map");
    revalidatePath("/admin/content");
  }

  return { ok: problems.length === 0, saved, problems };
}

const NEWS_COLUMNS = [
  "id", "title", "summary", "impact", "category", "source",
  "sourceUrl", "provenance", "publishedAt", "affects",
];

const NewsInput = z.object({
  // Blank means a new entry; the database generates the uuid.
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  title: z.string().min(4).max(200),
  summary: z.string().min(10).max(1000),
  // The editorial rule, enforced: an entry runs only if it says what it
  // changes for the reader. An empty impact is the definition of filler.
  impact: z.string().min(4).max(600),
  category: z.enum(["official", "patch", "economy", "rumour", "community"]),
  source: z.string().min(2).max(160),
  sourceUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  provenance: Provenance,
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
});

export async function exportNewsCsv(): Promise<string> {
  await requireAdmin();
  const news = await getNews();
  return toCsv(
    NEWS_COLUMNS,
    news.map((n) => [
      n.id, n.title, n.summary, n.impact, n.category, n.source,
      n.sourceUrl ?? "", n.provenance, n.publishedAt,
      // Types are not carried on the flattened read, so a round-trip cannot
      // reconstruct them. Left blank rather than exported wrong.
      "",
    ]),
  );
}

export async function importNewsCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { userId } = await requireAdmin();

  const text = String(formData.get("csv") ?? "");
  if (text.trim() === "") return { error: "Paste some CSV, or upload a file." };

  const { rows, error } = parseTable(text, ["title", "summary", "impact", "provenance"]);
  if (error) return { error };

  const problems: string[] = [];
  let saved = 0;

  for (const [index, row] of rows.entries()) {
    const parsed = NewsInput.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push(`Line ${lineOf(index)}: ${String(issue.path[0])} — ${issue.message}`);
      continue;
    }

    const citation = checkVerifiedCitation(parsed.data.provenance, row.sourceUrl ?? "");
    if (citation) {
      problems.push(`Line ${lineOf(index)}: ${citation}`);
      continue;
    }

    const item: NewsItem = {
      ...parsed.data,
      id: parsed.data.id ?? crypto.randomUUID(),
      affects: [],
    };

    const result = await saveNews(item, parseAffects(row.affects ?? ""));
    if (!result.ok) {
      problems.push(`Line ${lineOf(index)}: ${result.error}`);
      continue;
    }
    saved++;
  }

  if (saved > 0) {
    await recordAudit({
      actorId: userId,
      action: "content.news.import",
      subject: `${saved} news items`,
      metadata: { saved, rejected: problems.length },
    });
    revalidatePath("/dashboard/news");
    revalidatePath("/admin/content");
  }

  return { ok: problems.length === 0, saved, problems };
}
