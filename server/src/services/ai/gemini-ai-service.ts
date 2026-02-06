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
    const maxAttempts = 4; // Increased retries
    let lastError: unknown;
    let lastRawText = "";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const userPrompt = buildTextPrompt(request);

        const model = this.genAI.getGenerativeModel({
          model: this.textModel,
          systemInstruction: DUNGEON_MASTER_SYSTEM_PROMPT,
        });

        const result = await model.generateContent(userPrompt);
        const rawText = result.response.text();
        lastRawText = rawText;

        // Try to parse the JSON
        let parsed: typeof TEXT_GENERATION_FALLBACK;
        try {
          let cleaned = rawText.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
          }
          parsed = JSON.parse(cleaned);
        } catch (parseError) {
          // JSON parsing failed - retry with a simpler prompt on next attempt
          console.warn(
            `[GeminiAIService] JSON parse failed (attempt ${attempt + 1}/${maxAttempts}):`,
            rawText.slice(0, 100),
          );
          if (attempt < maxAttempts - 1) {
            // Wait before retry
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw parseError;
        }

        // Validate that we have actual content, not empty narrative
        if (!parsed.narrative || parsed.narrative.length < 20) {
          console.warn(`[GeminiAIService] Empty/short narrative (attempt ${attempt + 1}):`, parsed.narrative);
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }

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
      } catch (error) {
        lastError = error;
        console.error(
          `[GeminiAIService] Text generation failed (attempt ${attempt + 1}/${maxAttempts}):`,
          error instanceof Error ? error.message : error,
        );
        if (attempt < maxAttempts - 1) {
          // Exponential backoff
          const delay = 1500 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted - generate a context-aware fallback
    console.error("[GeminiAIService] All retries exhausted, using context-aware fallback. Last raw:", lastRawText.slice(0, 200));
    return this.generateContextAwareFallback(request);
  }

  /**
   * Generate a context-aware fallback when the AI completely fails.
   * This is better than the generic "Die Welt um dich herum..." message.
   */
  private generateContextAwareFallback(request: TextGenerationRequest): TextGenerationResponse {
    // Extract action from request
    const action = request.playerAction.split("\n")[0]; // First line is the action text

    // Generate a simple but context-relevant response
    const narratives: Record<string, string> = {
      combat: `Du fuehrst deinen Angriff aus, doch die Situation bleibt angespannt. Dein Gegner weicht zurueck und wartet auf deine naechste Bewegung. Der Kampf ist noch nicht entschieden.`,
      exploration: `Du bewegst dich vorsichtig weiter. Die Umgebung ist still, aber du spuerst, dass hier mehr verborgen liegt. Ein leises Gerausch in der Ferne laesst dich innehalten.`,
      dialogue: `Die Worte hallen in der Stille nach. Dein Gegenueber scheint nachzudenken, bevor eine Antwort kommt. Die Spannung ist spuerbar.`,
      mystery: `Du untersuchst die Umgebung genauer. Etwas stimmt hier nicht ganz, aber du kannst es noch nicht greifen. Vielleicht gibt es noch mehr zu entdecken.`,
      safe: `Ein Moment der Ruhe. Du nutzt die Gelegenheit, dich umzusehen und deine naechsten Schritte zu planen.`,
      danger: `Die Gefahr lauert im Schatten. Du bleibst wachsam und bereit, auf alles zu reagieren, was als naechstes geschehen koennte.`,
    };

    const mood = request.mood || "exploration";
    const narrative = narratives[mood] || narratives.exploration;

    // Generate context-appropriate options
    const optionsByMood: Record<string, typeof TEXT_GENERATION_FALLBACK.options> = {
      combat: [
        { text: "Erneut angreifen", type: "combat", difficultyClass: 12 },
        { text: "Verteidigungshaltung einnehmen", type: "defend", difficultyClass: 10 },
        { text: "Versuchen, zu fliehen", type: "skill", difficultyClass: 14 },
      ],
      exploration: [
        { text: "Die Umgebung genauer untersuchen", type: "exploration", difficultyClass: 10 },
        { text: "Vorsichtig weitergehen", type: "exploration", difficultyClass: 8 },
        { text: "Nach Hinweisen suchen", type: "skill", difficultyClass: 12 },
      ],
      dialogue: [
        { text: "Das Gespraech fortsetzen", type: "social", difficultyClass: 10 },
        { text: "Nachhaken und mehr erfahren", type: "social", difficultyClass: 13 },
        { text: "Das Gespraech beenden", type: "social", difficultyClass: 8 },
      ],
      default: [
        { text: "Die Situation einschaetzen", type: "exploration", difficultyClass: 10 },
        { text: "Vorsichtig vorgehen", type: "exploration", difficultyClass: 8 },
        { text: "Nach einem anderen Weg suchen", type: "skill", difficultyClass: 12 },
      ],
    };

    const options = optionsByMood[mood] || optionsByMood.default;

    return {
      narrative,
      mood,
      options,
      imagePrompt: undefined,
      events: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
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

  async generateItemImage(
    visualDescription: string,
    itemName: string,
    rarity?: string,
  ): Promise<string | null> {
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

      return await withRetry(
        async () => {
          const model = this.genAI.getGenerativeModel({
            model: GEMINI_IMAGE_MODEL,
          });

          const prompt = `Generate a single RPG fantasy game item icon on a solid dark background (#1a1a2e). The item: "${itemName}". Visual details: ${visualDescription}. Quality: ${rarityHint}. Style: detailed fantasy RPG item icon, painterly digital art style, glowing magical effects where appropriate, no text or labels, centered composition.`;

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

  async generatePortrait(
    description: string,
    race: string,
    charClass: string,
    traits?: string[],
    backstory?: string,
  ): Promise<string | null> {
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

      return await withRetry(
        async () => {
          const model = this.genAI.getGenerativeModel({
            model: GEMINI_IMAGE_MODEL,
          });

          const prompt = `Generate a fantasy RPG character portrait. Race: ${race}. Class: ${charClass}. Appearance: ${description}. ${classHint}. ${traitExpression}. ${backstoryHint}. Style: detailed fantasy portrait painting, cinematic lighting from above-left, dark moody background with subtle atmosphere, shoulders-up framing, painterly brushstrokes, no text or labels.`;

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

  async generateJourneyNarrative(
    characterName: string,
    characterBackstory: string,
    characterTraits: string[],
    scenarioTitle: string,
    scenarioSetting: string,
  ): Promise<string> {
    return withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.textModel,
      });

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

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Fallback if empty
      if (!text) {
        return `${characterName} hatte lange nach diesem Ort gesucht. "${scenarioTitle}" — ein Name, der in Tavernen geflüstert wurde. Nun stand das Abenteuer unmittelbar bevor.`;
      }

      return text;
    });
  }
}
