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

/**
 * System prompt that turns Claude into a Dungeon Master.
 * It instructs the model on the exact JSON format we need.
 */
const DUNGEON_MASTER_SYSTEM_PROMPT = `You are the Dungeon Master of "Aetheria AI", an immersive text-adventure RPG.
Your job is to narrate a living, breathing fantasy world that reacts to the player's choices.

RULES:
- Write vivid, atmospheric narrative in 2nd person ("You see...", "You hear...").
- Keep narrative to 2-4 paragraphs (80-200 words). Be concise but evocative.
- Always offer 2-4 action options that feel meaningfully different.
- Each option must have a type (combat/social/exploration/skill/magic/item), and a difficultyClass (5-25).
- If the player's action involves a dice roll result, incorporate the outcome naturally into the story.
- Set the mood based on the scene (combat, exploration, dialogue, mystery, safe, danger, celebration, sorrow).
- Generate an image prompt that describes the current scene for an AI image generator. Include the character's appearance.
- Detect game events: npc_met, item_acquired, quest_start, combat_start, combat_end, etc.
- Stay consistent with prior context and memories provided.
- Never break character. Never mention you are an AI.
- The story should be appropriate for ages 13+ (no explicit content).

You MUST respond with valid JSON in exactly this format:
{
  "narrative": "The story text...",
  "mood": "exploration",
  "options": [
    {"text": "Option description", "type": "combat", "requiredAbility": "strength", "difficultyClass": 14},
    {"text": "Option description", "type": "social", "requiredAbility": "charisma", "difficultyClass": 12}
  ],
  "imagePrompt": "A detailed scene description for image generation...",
  "events": [
    {"type": "npc_met", "payload": {"npc": "NPC Name"}}
  ]
}

Valid mood values: combat, exploration, dialogue, mystery, safe, danger, celebration, sorrow
Valid option types: combat, social, exploration, skill, magic, item
Valid requiredAbility: strength, dexterity, constitution, intelligence, wisdom, charisma
Valid event types: narrative_update, combat_start, combat_end, item_acquired, item_lost, level_up, npc_met, quest_start, quest_complete, character_death

Respond ONLY with the JSON object, no markdown fences, no extra text.`;

/**
 * System prompt for analyzing scanned real-world objects via vision.
 */
const OBJECT_SCAN_SYSTEM_PROMPT = `You are an object analyzer for the RPG game "Aetheria AI".
A player has scanned a real-world object with their camera.
Your job is to analyze it and transform it into a fantasy RPG item.

CRITICAL: Preserve the EXACT visual details of the scanned object:
- Stickers, labels, markings, text on the object
- Colors, patterns, textures
- Shape and proportions
- Any distinguishing features

The in-game item should clearly be THIS specific object, reimagined in a fantasy setting.
For example: a cardboard box with a specific sticker becomes "An enchanted chest bearing the sigil of [sticker description]".

Respond with valid JSON:
{
  "detectedLabel": "What the object is in reality",
  "detailedDescription": "Thorough description preserving all visual details",
  "visualFeatures": ["feature1", "feature2", "feature3"],
  "proportions": {"width": 1.0, "height": 0.6, "depth": 0.4, "unit": "relative"},
  "confidence": 0.9,
  "suggestedGameItem": {
    "name": "Fantasy RPG item name",
    "description": "In-game item description that references the real object's visual details",
    "category": "scanned_object",
    "rarity": "uncommon",
    "properties": {
      "weight": 2,
      "value": 50,
      "effects": [{"type": "utility", "target": "self", "description": "Effect description"}]
    }
  }
}

Valid rarities: common, uncommon, rare, epic, legendary
Respond ONLY with the JSON object, no markdown fences.`;

/**
 * Real AI service implementation using:
 * - Anthropic Claude for text generation (Dungeon Master) and object scanning (Vision)
 * - OpenAI DALL-E 3 for scene image generation
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
    const userPrompt = this.buildTextPrompt(request);

    const response = await this.anthropic.messages.create({
      model: this.textModel,
      max_tokens: 1024,
      system: DUNGEON_MASTER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = this.parseJSON(rawText, {
      narrative: "The world shifts around you as your adventure continues...",
      mood: "exploration",
      options: [
        { text: "Look around carefully", type: "exploration", difficultyClass: 10 },
        { text: "Proceed forward", type: "exploration", difficultyClass: 8 },
        { text: "Call out into the darkness", type: "social", difficultyClass: 12 },
      ],
      imagePrompt: "A fantasy RPG scene, atmospheric digital painting.",
      events: [],
    });

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

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    if (!this.imageEnabled) {
      // Fallback to placeholder if no OpenAI key
      const w = request.width ?? 1024;
      const h = request.height ?? 1024;
      return {
        imageUrl: `https://placehold.co/${w}x${h}/1a1a2e/e0e0e0?text=Scene`,
        revisedPrompt: request.prompt,
        generationTimeMs: 0,
      };
    }

    const start = Date.now();

    const styleHint =
      request.style === "dark_gothic"
        ? "dark gothic oil painting style"
        : request.style === "watercolor"
          ? "delicate watercolor illustration style"
          : request.style === "comic"
            ? "comic book illustration style with bold lines"
            : "detailed fantasy digital painting style";

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

    return this.parseJSON(rawText, {
      detectedLabel: "Mysterious Object",
      detailedDescription: "An object from the real world, imbued with magical energy.",
      visualFeatures: ["unknown shape"],
      proportions: { width: 1, height: 1, depth: 1, unit: "relative" as const },
      confidence: 0.5,
      suggestedGameItem: {
        name: "Enchanted Artifact",
        description: "A curious artifact from another realm.",
        category: "scanned_object",
        rarity: "common",
        properties: { weight: 1, value: 10, effects: [] },
      },
    });
  }

  /**
   * Build the user prompt that gives the LLM all the context it needs.
   */
  private buildTextPrompt(request: TextGenerationRequest): string {
    const parts: string[] = [];

    parts.push(`=== CHARACTER ===\n${request.characterSummary}`);

    if (request.inventoryContext) {
      parts.push(`\n=== INVENTORY ===\n${request.inventoryContext}`);
    }

    if (request.memoryContext) {
      parts.push(`\n=== MEMORIES (relevant past events) ===\n${request.memoryContext}`);
    }

    if (request.recentContext) {
      parts.push(`\n=== RECENT CONTEXT ===\n${request.recentContext}`);
    }

    parts.push(`\n=== CURRENT MOOD ===\n${request.mood}`);
    parts.push(`\n=== PLAYER ACTION ===\n${request.playerAction}`);

    return parts.join("\n");
  }

  /**
   * Safely parse JSON from the LLM, falling back to a default if parsing fails.
   */
  private parseJSON<T>(raw: string, fallback: T): T {
    try {
      // Strip markdown fences if the model added them despite instructions
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
      }
      return JSON.parse(cleaned) as T;
    } catch {
      console.error("[LiveAIService] Failed to parse LLM JSON response:", raw.slice(0, 200));
      return fallback;
    }
  }
}
