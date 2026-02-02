import type {
  MemoryEntry,
  MemoryQuery,
  ContextSummary,
  MemoryCategory,
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
}

/**
 * In-memory implementation of MemoryService.
 * Uses cosine similarity on simple TF-IDF vectors for semantic search.
 * Production would use a real vector database (Pinecone, Weaviate, etc.).
 */
export class InMemoryMemoryService implements MemoryService {
  private memories: Map<string, MemoryEntry[]> = new Map();
  private summaries: Map<string, ContextSummary> = new Map();
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

    // Extract NPCs from memories
    const npcs = this.extractNPCs(memories);
    const locations = this.extractLocations(memories);
    const quests = this.extractQuests(memories);

    // Build compressed summary of old events
    const overallSummary = oldMemories.length > 0
      ? this.compressMemories(oldMemories)
      : "The adventure has just begun.";

    const recentEvents = recentMemories.map((m) => m.content).join("\n---\n");

    const summary: ContextSummary = {
      sessionId,
      overallSummary,
      knownNPCs: npcs,
      knownLocations: locations,
      activeQuests: quests,
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
   * Compress older memories into a summary paragraph.
   * In production, this would use an LLM to generate a coherent summary.
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

    for (const [category, entries] of byCategory) {
      // Keep only highest importance entries per category
      const sorted = entries.sort((a, b) => b.importance - a.importance);
      const kept = sorted.slice(0, 3);
      const summaryLines = kept.map((e) => {
        // Truncate each memory to first sentence
        const firstSentence = e.content.split(/[.!?]/)[0];
        return firstSentence;
      });
      parts.push(`[${category}]: ${summaryLines.join(". ")}.`);
    }

    return parts.join("\n");
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
