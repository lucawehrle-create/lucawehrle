/** Quest status */
export type QuestStatus = "available" | "active" | "completed" | "failed";

/** Quest priority - main quests drive the story, side quests are optional */
export type QuestPriority = "main" | "side";

/** Quest icon type for UI display */
export type QuestIconType =
  | "sword"        // Combat quests
  | "scroll"       // Investigation/mystery
  | "compass"      // Exploration
  | "gem"          // Collection
  | "shield"       // Protection/escort
  | "speech"       // Dialogue/social
  | "skull"        // Boss/epic fights
  | "star";        // Special/story quests

/** Quest objective type */
export type ObjectiveType =
  | "explore"      // Visit a location
  | "collect"      // Gather items
  | "defeat"       // Kill enemies
  | "escort"       // Protect someone
  | "deliver"      // Bring item to NPC
  | "talk"         // Speak with NPC
  | "investigate"  // Discover information
  | "survive";     // Survive N turns

/** A single objective within a quest */
export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  target: string;           // What to find/defeat/talk to
  targetKeywords: string[]; // Keywords for fuzzy matching
  current: number;          // Current progress
  required: number;         // Required amount
  completed: boolean;
  optional?: boolean;       // Optional bonus objective
}

/** Quest difficulty affects rewards and DC */
export type QuestDifficulty = "simple" | "standard" | "challenging" | "epic";

/** Rewards given upon quest completion */
export interface QuestReward {
  experience: number;
  gold?: number;
  items?: string[];         // Item IDs to grant
  reputation?: number;      // Future: faction reputation
}

/** A quest that can be started, tracked, and completed */
export interface Quest {
  id: string;
  title: string;
  description: string;
  shortDescription: string; // One-line summary for compact display
  giver?: string;           // NPC who gave the quest
  giverTitle?: string;      // NPC title/role
  location?: string;        // Where the quest takes place
  status: QuestStatus;
  priority: QuestPriority;
  iconType: QuestIconType;
  difficulty: QuestDifficulty;
  objectives: QuestObjective[];
  rewards: QuestReward;
  turnStarted?: number;     // Turn when quest was accepted
  turnCompleted?: number;   // Turn when quest was completed
  timeLimit?: number;       // Optional: must complete within N turns
  prerequisiteQuests?: string[];  // Quest IDs that must be completed first
  tags: string[];           // For matching with narrative context
}

/** Quest log for a game session */
export interface QuestLog {
  sessionId: string;
  activeQuests: Quest[];
  completedQuests: Quest[];
  failedQuests: Quest[];
  totalQuestsCompleted: number;
  totalExperienceFromQuests: number;
  totalGoldFromQuests: number;
}

/** Quest template for generating new quests */
export interface QuestTemplate {
  id: string;
  titlePattern: string;     // Can include {target}, {location} placeholders
  descriptionPattern: string;
  shortDescriptionPattern: string;
  priority: QuestPriority;
  iconType: QuestIconType;
  difficulty: QuestDifficulty;
  objectiveTemplates: {
    type: ObjectiveType;
    descriptionPattern: string;
    targetPattern: string;
    targetKeywords: string[]; // Keywords for matching
    requiredMin: number;
    requiredMax: number;
    optional?: boolean;
  }[];
  baseRewards: {
    experienceMin: number;
    experienceMax: number;
    goldMin?: number;
    goldMax?: number;
  };
  tags: string[];           // Matching tags for context
  minTurn?: number;         // Don't offer before this turn
  weight: number;           // Probability weight for selection
}

/** Event payload for quest-related events */
export interface QuestEventPayload {
  questId: string;
  questTitle: string;
  objectiveId?: string;
  objectiveDescription?: string;
  rewards?: QuestReward;
}

/** Helper to check if all required objectives are complete */
export function isQuestComplete(quest: Quest): boolean {
  return quest.objectives
    .filter((obj) => !obj.optional)
    .every((obj) => obj.completed);
}

/** Helper to get quest progress percentage */
export function getQuestProgress(quest: Quest): number {
  const requiredObjectives = quest.objectives.filter((obj) => !obj.optional);
  if (requiredObjectives.length === 0) return 100;

  const totalRequired = requiredObjectives.reduce((sum, obj) => sum + obj.required, 0);
  const totalCurrent = requiredObjectives.reduce((sum, obj) => sum + Math.min(obj.current, obj.required), 0);

  return Math.round((totalCurrent / totalRequired) * 100);
}

/** Get the next incomplete objective for display */
export function getNextObjective(quest: Quest): QuestObjective | null {
  return quest.objectives.find((obj) => !obj.completed && !obj.optional) ?? null;
}

/** Get difficulty color for UI */
export function getDifficultyColor(difficulty: QuestDifficulty): string {
  switch (difficulty) {
    case "simple": return "#51cf66";
    case "standard": return "#339af0";
    case "challenging": return "#b197fc";
    case "epic": return "#ffd43b";
  }
}

/** Get icon emoji for quest type */
export function getQuestIcon(iconType: QuestIconType): string {
  switch (iconType) {
    case "sword": return "\u2694\uFE0F";
    case "scroll": return "\uD83D\uDCDC";
    case "compass": return "\uD83E\uDDED";
    case "gem": return "\uD83D\uDC8E";
    case "shield": return "\uD83D\uDEE1\uFE0F";
    case "speech": return "\uD83D\uDDE3\uFE0F";
    case "skull": return "\uD83D\uDC80";
    case "star": return "\u2B50";
  }
}
