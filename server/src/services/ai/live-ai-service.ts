import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type {
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ObjectScanRequest,
  ObjectScanResponse,
} from "@aetheria/shared";
import type { AIService } from "./ai-service.js";
import {
  DUNGEON_MASTER_SYSTEM_PROMPT,
  OBJECT_SCAN_SYSTEM_PROMPT,
  TEXT_GENERATION_FALLBACK,
  OBJECT_SCAN_FALLBACK,
  buildTextPrompt,
  buildImageStyleHint,
  parseJSON,
} from "./prompts.js";

/**
 * AI service using Anthropic Claude (text + vision) and OpenAI DALL-E 3 (images).
 */
export class LiveAIService implements AIService {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private textModel: string;
  private imageEnabled: boolean;

  constructor(config: {
    anthropicApiKey: string;
    openaiApiKey?: string;
    textModel?: string;
  }) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    this.openai = new OpenAI({ apiKey: config.openaiApiKey ?? "" });
    this.textModel = config.textModel ?? "claude-sonnet-4-20250514";
    this.imageEnabled = !!config.openaiApiKey;
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const userPrompt = buildTextPrompt(request);

    const response = await this.anthropic.messages.create({
      model: this.textModel,
      max_tokens: 1024,
      system: DUNGEON_MASTER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = parseJSON(rawText, TEXT_GENERATION_FALLBACK);

    return {
      narrative: parsed.narrative,
      mood: parsed.mood,
      options: parsed.options,
      imagePrompt: parsed.imagePrompt,
      events: parsed.events ?? [],
      tokenUsage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.imageEnabled) {
      const w = request.width ?? 1024;
      const h = request.height ?? 1024;
      return {
        imageUrl: `https://placehold.co/${w}x${h}/1a1a2e/e0e0e0?text=Scene`,
        revisedPrompt: request.prompt,
        generationTimeMs: 0,
      };
    }

    const start = Date.now();
    const styleHint = buildImageStyleHint(request.style);
    const fullPrompt = `${request.prompt}. ${styleHint}. Character: ${request.characterAppearance}. Mood: ${request.mood}. No text or UI elements in the image.`;

    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      quality: request.modelTier === "premium" || request.modelTier === "hd" ? "hd" : "standard",
    });

    const img = response.data?.[0];
    return {
      imageUrl: img?.url ?? "",
      revisedPrompt: img?.revised_prompt ?? request.prompt,
      generationTimeMs: Date.now() - start,
    };
  }

  async generateItemImage(visualDescription: string, itemName: string): Promise<string | null> {
    if (!this.imageEnabled) return null;

    try {
      const prompt = `RPG fantasy game item icon: "${itemName}". ${visualDescription}. Dark background, centered, detailed fantasy art, no text.`;
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });
      return response.data?.[0]?.url ?? null;
    } catch (error) {
      console.error("[LiveAIService] Item image generation failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  async analyzeObject(request: ObjectScanRequest): Promise<ObjectScanResponse> {
    const imageContent: Anthropic.ImageBlockParam =
      request.format === "url"
        ? { type: "image", source: { type: "url", url: request.imageData } }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: request.imageData,
            },
          };

    const response = await this.anthropic.messages.create({
      model: this.textModel,
      max_tokens: 1024,
      system: OBJECT_SCAN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            {
              type: "text",
              text: "Analyze this real-world object and transform it into a fantasy RPG item. Preserve ALL visual details exactly (stickers, labels, proportions, markings).",
            },
          ],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return parseJSON(rawText, OBJECT_SCAN_FALLBACK);
  }
}
