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

  async generateItemImage(
    visualDescription: string,
    itemName: string,
    rarity?: string,
  ): Promise<string | null> {
    if (!this.imageEnabled) return null;

    try {
      // Rarity affects visual quality and magical effects
      const rarityEffects: Record<string, string> = {
        common: "plain, well-worn, functional design",
        uncommon: "well-crafted, polished, subtle decorative details",
        rare: "magical glow, ethereal shimmer, intricate engravings",
        epic: "radiant magical aura, glowing runes, ornate golden trim",
        legendary: "divine radiance, otherworldly presence, elaborate mythical craftsmanship",
        artifact: "reality-bending effects, god-forged, cosmic energy emanating",
      };
      const rarityHint = rarityEffects[rarity ?? "common"] ?? rarityEffects.common;

      const prompt = `RPG fantasy game item on solid dark background (#1a1a2e): "${itemName}". ${visualDescription}. Quality: ${rarityHint}. Centered composition, detailed fantasy digital art, no text or labels, subtle lighting from item's inherent properties.`;
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: rarity === "legendary" || rarity === "artifact" || rarity === "epic" ? "hd" : "standard",
      });
      return response.data?.[0]?.url ?? null;
    } catch (error) {
      console.error("[LiveAIService] Item image generation failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  async generatePortrait(
    description: string,
    race: string,
    charClass: string,
    traits?: string[],
    backstory?: string,
  ): Promise<string | null> {
    if (!this.imageEnabled) return null;

    try {
      // Class-specific visual hints
      const classVisuals: Record<string, string> = {
        warrior: "battle-hardened, confident stance, strong jaw",
        mage: "wise eyes, mystical presence, arcane symbols reflected",
        rogue: "sharp cunning gaze, half-smile, shadows in background",
        cleric: "serene expression, holy light, compassionate eyes",
        ranger: "alert watchful eyes, weathered skin, nature in background",
        bard: "charismatic smile, expressive features, musical charm",
        paladin: "noble bearing, righteous determination, inner light",
      };
      const classHint = classVisuals[charClass] ?? "";

      // Personality traits influence expression
      const traitExpression = traits?.length
        ? `facial expression reflecting personality: ${traits.slice(0, 2).join(" and ")}`
        : "";

      // Backstory can hint at visible history
      const backstoryHint = backstory?.includes("Krieg") || backstory?.includes("Kampf")
        ? "bearing battle scars of past conflicts"
        : backstory?.includes("Akademie") || backstory?.includes("Studium")
        ? "scholarly refinement in bearing"
        : "";

      const prompt = `Fantasy RPG character portrait: ${race} ${charClass}. ${description}. ${classHint}. ${traitExpression}. ${backstoryHint}. Dark moody background with subtle atmosphere, cinematic lighting from above-left, shoulders-up framing, detailed fantasy digital painting style, painterly brushstrokes, no text or UI elements.`;
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: "hd",
      });
      return response.data?.[0]?.url ?? null;
    } catch (error) {
      console.error("[LiveAIService] Portrait generation failed:", error instanceof Error ? error.message : error);
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

  async generateJourneyNarrative(
    characterName: string,
    characterBackstory: string,
    characterTraits: string[],
    scenarioTitle: string,
    scenarioSetting: string,
  ): Promise<string> {
    const prompt = `Du bist ein Erzähler für ein Fantasy-RPG. Schreibe einen kurzen, atmosphärischen Text (2-3 Sätze, maximal 60 Wörter) auf Deutsch, der erklärt, WIE der Charakter an diesen Ort gekommen ist.

CHARAKTER:
- Name: ${characterName}
- Hintergrund: ${characterBackstory}
- Eigenschaften: ${characterTraits.join(", ")}

SZENARIO:
- Titel: "${scenarioTitle}"
- Setting: ${scenarioSetting}

REGELN:
- Schreibe in der 3. Person ("${characterName} hatte...")
- Verbinde die Charaktergeschichte mit dem Szenario
- Atmosphärisch und immersiv
- KEIN JSON, nur der reine Text
- Auf Deutsch`;

    const response = await this.anthropic.messages.create({
      model: this.textModel,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (!text) {
      return `${characterName} hatte lange nach diesem Ort gesucht. "${scenarioTitle}" — ein Name, der in Tavernen geflüstert wurde. Nun stand das Abenteuer unmittelbar bevor.`;
    }

    return text;
  }
}
