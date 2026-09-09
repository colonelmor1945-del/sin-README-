"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import type { Tier } from "@/lib/types";

/**
 * Development-only plan switch.
 *
 * Real tier changes come from a signature-verified payment webhook and nowhere
 * else. This exists so the Pro and Elite surfaces are reviewable before the
 * payment providers are wired, and it refuses to run outside development.
 */
export async function switchTier(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Plan changes must come from a verified payment.");
  }

  const raw = String(formData.get("tier") ?? "");
  if (raw !== "free" && raw !== "pro" && raw !== "elite") return;

  const { userId, account } = await requireSession();
  await getStore().upsertAccount({ ...account, tier: raw as Tier });

  revalidatePath("/dashboard", "layout");
}
