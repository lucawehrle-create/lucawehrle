/** Possible moods for UI adaptation */
export type SceneMood =
  | "combat"
  | "exploration"
  | "dialogue"
  | "mystery"
  | "safe"
  | "danger"
  | "celebration"
  | "sorrow";

/** A single action option presented to the player */
export interface ActionOption {
  id: string;
  text: string;
  type: "combat" | "social" | "exploration" | "skill" | "magic" | "item";
  requiredAbility?: string;
  difficultyClass?: number;
}

/** A turn in the game narrative */
export interface GameTurn {
  id: string;
  sessionId: string;
  turnNumber: number;
  narrative: string;
  mood: SceneMood;
  imagePrompt: string;
  imageUrl?: string;
  options: ActionOption[];
  playerAction?: PlayerAction;
  diceRolls: DiceRoll[];
  timestamp: string;
}

/** Player's chosen action for a turn */
export interface PlayerAction {
  type: "option" | "freetext";
  /** ID of the selected ActionOption, if type is "option" */
  optionId?: string;
  /** Free-text input from the player, if type is "freetext" */
  text: string;
}

/** Result of a dice roll in the backend rule engine */
export interface DiceRoll {
  id: string;
  diceType: DiceType;
  count: number;
  results: number[];
  modifier: number;
  total: number;
  purpose: string;
  success?: boolean;
  criticalHit?: boolean;
  criticalFail?: boolean;
}

/** Standard RPG dice types */
export type DiceType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

/** Active game session */
export interface GameSession {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  scenario: string;
  currentChapter: number;
  turnCount: number;
  mood: SceneMood;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Scenario template for starting new adventures */
export interface ScenarioTemplate {
  id: string;
  title: string;
  description: string;
  genre: "fantasy" | "horror" | "scifi" | "mystery" | "comedy";
  difficulty: "easy" | "medium" | "hard" | "legendary";
  openingNarrative: string;
  setting: string;
  tags: string[];
  creatorId?: string;
}

/** Event fired when game state changes */
export interface GameEvent {
  type:
    | "narrative_update"
    | "combat_start"
    | "combat_end"
    | "item_acquired"
    | "item_lost"
    | "level_up"
    | "npc_met"
    | "quest_start"
    | "quest_complete"
    | "character_death";
  payload: Record<string, unknown>;
  turnId: string;
  timestamp: string;
}
