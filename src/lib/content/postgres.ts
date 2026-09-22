import "server-only";

import { pool } from "@/lib/db/postgres";
import type { Asset, MapPin, Mission, PinKind, Provenance } from "@/lib/types";
import type { NewsCategory, NewsItem } from "@/lib/data/news";

/**
 * Content reads and writes against Postgres.
 *
 * Split from src/lib/db/postgres.ts because that file serves user data and this
 * one serves the game dataset. They share a pool but nothing else, and keeping
 * them apart means a content migration cannot accidentally touch accounts.
 *
 * The pool is now literally that file's, imported rather than rebuilt. This
 * file used to construct its own from DATABASE_URL and throw without one,
 * which meant `npm run dev:db` gave you working accounts and a content editor
 * that threw on every save -- two halves of the same app disagreeing about
 * whether a database existed.
 */

/* Provenance mapping.
 *
 * SQL uses snake_case for enum labels, the application uses kebab-case. Only
 * ai_projection actually differs, but mapping all four keeps the direction of
 * translation obvious and stops the next value being forgotten. */
const PROV_TO_SQL: Record<Provenance, string> = {
  verified: "verified",
  community: "community",
  estimated: "estimated",
  "ai-projection": "ai_projection",
  unverified: "unverified",
};

const PROV_FROM_SQL: Record<string, Provenance> = {
  verified: "verified",
  community: "community",
  estimated: "estimated",
  ai_projection: "ai-projection",
  unverified: "unverified",
};

/**
 * The same five concepts as the engine repo's `DataStatus` enum, which ADR-027
 * makes canonical for the merge. Recorded here rather than in a doc so the
 * mapping sits beside the values it maps, and so the merge is a rename with a
 * reference rather than an archaeology exercise.
 *
 * At merge these tables adopt the canonical labels directly and this whole
 * translation layer goes away. Deferred on purpose: renaming values in a live
 * Postgres enum is worth doing once, against one schema, not twice against two.
 */
export const PROV_TO_CANONICAL: Record<Provenance, string> = {
  verified: "VERIFIED",
  community: "COMMUNITY_REPORTED",
  estimated: "ESTIMATED",
  "ai-projection": "AI_PROJECTION",
  unverified: "UNVERIFIED",
};

/* Reads ------------------------------------------------------------------ */

export async function readMissions(): Promise<Mission[]> {
  const { rows } = await pool().query<{
    id: string;
    name: string;
    strand: string;
    region: string;
    payout: string;
    duration_min: number;
    difficulty: number;
    crew_required: number;
    best_strategy: string;
    prerequisites: string[];
    tips: string[];
    image_url: string | null;
    provenance: string;
  }>(
    `SELECT id, name, strand, region, payout, duration_min, difficulty,
            crew_required, best_strategy, prerequisites, tips, image_url, provenance
       FROM missions WHERE published ORDER BY payout DESC`,
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    strand: r.strand,
    region: r.region,
    // BIGINT arrives as a string. In-game payouts sit far below 2^53.
    payout: Number(r.payout),
    duration: r.duration_min,
    difficulty: r.difficulty,
    crewRequired: r.crew_required,
    bestStrategy: r.best_strategy,
    prerequisites: r.prerequisites ?? [],
    tips: r.tips ?? [],
    image: r.image_url ?? "",
    provenance: PROV_FROM_SQL[r.provenance] ?? "estimated",
  }));
}

export async function readAssets(): Promise<Asset[]> {
  const { rows } = await pool().query<{
    id: string;
    name: string;
    kind: Asset["category"];
    region: string;
    price: string;
    daily_net: string;
    upkeep: string;
    unlock_level: number;
    note: string;
    provenance: string;
    history: string[] | null;
  }>(
    // The sparkline needs the last twelve observations, so they are aggregated
    // here rather than fetched per asset in a loop.
    `SELECT a.id, a.name, a.kind, a.region, a.price, a.daily_net, a.upkeep,
            a.unlock_level, a.note, a.provenance,
            (SELECT array_agg(p.price ORDER BY p.observed_at)
               FROM (SELECT price, observed_at FROM asset_prices
                      WHERE asset_id = a.id
                      ORDER BY observed_at DESC LIMIT 12) p) AS history
       FROM assets a
      WHERE a.published
      ORDER BY a.price DESC`,
  );

  return rows.map((r) => {
    const history = (r.history ?? []).map(Number);
    const price = Number(r.price);

    return {
      id: r.id,
      name: r.name,
      category: r.kind,
      region: r.region,
      price,
      dailyNet: Number(r.daily_net),
      upkeep: Number(r.upkeep),
      unlockLevel: r.unlock_level,
      note: r.note,
      provenance: PROV_FROM_SQL[r.provenance] ?? "estimated",
      // A single observation cannot show a trend, so fall back to a flat pair
      // rather than letting the sparkline divide by a zero span.
      history: history.length >= 2 ? history : [price, price],
      trend: trendFrom(history),
      advice: adviceFrom(price, Number(r.daily_net), trendFrom(history)),
    };
  });
}

