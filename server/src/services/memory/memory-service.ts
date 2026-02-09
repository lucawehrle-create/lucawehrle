import type {
  MemoryEntry,
  MemoryQuery,
  ContextSummary,
  MemoryCategory,
  NPCRelationship,
  KnownLocation,
  StoryMilestone,
} from "@aetheria/shared";

/**
 * Memory service interface for the vector database integration.
 * Handles long-term memory storage and retrieval for game sessions,
 * enabling the AI to remember details from hundreds of turns ago.
 */
export interface MemoryService {
  /** Store a new memory entry */
  storeMemory(entry: MemoryEntry): Promise<void>;

  /** Query memories by semantic similarity */
  queryMemories(query: MemoryQuery): Promise<MemoryEntry[]>;

  /** Get a compressed context summary for a session */
  getContextSummary(sessionId: string): Promise<ContextSummary | null>;

  /** Update the context summary after N turns */
  updateContextSummary(sessionId: string): Promise<ContextSummary>;

  /** Delete all memories for a session */
  clearSessionMemories(sessionId: string): Promise<void>;

  // ========== ENTITY TRACKING ==========

  /** Extract entity names (NPCs, locations) from narrative text */
  extractEntitiesFromText(text: string): string[];

  /** Update NPC relationship based on narrative content */
  updateNPCRelationship(
    sessionId: string,
    npcName: string,
    narrative: string,
    turnNumber: number,
    description?: string
  ): NPCRelationship;

  /** Update location visit tracking */
  updateLocationVisit(
    sessionId: string,
    locationName: string,
    turnNumber: number,
    description?: string,
    notableEvent?: string
  ): KnownLocation;

  /** Check narrative for story milestones */
  checkForMilestone(
    sessionId: string,
    narrative: string,
    turnNumber: number,
    entities: string[]
  ): StoryMilestone | null;

  /** Get all tracked NPCs for a session */
  getSessionNPCs(sessionId: string): NPCRelationship[];

  /** Get all tracked locations for a session */
  getSessionLocations(sessionId: string): KnownLocation[];

  /** Get all story milestones for a session */
  getSessionMilestones(sessionId: string): StoryMilestone[];
}

/**
 * In-memory implementation of MemoryService.
 * Uses cosine similarity on simple TF-IDF vectors for semantic search.
 * Production would use a real vector database (Pinecone, Weaviate, etc.).
 */
export class InMemoryMemoryService implements MemoryService {
  private memories: Map<string, MemoryEntry[]> = new Map();
  private summaries: Map<string, ContextSummary> = new Map();
  /** Track NPCs per session with relationship scores */
  private npcTracker: Map<string, Map<string, NPCRelationship>> = new Map();
  /** Track locations per session */
  private locationTracker: Map<string, Map<string, KnownLocation>> = new Map();
  /** Track story milestones per session */
  private milestoneTracker: Map<string, StoryMilestone[]> = new Map();
  /** Global vocabulary shared across all sessions for consistent embeddings */
  private globalVocab: Map<string, number> = new Map();
  private vocabIdx = 0;
  /** Number of recent turns to keep in full detail */
  private readonly recentTurnWindow = 10;
  /** Turns between summary updates */
  private readonly summaryInterval = 5;
  /** Maximum memories per session before pruning */
  private readonly maxMemoriesPerSession = 200;
  /** How many low-importance memories to prune at once */
  private readonly pruneCount = 30;

  // ========== ENTITY EXTRACTION PATTERNS ==========

