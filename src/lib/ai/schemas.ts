import { z } from "zod";

/**
 * Structured output schemas. The model is constrained to these shapes, so the
 * UI never has to parse prose or guard against a missing field.
 */

export const PlanStepSchema = z.object({
  order: z.number().int().min(1),
  title: z.string(),
  detail: z.string(),
  kind: z.enum(["mission", "purchase", "investment", "grind"]),
  estMinutes: z.number().int().min(1),
  estProfit: z.number(),
  requiredCash: z.number().min(0),
});

export const PlanSchema = z.object({
  summary: z.string(),
  steps: z.array(PlanStepSchema).min(3).max(8),
  risks: z.array(z.string()).min(2).max(5),
});

export type PlanPayload = z.infer<typeof PlanSchema>;

/**
 * One beat of a video script.
 *
 * Timestamped so a creator can see the pacing at a glance, and split from the
 * narration so the on-screen direction is not buried inside the voiceover.
 */
export const ScriptBeatSchema = z.object({
  /** Seconds from the start of the video. */
  at: z.number().int().min(0).max(3600),
  label: z.string(),
  /** What the creator says. Written to be read aloud. */
  narration: z.string(),
  /** What is on screen while they say it. */
  onScreen: z.string(),
});

export const CreatorIdeaSchema = z.object({
  topic: z.string(),
  titles: z.array(z.string()).min(3).max(5),
  hook: z.string(),
  angle: z.string(),
  thumbnailConcept: z.string(),
  seoKeywords: z.array(z.string()).min(3).max(8),
  /** Full script. Short-form runs 4 to 6 beats, long-form 6 to 10. */
  script: z.array(ScriptBeatSchema).min(4).max(10),
  /** Total runtime in seconds, so the creator can check it fits the format. */
  runtimeSeconds: z.number().int().min(15).max(1800),
});

export type CreatorIdeaPayload = z.infer<typeof CreatorIdeaSchema>;
