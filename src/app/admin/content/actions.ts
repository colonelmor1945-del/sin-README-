"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { saveAsset, saveMission } from "@/lib/content/store";
import type { Asset, Mission } from "@/lib/types";

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

const Provenance = z.enum(["verified", "community", "estimated", "ai-projection"]);

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
  await requireAdmin();

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

  revalidatePath("/dashboard/missions");
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function updateAsset(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  await requireAdmin();

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

  revalidatePath("/dashboard/economy");
  revalidatePath("/admin/content");
  return { ok: true };
}
