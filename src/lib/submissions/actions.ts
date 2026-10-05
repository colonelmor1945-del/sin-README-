"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { getStore } from "@/lib/db/store";
import { claimKey } from "@/lib/ingest/pipeline";
import { BUDGETS, rateLimit } from "@/lib/ratelimit";

/**
 * The public submission form's server action.
 *
 * No account required — the whole point is that anyone who has seen a real
 * source can hand it over — so the only thing standing between this and spam
 * is a source URL requirement, a rate limit keyed on IP (mirroring
 * auth/actions.ts, for the same reason: the attacker controls every other
 * field), and the ordinary review queue everything else already goes
 * through. Nothing submitted here reaches the dataset directly; it becomes a
 * candidate the same way a Reddit post does.
 */

export interface SubmitState {
  error?: string;
  field?: "claim" | "sourceUrl";
  success?: boolean;
  values?: { claim?: string; sourceUrl?: string; submittedBy?: string };
}

const Claim = z
  .string()
  .trim()
  .min(12, "Say a bit more about what this claim is.")
  .max(280, "Keep it to one claim, under 280 characters.");

const SourceUrl = z
  .string()
  .trim()
  .max(2000)
  .url("That does not look like a URL.")
  .refine((url) => /^https?:\/\//i.test(url), "The link has to be http or https.");

const SubmittedBy = z
  .string()
  .trim()
  .max(32, "Keep the name or handle under 32 characters.")
  .optional()
  .transform((v) => (v ? v : undefined));

const SubmissionInput = z.object({
  claim: Claim,
  sourceUrl: SourceUrl,
  submittedBy: SubmittedBy,
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Not salted: this codebase has no shared secret to key it with (session
 * tokens are hashed the same unsalted way — see auth/password.ts — because
 * the token itself, not the hash, carries the entropy). An IP does not carry
 * that entropy, so this is best-effort abuse tracing, not a strong
 * pseudonym. It is never rendered, only compared for corroboration grouping.
 */
const hashIp = (ip: string) => crypto.createHash("sha256").update(ip).digest("hex");

export async function submitClaim(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const typed = {
    claim: String(formData.get("claim") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    submittedBy: String(formData.get("submittedBy") ?? ""),
  };

  const ip = await clientIp();
  const limit = rateLimit(`submission:${ip}`, BUDGETS.submission);
  if (!limit.ok) {
    return {
      error: "Too many submissions from here for now. Try again in a while.",
      values: typed,
    };
  }

  const parsed = SubmissionInput.safeParse({
    claim: formData.get("claim"),
    sourceUrl: formData.get("sourceUrl"),
    submittedBy: formData.get("submittedBy") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue.message,
      field: issue.path[0] as "claim" | "sourceUrl",
      values: typed,
    };
  }

  await getStore().createSubmission({
    claim: parsed.data.claim,
    sourceUrl: parsed.data.sourceUrl,
    submittedBy: parsed.data.submittedBy ?? null,
    claimKey: claimKey(parsed.data.claim),
    ipHash: ip === "unknown" ? null : hashIp(ip),
  });

  return { success: true };
}
