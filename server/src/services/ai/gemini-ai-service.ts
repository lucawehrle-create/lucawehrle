import { GoogleGenerativeAI } from "@google/generative-ai";
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

/** Retry helper with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[AI Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          error instanceof Error ? error.message : error,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * AI service using Google Gemini (text + vision) and OpenAI DALL-E 3 (images).
 */
export class GeminiAIService implements AIService {
  private genAI: GoogleGenerativeAI;
  private openai: OpenAI;
  private textModel: string;
  private imageEnabled: boolean;

  constructor(config: {
    geminiApiKey: string;
    openaiApiKey?: string;
    textModel?: string;
  }) {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.openai = new OpenAI({ apiKey: config.openaiApiKey ?? "" });
    this.textModel = config.textModel ?? "gemini-2.0-flash";
    this.imageEnabled = !!config.openaiApiKey;
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    return withRetry(async () => {
      const userPrompt = buildTextPrompt(request);

      const model = this.genAI.getGenerativeModel({
        model: this.textModel,
        systemInstruction: DUNGEON_MASTER_SYSTEM_PROMPT,
      });

      const result = await model.generateContent(userPrompt);
      const rawText = result.response.text();

      const parsed = parseJSON(rawText, TEXT_GENERATION_FALLBACK);

      const usage = result.response.usageMetadata;

      return {
        narrative: parsed.narrative,
        mood: parsed.mood,
        options: parsed.options,
        imagePrompt: parsed.imagePrompt,
        events: parsed.events ?? [],
        tokenUsage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
      };
    });
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    const styleHint = buildImageStyleHint(request.style);
    const fullPrompt = `${request.prompt}. ${styleHint}. Character: ${request.characterAppearance}. Mood: ${request.mood}. No text or UI elements in the image.`;

    // Try Gemini native image generation first (faster, returns base64)
    try {
      const imageModel = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp-image-generation",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await imageModel.generateContent({
        contents: [{ role: "user", parts: [{ text: `Generate an atmospheric scene image: ${fullPrompt}` }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        } as any,
      } as any);

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inline = (part as any).inlineData as
          | { mimeType: string; data: string }
          | undefined;
        if (inline?.data) {
          return {
            imageUrl: `data:${inline.mimeType};base64,${inline.data}`,
            revisedPrompt: fullPrompt,
            generationTimeMs: Date.now() - start,
          };
        }
      }
    } catch (error) {
      console.error(
        "[GeminiAIService] Gemini scene image generation failed, trying DALL-E fallback:",
        error instanceof Error ? error.message : error,
      );
    }

    // Fallback to DALL-E if Gemini failed or returned no image
    if (!this.imageEnabled) {
      const w = request.width ?? 1024;
      const h = request.height ?? 1024;
      return {
        imageUrl: `https://placehold.co/${w}x${h}/1a1a2e/e0e0e0?text=Scene`,
        revisedPrompt: request.prompt,
        generationTimeMs: 0,
      };
    }

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
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp-image-generation",
      });

      const prompt = `Generate a single RPG fantasy game item icon on a solid dark background (#1a1a2e). The item: "${itemName}". Visual details: ${visualDescription}. Style: detailed fantasy RPG item icon, painterly digital art style, glowing magical effects where appropriate, no text or labels, centered composition, 128x128 icon.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        } as any, // responseModalities may not be in the SDK type yet
      } as any);

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inline = (part as any).inlineData as
          | { mimeType: string; data: string }
          | undefined;
        if (inline?.data) {
          return `data:${inline.mimeType};base64,${inline.data}`;
        }
      }

      // Fallback: if DALL-E available, try that
      if (this.imageEnabled) {
        return this.generateItemImageWithDalle(visualDescription, itemName);
      }
      return null;
    } catch (error) {
      console.error(
        "[GeminiAIService] Gemini image generation failed, trying fallback:",
        error instanceof Error ? error.message : error,
      );
      // Fallback to DALL-E if available
      if (this.imageEnabled) {
        try {
          return await this.generateItemImageWithDalle(visualDescription, itemName);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private async generateItemImageWithDalle(
    visualDescription: string,
    itemName: string,
  ): Promise<string | null> {
    const prompt = `RPG fantasy game item icon: "${itemName}". ${visualDescription}. Dark background, centered, detailed fantasy art, no text.`;
    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    return response.data?.[0]?.url ?? null;
  }

  async generatePortrait(description: string, race: string, charClass: string): Promise<string | null> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp-image-generation",
      });

      const prompt = `Generate a fantasy RPG character portrait. Race: ${race}. Class: ${charClass}. Appearance: ${description}. Style: detailed fantasy portrait painting, dramatic lighting, dark moody background, shoulders-up framing, no text or labels, high quality digital art.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        } as any,
      } as any);

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inline = (part as any).inlineData as
          | { mimeType: string; data: string }
          | undefined;
        if (inline?.data) {
          return `data:${inline.mimeType};base64,${inline.data}`;
        }
      }

      // Fallback to DALL-E
      if (this.imageEnabled) {
        const dallePrompt = `Fantasy RPG character portrait: ${race} ${charClass}. ${description}. Dark background, dramatic lighting, shoulders-up, detailed digital art, no text.`;
        const response = await this.openai.images.generate({
          model: "dall-e-3",
          prompt: dallePrompt.slice(0, 4000),
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });
        return response.data?.[0]?.url ?? null;
      }
      return null;
    } catch (error) {
      console.error("[GeminiAIService] Portrait generation failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  async analyzeObject(request: ObjectScanRequest): Promise<ObjectScanResponse> {
    return withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.textModel,
        systemInstruction: OBJECT_SCAN_SYSTEM_PROMPT,
      });

      let parts: Parameters<typeof model.generateContent>[0];

      if (request.format === "base64") {
        parts = [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: request.imageData,
            },
          },
          "Analyze this real-world object and transform it into a fantasy RPG item. Preserve ALL visual details exactly (stickers, labels, proportions, markings).",
        ];
      } else {
        parts = [
          `Image URL: ${request.imageData}\n\nAnalyze this real-world object and transform it into a fantasy RPG item. Preserve ALL visual details exactly (stickers, labels, proportions, markings).`,
        ];
      }

      const result = await model.generateContent(parts);
      const rawText = result.response.text();

      return parseJSON(rawText, OBJECT_SCAN_FALLBACK);
    });
  }
}
