import type {
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ObjectScanRequest,
  ObjectScanResponse,
} from "@aetheria/shared";

/**
 * AI Service interface for all generative AI operations.
 * Abstracts over specific AI providers (OpenAI, Anthropic, Stability, etc.).
 */
export interface AIService {
  /** Generate narrative text for a game turn */
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;

  /** Generate a scene image */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /** Generate a small item image from a visual description. Returns a data URI or null on failure. */
  generateItemImage(visualDescription: string, itemName: string): Promise<string | null>;

  /** Generate a character portrait from appearance details. Returns image URL/data URI or null. */
  generatePortrait(description: string, race: string, charClass: string): Promise<string | null>;

  /** Analyze a scanned real-world object */
  analyzeObject(request: ObjectScanRequest): Promise<ObjectScanResponse>;
}

/**
 * Mock AI service for development and testing.
 * Returns plausible pre-generated content without calling real AI APIs.
 */
export class MockAIService implements AIService {
  private readonly narrativeTemplates = [
    "You find yourself standing at a crossroads. The path to the north leads into a dark forest, while the eastern road winds toward distant mountains. A weathered signpost creaks in the wind, its letters barely legible.",
    "The chamber opens before you, revealing ancient stone walls covered in luminescent moss. A crystal pool sits at the center, its surface perfectly still. Something glints beneath the water.",
    "The merchant eyes you with suspicion before breaking into a wide grin. 'Ah, an adventurer! I have just the thing for someone of your... talents.' He rummages beneath the counter.",
    "A thunderous roar echoes through the cavern. Shadows dance on the walls as something massive shifts in the darkness ahead. The ground trembles beneath your feet.",
    "The village square is alive with celebration. Lanterns hang from every window, and the smell of roasted meat fills the air. A bard plays a lively tune by the fountain.",
  ];

  private readonly optionSets = [
    [
      { text: "Draw your weapon and advance cautiously", type: "combat", difficultyClass: 12 },
      { text: "Search the area for hidden passages", type: "exploration", requiredAbility: "wisdom", difficultyClass: 14 },
      { text: "Attempt to communicate peacefully", type: "social", requiredAbility: "charisma", difficultyClass: 13 },
    ],
    [
      { text: "Investigate the strange markings on the wall", type: "exploration", requiredAbility: "intelligence", difficultyClass: 15 },
      { text: "Cast a detection spell", type: "magic", requiredAbility: "intelligence", difficultyClass: 12 },
      { text: "Proceed deeper into the dungeon", type: "exploration", difficultyClass: 10 },
      { text: "Set up camp and rest", type: "skill", difficultyClass: 8 },
    ],
    [
      { text: "Accept the merchant's offer", type: "social", requiredAbility: "charisma", difficultyClass: 11 },
      { text: "Haggle for a better price", type: "social", requiredAbility: "charisma", difficultyClass: 16 },
      { text: "Quietly examine the goods for quality", type: "skill", requiredAbility: "intelligence", difficultyClass: 13 },
    ],
  ];

  private readonly moods = ["exploration", "combat", "dialogue", "mystery", "safe"];

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    // Select content based on action keywords
    const actionLower = request.playerAction.toLowerCase();
    let narrativeIndex = 0;
    let optionsIndex = 0;
    let mood = "exploration";

    if (actionLower.includes("fight") || actionLower.includes("attack") || actionLower.includes("combat")) {
      narrativeIndex = 3;
      optionsIndex = 0;
      mood = "combat";
    } else if (actionLower.includes("talk") || actionLower.includes("merchant") || actionLower.includes("speak")) {
      narrativeIndex = 2;
      optionsIndex = 2;
      mood = "dialogue";
    } else if (actionLower.includes("explore") || actionLower.includes("search") || actionLower.includes("investigate")) {
      narrativeIndex = 1;
      optionsIndex = 1;
      mood = "mystery";
    } else if (actionLower.includes("village") || actionLower.includes("rest") || actionLower.includes("safe")) {
      narrativeIndex = 4;
      optionsIndex = 2;
      mood = "safe";
    } else {
      narrativeIndex = Math.floor(Math.random() * this.narrativeTemplates.length);
      optionsIndex = Math.floor(Math.random() * this.optionSets.length);
      mood = this.moods[Math.floor(Math.random() * this.moods.length)];
    }

    const narrative = this.narrativeTemplates[narrativeIndex];
    const options = this.optionSets[optionsIndex];

    return {
      narrative,
      mood,
      options,
      imagePrompt: `Fantasy RPG scene: ${narrative.slice(0, 100)}. ${request.mood} atmosphere, detailed digital painting style.`,
      events: this.generateEvents(actionLower),
      tokenUsage: {
        promptTokens: Math.floor(request.characterSummary.length / 4),
        completionTokens: Math.floor(narrative.length / 4),
        totalTokens: Math.floor((request.characterSummary.length + narrative.length) / 4),
      },
    };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // Return a placeholder image URL
    const width = request.width ?? 512;
    const height = request.height ?? 512;

    return {
      imageUrl: `https://placehold.co/${width}x${height}/1a1a2e/e0e0e0?text=Aetheria+Scene`,
      revisedPrompt: request.prompt,
      generationTimeMs: Math.floor(Math.random() * 3000) + 1000,
    };
  }

  async generateItemImage(visualDescription: string, itemName: string): Promise<string | null> {
    // Return a placeholder item image
    return `https://placehold.co/128x128/1a1a2e/e0e0e0?text=${encodeURIComponent(itemName.slice(0, 12))}`;
  }

  async generatePortrait(_description: string, _race: string, charClass: string): Promise<string | null> {
    return `https://placehold.co/256x256/1a1a2e/e0e0e0?text=${encodeURIComponent(charClass)}`;
  }

  async analyzeObject(request: ObjectScanRequest): Promise<ObjectScanResponse> {
    // Return a mock analysis
    return {
      detectedLabel: "Mysterious Box",
      detailedDescription:
        "A rectangular container with distinct markings and a weathered surface. " +
        "It appears to have been crafted with care, featuring ornate details on its exterior.",
      visualFeatures: [
        "rectangular shape",
        "worn surface texture",
        "visible markings or labels",
        "approximately hand-sized",
      ],
      proportions: {
        width: 1.0,
        height: 0.6,
        depth: 0.4,
        unit: "relative",
      },
      confidence: 0.85,
      suggestedGameItem: {
        name: "Enchanted Container",
        description:
          "A mysterious container that pulses with faint magical energy. Its markings suggest it once belonged to a powerful wizard.",
        category: "scanned_object",
        rarity: "uncommon",
        properties: {
          weight: 2,
          value: 50,
          effects: [
            {
              type: "utility",
              target: "self",
              description: "Can store one magical essence",
            },
          ],
        },
      },
    };
  }

  private generateEvents(action: string): Array<{ type: string; payload: Record<string, unknown> }> {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];

    if (action.includes("fight") || action.includes("attack")) {
      events.push({ type: "combat_start", payload: { enemy: "Unknown Creature" } });
    }
    if (action.includes("found") || action.includes("discover") || action.includes("pick up")) {
      events.push({ type: "item_acquired", payload: { item: "Mysterious Object" } });
    }
    if (action.includes("meet") || action.includes("talk") || action.includes("greet")) {
      events.push({ type: "npc_met", payload: { npc: "Stranger" } });
    }

    return events;
  }
}
