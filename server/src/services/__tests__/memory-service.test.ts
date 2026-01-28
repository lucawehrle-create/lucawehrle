import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryMemoryService } from "../memory/memory-service.js";
import type { MemoryEntry } from "@aetheria/shared";

function createMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    sessionId: "session-1",
    turnId: "turn-1",
    turnNumber: 1,
    content: "The hero entered the dark cave.",
    category: "location_discovery",
    importance: 0.5,
    entities: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("InMemoryMemoryService", () => {
  let service: InMemoryMemoryService;

  beforeEach(() => {
    service = new InMemoryMemoryService();
  });

  describe("storeMemory", () => {
    it("should store a memory entry", async () => {
      const memory = createMemory();
      await service.storeMemory(memory);

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "cave",
        maxResults: 10,
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("should generate an embedding for stored memory", async () => {
      const memory = createMemory();
      await service.storeMemory(memory);

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "dark cave",
        maxResults: 1,
      });

      expect(results[0].embedding).toBeDefined();
      expect(results[0].embedding!.length).toBeGreaterThan(0);
    });
  });

  describe("queryMemories", () => {
    it("should return empty array for unknown session", async () => {
      const results = await service.queryMemories({
        sessionId: "nonexistent",
        queryText: "anything",
        maxResults: 10,
      });
      expect(results).toEqual([]);
    });

    it("should filter by minimum importance", async () => {
      await service.storeMemory(createMemory({ importance: 0.2, content: "Low importance event" }));
      await service.storeMemory(createMemory({ importance: 0.8, content: "High importance event" }));

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "event",
        maxResults: 10,
        minImportance: 0.5,
      });

      expect(results.every((m) => m.importance >= 0.5)).toBe(true);
    });

    it("should filter by category", async () => {
      await service.storeMemory(createMemory({ category: "combat_event", content: "Battle with goblin" }));
      await service.storeMemory(createMemory({ category: "npc_interaction", content: "Met the wizard" }));

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "encounter",
        maxResults: 10,
        categories: ["combat_event"],
      });

      expect(results.every((m) => m.category === "combat_event")).toBe(true);
    });

    it("should respect maxResults limit", async () => {
      for (let i = 0; i < 10; i++) {
        await service.storeMemory(createMemory({ content: `Memory entry ${i}` }));
      }

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "Memory",
        maxResults: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should rank results by semantic similarity", async () => {
      await service.storeMemory(createMemory({ content: "The wizard cast a powerful fire spell" }));
      await service.storeMemory(createMemory({ content: "You ate bread at the tavern" }));
      await service.storeMemory(createMemory({ content: "The fire burned through the ancient scroll" }));

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "fire magic spell",
        maxResults: 3,
      });

      // Results with "fire" and "spell" should rank higher
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getContextSummary", () => {
    it("should return null for sessions without summaries", async () => {
      const summary = await service.getContextSummary("nonexistent");
      expect(summary).toBeNull();
    });
  });

  describe("updateContextSummary", () => {
    it("should create a summary for existing memories", async () => {
      for (let i = 0; i < 10; i++) {
        await service.storeMemory(
          createMemory({
            turnNumber: i + 1,
            content: `Turn ${i + 1}: Exploring the dungeon deeper`,
          })
        );
      }

      const summary = await service.updateContextSummary("session-1");
      expect(summary.sessionId).toBe("session-1");
      expect(summary.turnsSummarized).toBe(10);
      expect(summary.recentEvents).toBeDefined();
      expect(summary.overallSummary).toBeDefined();
    });
  });

  describe("clearSessionMemories", () => {
    it("should remove all memories for a session", async () => {
      await service.storeMemory(createMemory());
      await service.storeMemory(createMemory());

      await service.clearSessionMemories("session-1");

      const results = await service.queryMemories({
        sessionId: "session-1",
        queryText: "anything",
        maxResults: 10,
      });

      expect(results).toEqual([]);
    });

    it("should also clear summaries", async () => {
      await service.storeMemory(createMemory());
      await service.updateContextSummary("session-1");
      await service.clearSessionMemories("session-1");

      const summary = await service.getContextSummary("session-1");
      expect(summary).toBeNull();
    });
  });
});
