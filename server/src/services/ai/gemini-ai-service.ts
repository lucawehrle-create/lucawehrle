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
    const userPrompt = buildTextPrompt(request);

    const model = this.genAI.getGenerativeModel({
      model: this.textModel,
      systemInstruction: DUNGEON_MASTER_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userPrompt);
    const rawText = result.response.text();

    const parsed = parseJSON(rawText, TEXT_GENERATION_FALLBACK);

    // Gemini doesn't expose exact token counts in the same way,
    // so we estimate from the response metadata if available.
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

    return {
      imageUrl: response.data[0].url ?? "",
      revisedPrompt: response.data[0].revised_prompt ?? request.prompt,
      generationTimeMs: Date.now() - start,
    };
  }

  async analyzeObject(request: ObjectScanRequest): Promise<ObjectScanResponse> {
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
      // For URL-based images, tell Gemini about the image via text
      // (Gemini supports inline data but not arbitrary URLs directly)
      parts = [
        `Image URL: ${request.imageData}\n\nAnalyze this real-world object and transform it into a fantasy RPG item. Preserve ALL visual details exactly (stickers, labels, proportions, markings).`,
      ];
    }

    const result = await model.generateContent(parts);
    const rawText = result.response.text();

    return parseJSON(rawText, OBJECT_SCAN_FALLBACK);
  }
}
