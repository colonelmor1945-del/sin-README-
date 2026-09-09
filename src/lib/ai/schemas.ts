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

export const CreatorIdeaSchema = z.object({
  topic: z.string(),
  titles: z.array(z.string()).min(3).max(5),
  hook: z.string(),
  angle: z.string(),
  thumbnailConcept: z.string(),
  seoKeywords: z.array(z.string()).min(3).max(8),
});

export type CreatorIdeaPayload = z.infer<typeof CreatorIdeaSchema>;
