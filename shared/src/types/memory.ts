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

/** Context window summary for efficient token usage */
export interface ContextSummary {
  sessionId: string;
  /** Compressed summary of all past events */
  overallSummary: string;
  /** Key NPCs encountered with brief descriptions */
  knownNPCs: Array<{ name: string; description: string; relationship: string }>;
  /** Key locations visited */
  knownLocations: Array<{ name: string; description: string; firstVisitTurn: number }>;
  /** Active quests and objectives */
  activeQuests: Array<{ name: string; description: string; status: string }>;
  /** Recent events (last N turns, full detail) */
  recentEvents: string;
  /** Total turns summarized */
  turnsSummarized: number;
  lastUpdatedAt: string;
}
