import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { AiRefusalError, type AiProvider } from "@/lib/ai/provider";
import { CreatorIdeaSchema, PlanSchema } from "@/lib/ai/schemas";
import {
  PLAN_INSTRUCTION,
  SYSTEM_PROMPT,
  datasetDigest,
  profileBlock,
} from "@/lib/ai/prompts";
import type { CreatorIdea, MoneyPlan, PlayerProfile } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * Claude provider, written against @anthropic-ai/sdk 0.71.
 *
 * Request shape notes:
 *  - `thinking` is omitted. On Opus 5 that runs adaptive thinking, which is
 *    what we want, and it avoids pinning a config shape that is still moving.
 *  - Structured output goes through `output_format` with the beta zod helper,
 *    which is where this SDK version puts it. `output_config` carries effort.
 *  - The system prompt plus the dataset digest is a frozen prefix and holds
 *    the cache breakpoint. Only the profile and the question vary per request,
 *    so the cache hits across every user.
 *  - Streaming is used for chat so a long answer cannot hit an HTTP timeout.
 *
 * Not yet wired, both need a newer SDK than the one pinned here:
 *  - server-side refusal fallbacks (`fallbacks: "default"`)
 *  - `stop_details.category` on a refusal, for a more specific message
 */
function client() {
  // Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login`
  // profile. Never hardcode a key.
  return new Anthropic();
}

const stablePrefix = () => `${SYSTEM_PROMPT}\n\n---\n\nDATASET\n\n${datasetDigest()}`;

export const claudeProvider: AiProvider = {
  id: "claude",
  label: "Claude Opus 5",

  async *chat({ messages, profile, signal }) {
    const stream = client().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: stablePrefix(),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: profileBlock(profile) },
          {
            role: "assistant",
            content: "Profile noted. Ask me anything about your route to the goal.",
          },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") throw new AiRefusalError(null);
  },

  async generatePlan({ profile }): Promise<MoneyPlan> {
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "high" },
      output_format: betaZodOutputFormat(PlanSchema),
      system: [
        {
          type: "text",
          text: stablePrefix(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: `${profileBlock(profile)}\n\n${PLAN_INSTRUCTION}` },
      ],
    });

    if (response.stop_reason === "refusal") throw new AiRefusalError(null);

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("The model returned a plan that failed schema validation.");
    }

    return {
      id: crypto.randomUUID(),
      objective: profile.goal,
      startingCash: profile.currentMoney,
      strategy: profile.playstyle,
      summary: parsed.summary,
      steps: parsed.steps.map((s) => ({ ...s, done: false })),
      risks: parsed.risks,
      provenance: "ai-projection",
      generatedBy: "claude",
      createdAt: new Date().toISOString(),
    };
  },

  async creatorIdea({ topic }): Promise<CreatorIdea> {
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_format: betaZodOutputFormat(CreatorIdeaSchema),
      system: [
        {
          type: "text",
          text: stablePrefix(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Produce a content package for a GTA 6 creator covering: ${topic}

Rules:
- Titles must be specific and claim something checkable. No clickbait the video cannot deliver.
- The hook is the first spoken line of the video. One sentence.
- The thumbnail concept describes a real composition, not a mood.
- SEO keywords are what a player would actually type into search.
- No emoji, no em dashes.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") throw new AiRefusalError(null);

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("The model returned an idea that failed schema validation.");
    }

    return { ...parsed, momentum: 0, provenance: "ai-projection" };
  },
};

export type { PlayerProfile };
