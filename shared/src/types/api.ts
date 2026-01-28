/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/** API error format */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** API: Start a new game session */
export interface CreateSessionRequest {
  characterId: string;
  scenarioId?: string;
  customPrompt?: string;
}

/** API: Submit a player action */
export interface SubmitActionRequest {
  sessionId: string;
  action: {
    type: "option" | "freetext";
    optionId?: string;
    text: string;
  };
}

/** API: Scan an object */
export interface ScanObjectRequest {
  sessionId: string;
  imageData: string;
  format: "base64" | "url";
}

/** API: Create a custom scenario */
export interface CreateScenarioRequest {
  title: string;
  description: string;
  genre: "fantasy" | "horror" | "scifi" | "mystery" | "comedy";
  difficulty: "easy" | "medium" | "hard" | "legendary";
  setting: string;
  openingNarrative: string;
  tags: string[];
}

/** API: Create a new character */
export interface CreateCharacterRequest {
  name: string;
  race: string;
  characterClass: string;
  appearance: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinTone: string;
    height: "short" | "average" | "tall";
    build: "slim" | "average" | "muscular" | "heavy";
    distinguishingFeatures: string[];
    clothing: string;
    equipment: string[];
  };
  backstory: string;
  traits: string[];
}

/** Streaming event sent via SSE for real-time text delivery */
export interface StreamEvent {
  type: "token" | "options" | "mood" | "image" | "dice_roll" | "event" | "done" | "error";
  data: unknown;
}
