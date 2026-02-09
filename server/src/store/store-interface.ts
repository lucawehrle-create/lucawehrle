/**
 * Unified Store Interface
 *
 * Both MemoryStore and DatabaseStore implement this interface,
 * allowing them to be used interchangeably.
 */

import type {
  User,
  Character,
  GameSession,
  GameTurn,
  Inventory,
  ScenarioTemplate,
  Item,
} from "@aetheria/shared";

export interface IGameStore {
  // --- Initialization ---
  initialize(): Promise<void>;

  // --- Users ---
  getUser(id: string): Promise<User | undefined>;
  createUser(username: string, email: string): Promise<User>;
  updateUser(user: User): Promise<void>;

  // --- Characters ---
  getCharacter(id: string): Promise<Character | undefined>;
  getCharactersByUser(userId: string): Promise<Character[]>;
  createCharacter(character: Character): Promise<void>;
  updateCharacter(character: Character): Promise<void>;

  // --- Sessions ---
  getSession(id: string): Promise<GameSession | undefined>;
  getSessionsByUser(userId: string): Promise<GameSession[]>;
  createSession(session: GameSession): Promise<void>;
  updateSession(session: GameSession): Promise<void>;

  // --- Turns ---
  getTurns(sessionId: string): Promise<GameTurn[]>;
  getLastTurn(sessionId: string): Promise<GameTurn | undefined>;
  getTurnById(sessionId: string, turnId: string): Promise<GameTurn | undefined>;
  addTurn(turn: GameTurn): Promise<void>;

  // --- Inventory ---
  getInventory(characterId: string): Promise<Inventory | undefined>;
  addItem(characterId: string, item: Item): Promise<boolean>;
  removeItem(characterId: string, itemId: string): Promise<boolean>;
  removeItemByName(characterId: string, itemName: string): Promise<boolean>;

  // --- Scenarios ---
  getScenario(id: string): ScenarioTemplate | undefined;
  getAllScenarios(): ScenarioTemplate[];
  createScenario(scenario: ScenarioTemplate): Promise<void>;
}
