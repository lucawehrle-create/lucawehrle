/** Quest status */
export type QuestStatus = "available" | "active" | "completed" | "failed";

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
  giver?: string;           // NPC who gave the quest
  status: QuestStatus;
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
}

/** Quest template for generating new quests */
export interface QuestTemplate {
  id: string;
  titlePattern: string;     // Can include {target}, {location} placeholders
  descriptionPattern: string;
  difficulty: QuestDifficulty;
  objectiveTemplates: {
    type: ObjectiveType;
    descriptionPattern: string;
    targetPattern: string;
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