/** Derived from the price series rather than stored, so it cannot go stale. */
function trendFrom(history: number[]): Asset["trend"] {
  if (history.length < 2) return "flat";
  const delta = (history[history.length - 1] - history[0]) / history[0];
  if (delta > 0.08) return "strong-up";
  if (delta > 0.01) return "up";
  if (delta < -0.01) return "down";
  return "flat";
}

/**
 * The recommendation, derived from payback and trend.
 *
 * Deliberately not an editable column. A stored recommendation is an opinion
 * that outlives the numbers it was based on, and the whole product argument is
 * that our calls are reproducible from the data.
 */
function adviceFrom(price: number, dailyNet: number, trend: Asset["trend"]): Asset["advice"] {
  if (dailyNet <= 0) return "analyze";
  if (trend === "down") return "wait";
  const payback = price / dailyNet;
  return payback <= 12 ? "buy" : "hold";
}

export async function readMapPins(): Promise<MapPin[]> {
  const { rows } = await pool().query<{
    id: string;
    name: string;
    kind: string;
    region: string;
    x: string;
    y: string;
    detail: string;
    value: string;
    provenance: string;
  }>(
    `SELECT id, name, kind, region, x, y, detail, value, provenance
       FROM map_locations WHERE published`,
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as PinKind,
    region: r.region,
    // NUMERIC also arrives as a string.
    x: Number(r.x),
    y: Number(r.y),
    detail: r.detail,
    value: Number(r.value),
    provenance: PROV_FROM_SQL[r.provenance] ?? "estimated",
  }));
}

/**
 * Published intel entries, newest first.
 *
 * `affects` is a join table rather than a column, because an entry can point at
 * an asset, a mission or a map location and the type matters — the economy
 * tracker needs to answer "why did this number move" for its own records only.
 * The NewsItem type flattens it to plain ids, which is all the feed renders.
 */
export async function readNews(): Promise<NewsItem[]> {
  const { rows } = await pool().query<{
    id: string;
    title: string;
    summary: string;
    impact: string;
    category: string;
    source: string;
    source_url: string | null;
    provenance: string;
    published_at: string;
    affects: string[] | null;
  }>(
    `SELECT n.id, n.title, n.summary, n.impact, n.category, n.source,
            n.source_url, n.provenance, n.published_at::text AS published_at,
            array_agg(a.entity_id) FILTER (WHERE a.entity_id IS NOT NULL) AS affects
       FROM news_items n
       LEFT JOIN news_item_affects a ON a.news_id = n.id
      WHERE n.published
      GROUP BY n.id
      ORDER BY n.published_at DESC`,
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    impact: r.impact,
    category: r.category as NewsCategory,
    source: r.source,
    sourceUrl: r.source_url ?? undefined,
    provenance: PROV_FROM_SQL[r.provenance] ?? "estimated",
    publishedAt: r.published_at,
    affects: r.affects ?? [],
  }));
}

/* Writes ----------------------------------------------------------------- */

export async function writeMission(m: Mission): Promise<void> {
  await pool().query(
    `INSERT INTO missions
       (id, name, strand, region, payout, duration_min, difficulty, crew_required,
        best_strategy, prerequisites, tips, image_url, provenance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, strand = EXCLUDED.strand, region = EXCLUDED.region,
       payout = EXCLUDED.payout, duration_min = EXCLUDED.duration_min,
       difficulty = EXCLUDED.difficulty, crew_required = EXCLUDED.crew_required,
       best_strategy = EXCLUDED.best_strategy, prerequisites = EXCLUDED.prerequisites,
       tips = EXCLUDED.tips, image_url = EXCLUDED.image_url,
       provenance = EXCLUDED.provenance, updated_at = now()`,
    [
      m.id,
      m.name,
      m.strand,
      m.region,
      Math.round(m.payout),
      m.duration,
      m.difficulty,
      m.crewRequired,
      m.bestStrategy,
      m.prerequisites,
      m.tips,
      m.image || null,
      PROV_TO_SQL[m.provenance],
    ],
  );
}

