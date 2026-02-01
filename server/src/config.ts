/** Which AI provider to use for text generation + vision */
export type AIProvider = "anthropic" | "gemini" | "mock";

/**
 * Server configuration loaded from environment variables.
 *
 * For live AI, set ONE of:
 *   ANTHROPIC_API_KEY  – uses Claude for text + vision
 *   GEMINI_API_KEY     – uses Google Gemini for text + vision
 *
 * Optional:
 *   OPENAI_API_KEY     – for image generation (DALL-E 3). Without it, placeholder images are used.
 *   AI_PROVIDER        – force a provider: "anthropic", "gemini", or "mock" (auto-detected if omitted)
 *   AI_TEXT_MODEL      – override the model name (provider-specific)
 *   PORT               – server port (default: 4000)
 */
export interface AppConfig {
  port: number;
  aiProvider: AIProvider;
  anthropicApiKey: string | undefined;
  geminiApiKey: string | undefined;
  openaiApiKey: string | undefined;
  aiTextModel: string | undefined;
}

export function loadConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Determine AI provider: explicit setting > auto-detect from keys > mock
  let aiProvider: AIProvider;
  const explicit = process.env.AI_PROVIDER?.toLowerCase();

  if (explicit === "anthropic" || explicit === "gemini" || explicit === "mock") {
    aiProvider = explicit;
  } else if (anthropicApiKey) {
    aiProvider = "anthropic";
  } else if (geminiApiKey) {
    aiProvider = "gemini";
  } else {
    aiProvider = "mock";
  }

  return {
    port: parseInt(process.env.PORT ?? "4000", 10),
    aiProvider,
    anthropicApiKey,
    geminiApiKey,
    openaiApiKey,
    aiTextModel: process.env.AI_TEXT_MODEL,
  };
}
