/** A memory entry stored in the vector database */
export interface MemoryEntry {
  id: string;
  sessionId: string;
  turnId: string;
  turnNumber: number;
  /** The text content of this memory */
  content: string;
  /** Semantic category for filtering */
  category: MemoryCategory;
  /** Importance score (0-1), used for retrieval prioritization */
  importance: number;
  /** Embedding vector for similarity search */
  embedding?: number[];
  /** Named entities referenced in this memory */
  entities: string[];
  timestamp: string;
}

/** Categories for organizing memories */
export type MemoryCategory =
  | "npc_interaction"
  | "location_discovery"
  | "combat_event"
  | "item_event"
  | "quest_event"
  | "lore_discovery"
  | "player_decision"
  | "character_development"
  | "world_state_change";

/** Request to retrieve relevant memories */
export interface MemoryQuery {
  sessionId: string;
  queryText: string;
  categories?: MemoryCategory[];
  maxResults: number;
  minImportance?: number;
}

/** NPC relationship tracking with numeric score */
export interface NPCRelationship {
  name: string;
  /** First description when NPC was encountered */
  description: string;
  /** Relationship score: -10 (hostile) to +10 (loyal), 0 = neutral */
  relationshipScore: number;
  /** Human-readable relationship status */
  relationshipLabel: "hostile" | "unfriendly" | "neutral" | "friendly" | "loyal";
  /** Turn when first encountered */
  firstMetTurn: number;
  /** Turn of last interaction */
  lastInteractionTurn: number;
  /** Key interactions that shaped the relationship */
  keyInteractions: string[];
}

/** Location with visit history */
export interface KnownLocation {
  name: string;
  description: string;
  firstVisitTurn: number;
  lastVisitTurn: number;
  visitCount: number;
  /** Notable events that happened here */
  notableEvents: string[];
}

/** A significant story moment worth referencing later */
export interface StoryMilestone {
  id: string;
  turnNumber: number;
  /** Brief description of what happened */
  description: string;
  /** Why this is significant */
  significance: "player_choice" | "npc_death" | "major_discovery" | "betrayal" | "alliance" | "quest_complete" | "near_death";
  /** Entities involved */
  involvedEntities: string[];
  /** Potential future callbacks */
  callbackHints: string[];
}

/** Context window summary for efficient token usage */
export interface ContextSummary {
  sessionId: string;
  /** Compressed summary of all past events */
  overallSummary: string;
  /** Key NPCs encountered with relationship tracking */
  knownNPCs: NPCRelationship[];
  /** Key locations visited */
  knownLocations: KnownLocation[];
  /** Active quests and objectives */
  activeQuests: Array<{ name: string; description: string; status: string }>;
  /** Significant story moments for callbacks */
  storyMilestones: StoryMilestone[];
  /** Recent events (last N turns, full detail) */
  recentEvents: string;
  /** Total turns summarized */
  turnsSummarized: number;
  lastUpdatedAt: string;
}
