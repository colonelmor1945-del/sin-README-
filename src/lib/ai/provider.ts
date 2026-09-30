import type { ChatMessage, CreatorIdea, MoneyPlan, PlayerProfile } from "@/lib/types";

/**
 * AI provider abstraction.
 *
 * Every AI capability the product needs is declared here. Swapping vendors
 * means adding one file that satisfies this interface and changing the
 * selector in ./index.ts. No feature code imports a vendor SDK directly.
 */
export interface AiProvider {
  readonly id: "claude" | "heuristic";
  readonly label: string;

  /**
   * Streams the assistant reply as plain text chunks.
   *
   * onUsage, when given, is called once with real token usage after the
   * reply finishes — the caller's only way to find out what a chat request
   * actually cost, since that is not knowable before the model answers. It
   * may return a promise; callers that award it should await it, which the
   * built-in providers do before this generator completes.
   */
  chat(input: {
    messages: ChatMessage[];
    profile: PlayerProfile;
    signal?: AbortSignal;
    onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void | Promise<void>;
  }): AsyncIterable<string>;

  /** Produces a structured, validated plan. Never free text. */
  generatePlan(input: { profile: PlayerProfile }): Promise<MoneyPlan>;

  /** Creator Lab: titles, hooks, thumbnail concepts and SEO for one topic. */
  creatorIdea(input: { topic: string }): Promise<CreatorIdea>;
}

/** Thrown when the model declines. Surfaced to the user as a plain message. */
export class AiRefusalError extends Error {
  constructor(public category: string | null) {
    super("The model declined to answer this request.");
    this.name = "AiRefusalError";
  }
}
