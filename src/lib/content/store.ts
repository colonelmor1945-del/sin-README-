import "server-only";

import { ASSETS } from "@/lib/data/assets";
import { MISSIONS } from "@/lib/data/missions";
import { MAP_PINS } from "@/lib/data/map";
import type { Asset, MapPin, Mission } from "@/lib/types";

/**
 * Content store.
 *
 * The dataset currently lives in TypeScript files, which means changing a price
 * is a commit and a deploy. On launch day that is the difference between being
 * useful in an hour and being useful next week.
 *
 * This puts a read layer in front of it. When a database is configured, content
 * comes from there and can be edited live. When it is not, the seed modules are
 * served read-only, so a fresh checkout still has a full dataset and the editor
 * says plainly why it cannot save.
 *
 * The seeds stay in the repository on purpose even after the database lands.
 * They are the fixture the tests and a local dev run need, and they are the
 * fallback if the database is unreachable: a platform that shows nothing
 * because Postgres blinked is worse than one showing last week's numbers with
 * their provenance intact.
 */

export type ContentKind = "mission" | "asset" | "map";

export interface ContentSource {
  /** True when edits can be saved. */
  writable: boolean;
  /** Why not, when not. */
  reason?: string;
}

export function contentSource(): ContentSource {
  if (!process.env.DATABASE_URL) {
    return {
      writable: false,
      reason:
        "Content is being served from the seed files in the repository. Set DATABASE_URL and apply the schema to edit it here instead of in a commit.",
    };
  }
  return { writable: true };
}

/* Reads ------------------------------------------------------------------ */

/**
 * Reads fall back to the seeds on any failure, deliberately.
 *
 * A missions page that renders nothing because the database timed out is worse
 * than one rendering the seeded set, since every figure carries its provenance
 * either way and nothing here is presented as live.
 */
async function fromDatabase<T>(
  run: () => Promise<T[]>,
  fallback: T[],
  what: string,
): Promise<T[]> {
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const rows = await run();
    return rows.length > 0 ? rows : fallback;
  } catch (error) {
    console.warn(`[content] ${what} read failed, serving seeds`, error);
    return fallback;
  }
}

export async function getMissions(): Promise<Mission[]> {
  return fromDatabase(
    async () => {
      const { readMissions } = await import("@/lib/content/postgres");
      return readMissions();
    },
    MISSIONS,
    "missions",
  );
}

export async function getAssets(): Promise<Asset[]> {
  return fromDatabase(
    async () => {
      const { readAssets } = await import("@/lib/content/postgres");
      return readAssets();
    },
    ASSETS,
    "assets",
  );
}

export async function getMapPins(): Promise<MapPin[]> {
  return fromDatabase(
    async () => {
      const { readMapPins } = await import("@/lib/content/postgres");
      return readMapPins();
    },
    MAP_PINS,
    "map locations",
  );
}

/* Writes ----------------------------------------------------------------- */

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Saving requires a database. There is no filesystem write path, on purpose:
 * an editor that rewrote source files would work locally, do nothing on a
 * read-only production filesystem, and quietly diverge from the repository.
 */
export async function saveMission(mission: Mission): Promise<SaveResult> {
  const source = contentSource();
  if (!source.writable) return { ok: false, error: source.reason };

  try {
    const { writeMission } = await import("@/lib/content/postgres");
    await writeMission(mission);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function saveAsset(asset: Asset): Promise<SaveResult> {
  const source = contentSource();
  if (!source.writable) return { ok: false, error: source.reason };

  try {
    const { writeAsset } = await import("@/lib/content/postgres");
    await writeAsset(asset);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function saveMapPin(pin: MapPin): Promise<SaveResult> {
  const source = contentSource();
  if (!source.writable) return { ok: false, error: source.reason };

  try {
    const { writeMapPin } = await import("@/lib/content/postgres");
    await writeMapPin(pin);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
