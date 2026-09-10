/**
 * Resolve OpenAI credentials for local CCT.
 * Prefer standard OPENAI_* vars; keep AI_INTEGRATIONS_* as optional aliases.
 */
export function getOpenAIClientOptions(): { apiKey: string; baseURL?: string } {
  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set for local CCT (AI_INTEGRATIONS_OPENAI_API_KEY is also accepted).",
    );
  }

  const baseURL =
    process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  return baseURL ? { apiKey, baseURL } : { apiKey };
}
