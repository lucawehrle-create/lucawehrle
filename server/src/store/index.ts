/**
 * Store Factory
 *
 * Provides either the in-memory store or the database store
 * based on configuration. Both implement IGameStore interface.
 */

import { GameStore } from "./game-store.js";
import { DatabaseStore, databaseStore } from "./database-store.js";
import type { IGameStore } from "./store-interface.js";

export type StoreType = "memory" | "database";

// Determine which store to use based on environment
const USE_DATABASE = process.env.USE_DATABASE === "true";

/**
 * Get the store type being used
 */
export function getStoreType(): StoreType {
  return USE_DATABASE ? "database" : "memory";
}

/**
 * The in-memory store instance (always available for fallback)
 */
export const memoryStore = new GameStore();

/**
 * Get the active store based on configuration
 */
export function getStore(): IGameStore {
  return USE_DATABASE ? databaseStore : memoryStore;
}

/**
 * Initialize the store (needed for both, but database does more)
 */
export async function initializeStore(): Promise<void> {
  const store = getStore();
  await store.initialize();

  if (USE_DATABASE) {
    console.log("[Store] Using PostgreSQL database store");
  } else {
    console.log("[Store] Using in-memory store (data will be lost on restart)");
  }
}

// Re-export types and interfaces
export type { IGameStore } from "./store-interface.js";
export { GameStore } from "./game-store.js";
export { DatabaseStore, databaseStore } from "./database-store.js";