export async function writeAsset(a: Asset): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO assets
         (id, name, kind, region, price, daily_net, upkeep, unlock_level, note, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, kind = EXCLUDED.kind, region = EXCLUDED.region,
         price = EXCLUDED.price, daily_net = EXCLUDED.daily_net,
         upkeep = EXCLUDED.upkeep, unlock_level = EXCLUDED.unlock_level,
         note = EXCLUDED.note, provenance = EXCLUDED.provenance, updated_at = now()`,
      [
        a.id,
        a.name,
        a.category,
        a.region,
        Math.round(a.price),
        Math.round(a.dailyNet),
        Math.round(a.upkeep),
        a.unlockLevel,
        a.note,
        PROV_TO_SQL[a.provenance],
      ],
    );

    // Every price edit appends an observation. The series is the audit trail
    // for the tracker, so a correction that overwrote history would erase the
    // evidence behind every call the platform has made.
    await client.query(
      "INSERT INTO asset_prices (asset_id, price, provenance) VALUES ($1, $2, $3)",
      [a.id, Math.round(a.price), PROV_TO_SQL[a.provenance]],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Append to the audit trail.
 *
 * No ip_hash: the column exists for request-level events, and a content edit
 * is already attributed to an account. Hashing the editor's address as well
 * would be collecting more than the question needs answering.
 */
/**
 * Upsert a map pin.
 *
 * x and y are viewport percentages, not coordinates, and the database checks
 * the 0-100 range. Keeping that constraint in SQL rather than only in the form
 * is what stops an import putting a pin off the edge of the map.
 */
export async function writeMapPin(pin: MapPin): Promise<void> {
  await pool().query(
    `INSERT INTO map_locations (id, name, kind, region, x, y, detail, value, provenance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       region = EXCLUDED.region,
       x = EXCLUDED.x,
       y = EXCLUDED.y,
       detail = EXCLUDED.detail,
       value = EXCLUDED.value,
       provenance = EXCLUDED.provenance`,
    [
      pin.id, pin.name, pin.kind, pin.region,
      pin.x, pin.y, pin.detail, pin.value,
      PROV_TO_SQL[pin.provenance],
    ],
  );
}

/**
 * Upsert an intel entry and replace its cross-links.
 *
 * `affects` arrives as "type:id" pairs, because the join table constrains the
 * type and a flat id cannot say whether "nightclub" is an asset or a mission.
 * Anything without a recognised prefix is dropped rather than guessed at — a
 * wrong cross-link points the economy tracker at the wrong record.
 *
 * Both statements run in one transaction. Replacing the links outside one
 * would leave an entry with no cross-links at all if the second failed, which
 * reads as "this changed nothing" rather than as an error.
 */
export async function writeNews(
  item: NewsItem,
  affects: { type: string; id: string }[],
): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO news_items
         (id, title, summary, impact, category, source, source_url, provenance, published_at, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         impact = EXCLUDED.impact,
         category = EXCLUDED.category,
         source = EXCLUDED.source,
         source_url = EXCLUDED.source_url,
         provenance = EXCLUDED.provenance,
         published_at = EXCLUDED.published_at,
         updated_at = now()`,
      [
        item.id, item.title, item.summary, item.impact, item.category,
        item.source, item.sourceUrl ?? null,
        PROV_TO_SQL[item.provenance], item.publishedAt,
      ],
    );

    await client.query("DELETE FROM news_item_affects WHERE news_id = $1", [item.id]);
    for (const link of affects) {
      await client.query(
        `INSERT INTO news_item_affects (news_id, entity_type, entity_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [item.id, link.type, link.id],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function writeAudit(
  actorId: string | null,
  action: string,
  subject: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await pool().query(
    `INSERT INTO audit_log (actor_id, action, subject, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [actorId, action, subject, JSON.stringify(metadata)],
  );
}
