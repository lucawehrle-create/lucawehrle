/**
 * Server configuration loaded from environment variables.
 *
 * Required for live AI:
 *   ANTHROPIC_API_KEY  – for text generation + object scanning (Claude)
 *
 * Optional:
 *   OPENAI_API_KEY     – for image generation (DALL-E 3). Without it, placeholder images are used.
 *   AI_TEXT_MODEL      – Claude model to use (default: claude-sonnet-4-20250514)
 *   PORT               – server port (default: 4000)
 */
export interface AppConfig {
  port: number;
  anthropicApiKey: string | undefined;
  openaiApiKey: string | undefined;
  aiTextModel: string;
  /** If true, a real AI key is configured and live mode is active */
  liveAI: boolean;
}

export function loadConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  return {
    port: parseInt(process.env.PORT ?? "4000", 10),
    anthropicApiKey,
    openaiApiKey,
    aiTextModel: process.env.AI_TEXT_MODEL ?? "claude-sonnet-4-20250514",
    liveAI: !!anthropicApiKey,
  };
}
