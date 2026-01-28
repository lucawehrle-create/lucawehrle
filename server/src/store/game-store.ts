import type {
  User,
  Character,
  GameSession,
  GameTurn,
  Inventory,
  ScenarioTemplate,
  Item,
} from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory data store for game state.
 * In production, this would be backed by a database (PostgreSQL, MongoDB, etc.).
 */
export class GameStore {
  private users = new Map<string, User>();
  private characters = new Map<string, Character>();
  private sessions = new Map<string, GameSession>();
  private turns = new Map<string, GameTurn[]>();
  private inventories = new Map<string, Inventory>();
  private scenarios = new Map<string, ScenarioTemplate>();

  constructor() {
    this.seedDefaultScenarios();
  }

  // --- Users ---

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  createUser(username: string, email: string): User {
    const user: User = {
      id: uuidv4(),
      username,
      email,
      subscriptionTier: "free",
      energy: {
        current: 0,
        max: 50,
        lastRechargeAt: new Date().toISOString(),
        dailyActionsUsed: 0,
        dailyActionsMax: 10,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  updateUser(user: User): void {
    this.users.set(user.id, user);
  }

  // --- Characters ---

  getCharacter(id: string): Character | undefined {
    return this.characters.get(id);
  }

  getCharactersByUser(userId: string): Character[] {
    return Array.from(this.characters.values()).filter((c) => c.userId === userId);
  }

  createCharacter(character: Character): void {
    this.characters.set(character.id, character);
    // Create initial inventory
    this.inventories.set(character.id, {
      characterId: character.id,
      items: [],
      gold: 50,
      maxSlots: 20,
    });
  }

  updateCharacter(character: Character): void {
    this.characters.set(character.id, character);
  }

  // --- Sessions ---

  getSession(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  getSessionsByUser(userId: string): GameSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  createSession(session: GameSession): void {
    this.sessions.set(session.id, session);
    this.turns.set(session.id, []);
  }

  updateSession(session: GameSession): void {
    this.sessions.set(session.id, session);
  }

  // --- Turns ---

  getTurns(sessionId: string): GameTurn[] {
    return this.turns.get(sessionId) ?? [];
  }

  getLastTurn(sessionId: string): GameTurn | undefined {
    const sessionTurns = this.turns.get(sessionId) ?? [];
    return sessionTurns[sessionTurns.length - 1];
  }

  addTurn(turn: GameTurn): void {
    const sessionTurns = this.turns.get(turn.sessionId) ?? [];
    sessionTurns.push(turn);
    this.turns.set(turn.sessionId, sessionTurns);
  }

  // --- Inventory ---

  getInventory(characterId: string): Inventory | undefined {
    return this.inventories.get(characterId);
  }

  addItem(characterId: string, item: Item): boolean {
    const inventory = this.inventories.get(characterId);
    if (!inventory) return false;
    if (inventory.items.length >= inventory.maxSlots) return false;

    inventory.items.push(item);
    this.inventories.set(characterId, inventory);
    return true;
  }

  removeItem(characterId: string, itemId: string): boolean {
    const inventory = this.inventories.get(characterId);
    if (!inventory) return false;

    const idx = inventory.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    inventory.items.splice(idx, 1);
    this.inventories.set(characterId, inventory);
    return true;
  }

  // --- Scenarios ---

  getScenario(id: string): ScenarioTemplate | undefined {
    return this.scenarios.get(id);
  }

  getAllScenarios(): ScenarioTemplate[] {
    return Array.from(this.scenarios.values());
  }

  createScenario(scenario: ScenarioTemplate): void {
    this.scenarios.set(scenario.id, scenario);
  }

  private seedDefaultScenarios(): void {
    const defaults: ScenarioTemplate[] = [
      {
        id: "scenario_lost_mines",
        title: "The Lost Mines of Drakenvault",
        description: "Deep beneath the Ironspine Mountains lies a forgotten dwarven mine, now overrun by creatures of darkness. Legends speak of a priceless gemstone hidden in its depths.",
        genre: "fantasy",
        difficulty: "medium",
        openingNarrative: "You stand at the entrance of a crumbling mine shaft. Cold air flows from within, carrying the faint smell of sulfur and old stone. Your torch flickers as you peer into the darkness below.",
        setting: "A vast underground mine complex beneath snow-capped mountains, with crumbling stone corridors, underground rivers, and crystal-filled caverns.",
        tags: ["dungeon", "exploration", "combat", "treasure"],
      },
      {
        id: "scenario_haunted_manor",
        title: "The Haunting of Ravenshollow Manor",
        description: "The once-grand Ravenshollow Manor has stood abandoned for decades. Now, strange lights have been seen in its windows, and the villagers whisper of an ancient curse.",
        genre: "horror",
        difficulty: "hard",
        openingNarrative: "Rain lashes against your cloak as you approach the wrought-iron gates of Ravenshollow Manor. Lightning illuminates the decrepit building, and for a moment, you swear you see a figure in an upper window.",
        setting: "A Gothic Victorian manor on a hilltop, surrounded by dead gardens and a graveyard. Inside: dusty ballrooms, secret passages, and a haunted library.",
        tags: ["horror", "mystery", "undead", "puzzle"],
      },
      {
        id: "scenario_dragon_market",
        title: "The Dragon's Market",
        description: "In the floating city of Aethermist, a legendary market appears once a century, run by an ancient dragon who trades in memories and secrets.",
        genre: "fantasy",
        difficulty: "easy",
        openingNarrative: "The floating platform creaks as it ascends through the clouds. When you step off, you're greeted by an impossible sight: market stalls stretching as far as the eye can see, vendors of every race hawking wares that shimmer with magic.",
        setting: "A magical floating marketplace above the clouds, with colorful tents, exotic creatures, and vendors selling enchanted items.",
        tags: ["social", "trading", "magic", "peaceful"],
      },
      {
        id: "scenario_void_breach",
        title: "Breach in the Void",
        description: "Reality itself is tearing apart. Creatures from between dimensions are pouring through rifts in space, and only you can reach the Nexus Crystal to seal the breach.",
        genre: "scifi",
        difficulty: "legendary",
        openingNarrative: "The sky splits with a deafening crack. Purple energy cascades across the horizon as reality fractures like broken glass. Around you, buildings begin to distort and shift. Time is running out.",
        setting: "A city at the intersection of multiple dimensions, where physics breaks down and landscapes blend together - medieval castles merged with futuristic technology.",
        tags: ["dimensional", "combat", "puzzle", "urgency"],
      },
    ];

    for (const scenario of defaults) {
      this.scenarios.set(scenario.id, scenario);
    }
  }
}