  /** Common NPC indicator patterns (German) */
  private static readonly NPC_PATTERNS = [
    /(?:der|die|ein|eine|einen)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/g,
    /([A-ZÄÖÜ][a-zäöüß]+)\s+(?:sagt|fragt|antwortet|ruft|flüstert|erklärt|warnt|lächelt|nickt|schüttelt)/g,
    /(?:mit|zu|von|bei)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:dem|der)\s+[A-ZÄÖÜ][a-zäöüß]+)?)/g,
    /"[^"]*"\s*(?:,\s*)?(?:sagt|fragt|ruft)\s+([A-ZÄÖÜ][a-zäöüß]+)/g,
  ];

  /** Location indicator patterns (German) */
  private static readonly LOCATION_PATTERNS = [
    /(?:in|im|ins|nach|zum|zur|am|beim|durch|über)\s+(?:den?|die|das|dem|der)?\s*([A-ZÄÖÜ][a-zäöüß]+(?:(?:wald|berg|tal|turm|burg|höhle|tempel|dorf|stadt|halle|kammer|raum|haus|hütte|tor|brücke|see|fluss|weg|pfad|gasse|platz|markt))?)/gi,
    /(?:betritt|betrittst|verlässt|erreichst|siehst)\s+(?:den?|die|das)?\s*([A-ZÄÖÜ][a-zäöüß]+(?:wald|berg|turm|burg|höhle|tempel|dorf|stadt|halle|kammer)?)/gi,
  ];

  /** Words to exclude from entity extraction */
  private static readonly EXCLUDED_WORDS = new Set([
    // German articles and pronouns
    "Der", "Die", "Das", "Den", "Dem", "Ein", "Eine", "Einen", "Einem",
    "Du", "Er", "Sie", "Es", "Ihr", "Wir", "Ich", "Dein", "Sein", "Mein",
    // Common nouns that shouldn't be NPCs
    "Spieler", "Held", "Gegner", "Feind", "Monster", "Kreatur", "Wächter",
    // Common verbs that might be capitalized
    "Angriff", "Erfolg", "Schaden", "Probe", "Würfel",
    // Story keywords
    "Pflicht", "Hinweis", "Quest", "Ziel", "Aktion",
  ]);

  /** Keywords indicating positive relationship change */
  private static readonly POSITIVE_KEYWORDS = [
    "hilft", "rettet", "beschützt", "heilt", "schenkt", "dankt", "lobt",
    "freundlich", "dankbar", "vertraut", "verbündet", "unterstützt",
  ];

  /** Keywords indicating negative relationship change */
  private static readonly NEGATIVE_KEYWORDS = [
    "angreift", "bedroht", "bestiehlt", "beleidigt", "verrät", "tötet",
    "feindlich", "wütend", "misstrauisch", "verflucht", "hasst",
  ];

  /** Keywords indicating story milestones */
  private static readonly MILESTONE_PATTERNS: Array<{ pattern: RegExp; significance: StoryMilestone["significance"] }> = [
    { pattern: /(?:entscheidest|wählst|beschließt)\s+dich/i, significance: "player_choice" },
    { pattern: /(?:stirbt|fällt|bricht zusammen|haucht.*leben aus)/i, significance: "npc_death" },
    { pattern: /(?:entdeckst|findest|enthüllst|offenbart sich)/i, significance: "major_discovery" },
    { pattern: /(?:verrät|hintergeht|täuscht|betrügt)/i, significance: "betrayal" },
    { pattern: /(?:verbündet|schließt.*bündnis|schwört.*treue)/i, significance: "alliance" },
    { pattern: /(?:quest.*abgeschlossen|auftrag.*erfüllt|mission.*beendet)/i, significance: "quest_complete" },
    { pattern: /(?:knapp.*überlebt|dem tod.*entkommen|fast.*gestorben|letzter.*atemzug)/i, significance: "near_death" },
  ];

  async storeMemory(entry: MemoryEntry): Promise<void> {
    const sessionMemories = this.memories.get(entry.sessionId) ?? [];
    // Generate embedding using the global vocabulary cache
    entry.embedding = this.generateSimpleEmbedding(entry.content);
    sessionMemories.push(entry);
    this.memories.set(entry.sessionId, sessionMemories);

    // Auto-prune when session exceeds max memories
    if (sessionMemories.length > this.maxMemoriesPerSession) {
      this.pruneSession(entry.sessionId);
    }

    // Check if we should update the context summary
    if (sessionMemories.length % this.summaryInterval === 0) {
      await this.updateContextSummary(entry.sessionId);
    }
  }

  /**
   * Remove oldest low-importance memories to keep sessions bounded.
   * Keeps recent memories and high-importance entries.
   */
  private pruneSession(sessionId: string): void {
    const memories = this.memories.get(sessionId);
    if (!memories || memories.length <= this.maxMemoriesPerSession) return;

    // Never prune the most recent turns
    const recentCutoff = memories.length - this.recentTurnWindow;
    const oldMemories = memories.slice(0, recentCutoff);

    // Sort old memories by importance (lowest first) and remove the weakest
    const scored = oldMemories.map((m, idx) => ({ idx, importance: m.importance }));
    scored.sort((a, b) => a.importance - b.importance);

    const toRemove = new Set(scored.slice(0, this.pruneCount).map((s) => s.idx));
    const pruned = memories.filter((_, idx) => !toRemove.has(idx));
    this.memories.set(sessionId, pruned);
  }

  async queryMemories(query: MemoryQuery): Promise<MemoryEntry[]> {
    const sessionMemories = this.memories.get(query.sessionId) ?? [];
    if (sessionMemories.length === 0) return [];

    const queryEmbedding = this.generateSimpleEmbedding(query.queryText);

    // Score each memory by similarity
    const scored = sessionMemories
      .filter((m) => {
        if (query.minImportance && m.importance < query.minImportance) return false;
        if (query.categories && !query.categories.includes(m.category)) return false;
        return true;
      })
      .map((m) => ({
        memory: m,
        score: this.cosineSimilarity(queryEmbedding, m.embedding ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.maxResults);

    return scored.map((s) => s.memory);
  }

  async getContextSummary(sessionId: string): Promise<ContextSummary | null> {
    return this.summaries.get(sessionId) ?? null;
  }

  async updateContextSummary(sessionId: string): Promise<ContextSummary> {
    const memories = this.memories.get(sessionId) ?? [];

    // Split into old (to summarize) and recent (keep full detail)
    const cutoff = Math.max(0, memories.length - this.recentTurnWindow);
    const oldMemories = memories.slice(0, cutoff);
    const recentMemories = memories.slice(cutoff);

    // Get tracked NPCs and locations (with relationship data)
    const npcs = this.getSessionNPCs(sessionId);
    const locations = this.getSessionLocations(sessionId);
    const milestones = this.getSessionMilestones(sessionId);
    const quests = this.extractQuests(memories);

    // Build compressed summary of old events
    const overallSummary = oldMemories.length > 0
      ? this.compressMemories(oldMemories)
      : "Das Abenteuer hat gerade erst begonnen.";

    const recentEvents = recentMemories.map((m) => m.content).join("\n---\n");

    const summary: ContextSummary = {
      sessionId,
      overallSummary,
      knownNPCs: npcs,
      knownLocations: locations,
      activeQuests: quests,
      storyMilestones: milestones,
      recentEvents,
      turnsSummarized: memories.length,
      lastUpdatedAt: new Date().toISOString(),
    };

    this.summaries.set(sessionId, summary);
    return summary;
  }

  async clearSessionMemories(sessionId: string): Promise<void> {
    this.memories.delete(sessionId);
    this.summaries.delete(sessionId);
    this.npcTracker.delete(sessionId);
    this.locationTracker.delete(sessionId);
    this.milestoneTracker.delete(sessionId);
  }

  // ========== ENTITY EXTRACTION METHODS ==========

  /**
   * Extract entities (NPCs, locations) from narrative text.
   * Returns array of entity names for storage in MemoryEntry.
   */
  extractEntitiesFromText(text: string): string[] {
    const entities: Set<string> = new Set();

    // Extract NPCs
    for (const pattern of InMemoryMemoryService.NPC_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1]?.trim();
        if (name && this.isValidEntityName(name)) {
          entities.add(name);
        }
      }
    }

    // Extract locations
    for (const pattern of InMemoryMemoryService.LOCATION_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1]?.trim();
        if (name && this.isValidEntityName(name) && name.length > 3) {
          entities.add(name);
        }
      }
    }

    return Array.from(entities);
  }

  /**
   * Check if a name is a valid entity (not a common word or excluded term).
   */
  private isValidEntityName(name: string): boolean {
    if (!name || name.length < 2) return false;
    if (InMemoryMemoryService.EXCLUDED_WORDS.has(name)) return false;
    // Must start with uppercase
    if (!/^[A-ZÄÖÜ]/.test(name)) return false;
    // Shouldn't be all uppercase (likely an acronym or emphasis)
    if (name === name.toUpperCase() && name.length > 2) return false;
    return true;
  }

  /**
   * Update NPC relationship based on narrative content.
   * Call this after each turn to track relationship changes.
   */
  updateNPCRelationship(
    sessionId: string,
    npcName: string,
    narrative: string,
    turnNumber: number,
    description?: string
  ): NPCRelationship {
    let sessionNPCs = this.npcTracker.get(sessionId);
    if (!sessionNPCs) {
      sessionNPCs = new Map();
      this.npcTracker.set(sessionId, sessionNPCs);
    }

    let npc = sessionNPCs.get(npcName);
    const isNewNPC = !npc;

    if (!npc) {
      npc = {
        name: npcName,
        description: description || `Begegnet in Runde ${turnNumber}`,
        relationshipScore: 0,
        relationshipLabel: "neutral",
        firstMetTurn: turnNumber,
        lastInteractionTurn: turnNumber,
        keyInteractions: [],
      };
    }

    // Calculate relationship change based on narrative keywords
    const lowerNarrative = narrative.toLowerCase();
    const npcMentioned = lowerNarrative.includes(npcName.toLowerCase());

    if (npcMentioned) {
      let scoreChange = 0;
      let interactionNote = "";

      // Check for positive interactions
      for (const keyword of InMemoryMemoryService.POSITIVE_KEYWORDS) {
        if (lowerNarrative.includes(keyword)) {
          scoreChange += 1;
          interactionNote = `Positive Interaktion (${keyword})`;
          break;
        }
      }

      // Check for negative interactions
      for (const keyword of InMemoryMemoryService.NEGATIVE_KEYWORDS) {
        if (lowerNarrative.includes(keyword)) {
          scoreChange -= 2; // Negative actions have stronger impact
          interactionNote = `Negative Interaktion (${keyword})`;
          break;
        }
      }

      if (scoreChange !== 0) {
        npc.relationshipScore = Math.max(-10, Math.min(10, npc.relationshipScore + scoreChange));
        npc.lastInteractionTurn = turnNumber;
        if (interactionNote) {
          npc.keyInteractions.push(`Runde ${turnNumber}: ${interactionNote}`);
          // Keep only last 5 interactions
          if (npc.keyInteractions.length > 5) {
            npc.keyInteractions = npc.keyInteractions.slice(-5);
          }
        }
      }

      // Update relationship label based on score
      npc.relationshipLabel = this.scoreToLabel(npc.relationshipScore);
    }

    sessionNPCs.set(npcName, npc);
    return npc;
  }

  /**
   * Convert numeric relationship score to label.
   */
  private scoreToLabel(score: number): NPCRelationship["relationshipLabel"] {
    if (score <= -7) return "hostile";
    if (score <= -3) return "unfriendly";
    if (score <= 3) return "neutral";
    if (score <= 7) return "friendly";
    return "loyal";
  }

  /**
   * Update location tracking when player visits a place.
   */
  updateLocationVisit(
    sessionId: string,
    locationName: string,
    turnNumber: number,
    description?: string,
    notableEvent?: string
  ): KnownLocation {
    let sessionLocations = this.locationTracker.get(sessionId);
    if (!sessionLocations) {
      sessionLocations = new Map();
      this.locationTracker.set(sessionId, sessionLocations);
    }

    let location = sessionLocations.get(locationName);

    if (!location) {
      location = {
        name: locationName,
        description: description || locationName,
        firstVisitTurn: turnNumber,
        lastVisitTurn: turnNumber,
        visitCount: 1,
        notableEvents: [],
      };
    } else {
      location.lastVisitTurn = turnNumber;
      location.visitCount += 1;
    }

    if (notableEvent) {
      location.notableEvents.push(`Runde ${turnNumber}: ${notableEvent}`);
      // Keep only last 3 events per location
      if (location.notableEvents.length > 3) {
        location.notableEvents = location.notableEvents.slice(-3);
      }
    }

    sessionLocations.set(locationName, location);
    return location;
  }

  /**
   * Check narrative for story milestones and record them.
   */
  checkForMilestone(
    sessionId: string,
    narrative: string,
    turnNumber: number,
    entities: string[]
  ): StoryMilestone | null {
    for (const { pattern, significance } of InMemoryMemoryService.MILESTONE_PATTERNS) {
      if (pattern.test(narrative)) {
        const milestone: StoryMilestone = {
          id: `milestone-${sessionId}-${turnNumber}`,
          turnNumber,
          description: this.extractMilestoneDescription(narrative, pattern),
          significance,
          involvedEntities: entities,
          callbackHints: this.generateCallbackHints(significance, entities),
        };

        let sessionMilestones = this.milestoneTracker.get(sessionId);
        if (!sessionMilestones) {
          sessionMilestones = [];
          this.milestoneTracker.set(sessionId, sessionMilestones);
        }
        sessionMilestones.push(milestone);

        // Keep only last 10 milestones
        if (sessionMilestones.length > 10) {
          this.milestoneTracker.set(sessionId, sessionMilestones.slice(-10));
        }

        return milestone;
      }
    }
    return null;
  }

  /**
   * Extract a brief description around the milestone trigger.
   */
  private extractMilestoneDescription(narrative: string, pattern: RegExp): string {
    const match = pattern.exec(narrative);
    if (!match) return narrative.slice(0, 100);

    // Get ~50 chars before and after the match
    const start = Math.max(0, match.index - 50);
    const end = Math.min(narrative.length, match.index + match[0].length + 50);
    let excerpt = narrative.slice(start, end);

    // Clean up to sentence boundaries if possible
    if (start > 0) excerpt = "..." + excerpt;
    if (end < narrative.length) excerpt = excerpt + "...";

    return excerpt;
  }

  /**
   * Generate hints for future story callbacks based on milestone type.
   */
  private generateCallbackHints(
    significance: StoryMilestone["significance"],
    entities: string[]
  ): string[] {
    const hints: string[] = [];
    const entityList = entities.length > 0 ? entities.join(", ") : "beteiligte Personen";

    switch (significance) {
      case "player_choice":
        hints.push(`Erinnere an diese Entscheidung wenn ${entityList} erneut auftaucht`);
        hints.push("Zeige Konsequenzen dieser Wahl in späteren Szenen");
        break;
      case "npc_death":
        hints.push(`Andere NPCs könnten den Tod von ${entityList} erwähnen`);
        hints.push("Hinterlassenschaften oder Vermächtnis könnten auftauchen");
        break;
      case "major_discovery":
        hints.push("Diese Entdeckung könnte neue Questlinien eröffnen");
        hints.push("NPCs könnten nach diesem Wissen fragen");
        break;
      case "betrayal":
        hints.push(`Misstrauen gegenüber ${entityList} sollte bestehen bleiben`);
        hints.push("Rache oder Vergeltung könnte ein Thema werden");
        break;
      case "alliance":
        hints.push(`${entityList} könnte in kritischen Momenten helfen`);
        hints.push("Verbündete könnten um Hilfe bitten");
        break;
      case "quest_complete":
        hints.push("Questgeber könnten Dankbarkeit zeigen");
        hints.push("Ruf des Spielers könnte sich verbreitet haben");
        break;
      case "near_death":
        hints.push("Charakter könnte Narben oder Traumata davontragen");
        hints.push("NPCs könnten die Nahtoderfahrung erwähnen");
        break;
    }

    return hints;
  }

  /**
   * Get all tracked NPCs for a session.
   */
  getSessionNPCs(sessionId: string): NPCRelationship[] {
    const npcs = this.npcTracker.get(sessionId);
    return npcs ? Array.from(npcs.values()) : [];
  }

  /**
   * Get all tracked locations for a session.
   */
  getSessionLocations(sessionId: string): KnownLocation[] {
    const locations = this.locationTracker.get(sessionId);
    return locations ? Array.from(locations.values()) : [];
  }

  /**
   * Get all story milestones for a session.
   */
  getSessionMilestones(sessionId: string): StoryMilestone[] {
    return this.milestoneTracker.get(sessionId) ?? [];
  }

  private static readonly EMBEDDING_DIM = 512;

  /**
   * Generate a bag-of-words embedding using a global vocabulary cache.
   * The shared vocabulary ensures consistent vector dimensions across all
   * memories, making cosine similarity meaningful across sessions.
   * In production, this would call an embedding API (e.g., OpenAI text-embedding-3).
   */
  private generateSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);

    // Grow global vocabulary with new words (capped at EMBEDDING_DIM)
    for (const word of words) {
      if (!this.globalVocab.has(word) && this.vocabIdx < InMemoryMemoryService.EMBEDDING_DIM) {
        this.globalVocab.set(word, this.vocabIdx++);
      }
    }

    // Build term-frequency vector using global vocab indices
    const dim = Math.min(this.vocabIdx, InMemoryMemoryService.EMBEDDING_DIM);
    const vector = new Array(dim).fill(0);
    for (const word of words) {
      const i = this.globalVocab.get(word);
      if (i !== undefined && i < dim) {
        vector[i] += 1;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dim; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }

  /**
   * Compress older memories into a coherent story summary.
   * Groups by narrative importance and creates a flowing summary.
   */
  private compressMemories(memories: MemoryEntry[]): string {
    // Group by category and summarize
    const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
    for (const m of memories) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }

    const parts: string[] = [];

    // Category labels in German for better AI context
    const categoryLabels: Record<MemoryCategory, string> = {
      npc_interaction: "Begegnungen",
      location_discovery: "Erkundungen",
      combat_event: "Kaempfe",
      item_event: "Gegenstaende",
      quest_event: "Quests",
      lore_discovery: "Entdeckungen",
      player_decision: "Entscheidungen",
      character_development: "Charakterentwicklung",
      world_state_change: "Weltveraenderungen",
    };

    // Priority order for categories (most story-relevant first)
    const categoryPriority: MemoryCategory[] = [
      "player_decision",
      "npc_interaction",
      "quest_event",
      "combat_event",
      "location_discovery",
      "item_event",
      "lore_discovery",
      "character_development",
      "world_state_change",
    ];

    for (const category of categoryPriority) {
      const entries = byCategory.get(category);
      if (!entries || entries.length === 0) continue;

      // Keep only highest importance entries per category
      const sorted = entries.sort((a, b) => b.importance - a.importance);
      const kept = sorted.slice(0, 3);

      const summaryLines = kept.map((e) => {
        // Extract the most relevant part (after "Result:" if present)
        let content = e.content;
        const resultMatch = content.match(/Result:\s*(.+)/s);
        if (resultMatch) {
          content = resultMatch[1];
        }
        // Get first meaningful sentence
        const firstSentence = content.split(/[.!?]/)[0]?.trim();
        return firstSentence || content.slice(0, 100);
      });

      // Include entity info if available
      const entityMentions = kept
        .filter((e) => e.entities.length > 0)
        .flatMap((e) => e.entities);
      const uniqueEntities = [...new Set(entityMentions)];
      const entityNote = uniqueEntities.length > 0
        ? ` (Beteiligte: ${uniqueEntities.slice(0, 3).join(", ")})`
        : "";

      parts.push(`${categoryLabels[category]}${entityNote}: ${summaryLines.join(". ")}.`);
    }

    return parts.length > 0
      ? parts.join("\n")
      : "Das Abenteuer hat gerade erst begonnen.";
  }

  private extractNPCs(
    memories: MemoryEntry[]
  ): Array<{ name: string; description: string; relationship: string }> {
    return memories
      .filter((m) => m.category === "npc_interaction")
      .slice(-10)
      .map((m) => ({
        name: m.entities[0] ?? "Unknown NPC",
        description: m.content.slice(0, 100),
        relationship: "neutral",
      }));
  }

  private extractLocations(
    memories: MemoryEntry[]
  ): Array<{ name: string; description: string; firstVisitTurn: number }> {
    return memories
      .filter((m) => m.category === "location_discovery")
      .slice(-10)
      .map((m) => ({
        name: m.entities[0] ?? "Unknown Location",
        description: m.content.slice(0, 100),
        firstVisitTurn: m.turnNumber,
      }));
  }

  private extractQuests(
    memories: MemoryEntry[]
  ): Array<{ name: string; description: string; status: string }> {
    return memories
      .filter((m) => m.category === "quest_event")
      .slice(-5)
      .map((m) => ({
        name: m.entities[0] ?? "Unknown Quest",
        description: m.content.slice(0, 100),
        status: "active",
      }));
  }
}
