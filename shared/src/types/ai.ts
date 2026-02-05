/** AI model quality tiers */
export type AIModelTier = "standard" | "premium" | "hd";

/** Request to generate narrative text */
export interface TextGenerationRequest {
  sessionId: string;
  characterSummary: string;
  recentContext: string;
  memoryContext: string;
  inventoryContext: string;
  playerAction: string;
  mood: string;
  modelTier: AIModelTier;
  /** Scenario genre + setting context for narrative tone and consistency */
  scenarioContext?: string;
}

/** Response from text generation */
export interface TextGenerationResponse {
  narrative: string;
  mood: string;
  options: Array<{
    text: string;
    type: string;
    requiredAbility?: string;
    difficultyClass?: number;
  }>;
  imagePrompt?: string;
  events: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Request to generate a scene image */
export interface ImageGenerationRequest {
  prompt: string;
  characterAppearance: string;
  mood: string;
  style: "fantasy_painting" | "dark_gothic" | "watercolor" | "comic";
  modelTier: AIModelTier;
  width?: number;
  height?: number;
}

/** Response from image generation */
export interface ImageGenerationResponse {
  imageUrl: string;
  revisedPrompt: string;
  generationTimeMs: number;
}

/** Request to analyze a scanned real-world object */
export interface ObjectScanRequest {
  imageData: string;
  format: "base64" | "url";
}

/** Response from object scan analysis */
export interface ObjectScanResponse {
  detectedLabel: string;
  detailedDescription: string;
  visualFeatures: string[];
  proportions: {
    width: number;
    height: number;
    depth: number;
    unit: "relative";
  };
  confidence: number;
  suggestedGameItem: {
    name: string;
    description: string;
    category: string;
    rarity: string;
    properties: Record<string, unknown>;
  };
}

/** Content safety check request */
export interface SafetyCheckRequest {
  content: string;
  contentType: "text" | "image_prompt";
}

/** Content safety check response */
export interface SafetyCheckResponse {
  safe: boolean;
  flags: SafetyFlag[];
  filteredContent?: string;
}

/** Content safety flag categories */
export interface SafetyFlag {
  category: "violence" | "sexual" | "hate" | "self_harm" | "illegal" | "minors";
  severity: "low" | "medium" | "high";
  description: string;
}
