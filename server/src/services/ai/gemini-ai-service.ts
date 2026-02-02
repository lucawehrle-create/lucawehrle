import { GoogleGenerativeAI } from "@google/generative-ai";
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

/** Model used for Gemini native image generation. */
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

/** Extract a base64 data-URI from a Gemini image generation response. */
function extractImageFromResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
): string | null {
  const parts = result.response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inline = (part as any).inlineData as
      | { mimeType: string; data: string }
      | undefined;
    if (inline?.data) {
      return `data:${inline.mimeType};base64,${inline.data}`;
    }
  }
  return null;
}

/**
 * AI service using Google Gemini for text, vision, and image generation.
 */
export class GeminiAIService implements AIService {
  private genAI: GoogleGenerativeAI;
  private textModel: string;

  constructor(config: {
    geminiApiKey: string;
    openaiApiKey?: string;
    textModel?: string;
  }) {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.textModel = config.textModel ?? "gemini-2.0-flash";
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

    return withRetry(
      async () => {
        const imageModel = this.genAI.getGenerativeModel({
          model: GEMINI_IMAGE_MODEL,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await imageModel.generateContent({
          contents: [{ role: "user", parts: [{ text: `Generate an atmospheric scene image: ${fullPrompt}` }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          } as any,
        } as any);

        const imageUrl = extractImageFromResponse(result);
        if (imageUrl) {
          return {
            imageUrl,
            revisedPrompt: fullPrompt,
            generationTimeMs: Date.now() - start,
          };
        }

        // No image data returned — return empty so the client knows there's no image
        console.warn("[GeminiAIService] Scene image generation returned no image data");
        return {
          imageUrl: "",
          revisedPrompt: fullPrompt,
          generationTimeMs: Date.now() - start,
        };
      },
      2,
      2000,
    );
  }

  async generateItemImage(visualDescription: string, itemName: string): Promise<string | null> {
    try {
      return await withRetry(
        async () => {
          const model = this.genAI.getGenerativeModel({
            model: GEMINI_IMAGE_MODEL,
          });

          const prompt = `Generate a single RPG fantasy game item icon on a solid dark background (#1a1a2e). The item: "${itemName}". Visual details: ${visualDescription}. Style: detailed fantasy RPG item icon, painterly digital art style, glowing magical effects where appropriate, no text or labels, centered composition, 128x128 icon.`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            } as any,
          } as any);

          return extractImageFromResponse(result);
        },
        2,
        2000,
      );
    } catch (error) {
      console.error(
        "[GeminiAIService] Item image generation failed:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  async generatePortrait(description: string, race: string, charClass: string): Promise<string | null> {
    try {
      return await withRetry(
        async () => {
          const model = this.genAI.getGenerativeModel({
            model: GEMINI_IMAGE_MODEL,
          });

          const prompt = `Generate a fantasy RPG character portrait. Race: ${race}. Class: ${charClass}. Appearance: ${description}. Style: detailed fantasy portrait painting, dramatic lighting, dark moody background, shoulders-up framing, no text or labels, high quality digital art.`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            } as any,
          } as any);

          return extractImageFromResponse(result);
        },
        2,
        2000,
      );
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
