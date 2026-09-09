import "server-only";

import { claudeProvider } from "@/lib/ai/claude";
import { heuristicProvider } from "@/lib/ai/heuristic";
import type { AiProvider } from "@/lib/ai/provider";

/**
 * Provider selection. The only place in the codebase that decides which
 * vendor runs. Adding a provider means adding a file and one branch here.
 */
export function getAiProvider(): AiProvider {
  const hasCredential =
    Boolean(process.env.ANTHROPIC_API_KEY) || Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
  return hasCredential ? claudeProvider : heuristicProvider;
}

export { AiRefusalError } from "@/lib/ai/provider";
export type { AiProvider } from "@/lib/ai/provider";
