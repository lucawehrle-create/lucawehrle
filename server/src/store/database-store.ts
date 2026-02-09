/**
 * Database Store - Persistent storage using Prisma/PostgreSQL
 *
 * Replaces the in-memory GameStore with persistent database storage.
 * All methods are async to support database operations.
 */

import { prisma } from "../db/prisma.js";
import type {
  User,
  Character,
  GameSession,
  GameTurn,
  Inventory,
  ScenarioTemplate,
  Item,
  AbilityScores,
  CharacterAppearance,
  ItemProperties,
  ScannedObjectData,
  ActionOption,
  PlayerAction,
  DiceRoll,
  SceneMood,
} from "@aetheria/shared";
import type { IGameStore } from "./store-interface.js";
import {
  SubscriptionTier as PrismaSubscriptionTier,
  CharacterRace as PrismaCharacterRace,
  CharacterClass as PrismaCharacterClass,
  ItemCategory as PrismaItemCategory,
  ItemRarity as PrismaItemRarity,
  GameGenre as PrismaGameGenre,
  SceneMood as PrismaSceneMood,
} from "@prisma/client";

// ============================================
// Enum Converters
// ============================================

function toPrismaSubscriptionTier(tier: string): PrismaSubscriptionTier {
  const map: Record<string, PrismaSubscriptionTier> = {
    free: "FREE",
    premium: "PREMIUM",
    creator: "CREATOR",
  };
  return map[tier] ?? "FREE";
}

function fromPrismaSubscriptionTier(tier: PrismaSubscriptionTier): "free" | "premium" | "creator" {
  const map: Record<PrismaSubscriptionTier, "free" | "premium" | "creator"> = {
    FREE: "free",
    PREMIUM: "premium",
    CREATOR: "creator",
  };
  return map[tier];
}

function toPrismaRace(race: string): PrismaCharacterRace {
  return race.toUpperCase() as PrismaCharacterRace;
}

function fromPrismaRace(race: PrismaCharacterRace): string {
  return race.toLowerCase();
}

function toPrismaClass(cls: string): PrismaCharacterClass {
  return cls.toUpperCase() as PrismaCharacterClass;
}

function fromPrismaClass(cls: PrismaCharacterClass): string {
  return cls.toLowerCase();
}

function toPrismaItemCategory(category: string): PrismaItemCategory {
  return category.toUpperCase().replace(/-/g, "_") as PrismaItemCategory;
}

function fromPrismaItemCategory(category: PrismaItemCategory): string {
  return category.toLowerCase().replace(/_/g, "-");
}

function toPrismaItemRarity(rarity: string): PrismaItemRarity {
  return rarity.toUpperCase() as PrismaItemRarity;
}

function fromPrismaItemRarity(rarity: PrismaItemRarity): string {
  return rarity.toLowerCase();
}

function toPrismaGenre(genre: string): PrismaGameGenre {
  return genre.toUpperCase() as PrismaGameGenre;
}

function fromPrismaGenre(genre: PrismaGameGenre): string {
  return genre.toLowerCase();
}

function toPrismaMood(mood: string): PrismaSceneMood {
  return mood.toUpperCase() as PrismaSceneMood;
}

function fromPrismaMood(mood: PrismaSceneMood): SceneMood {
  return mood.toLowerCase() as SceneMood;
}

// ============================================
// Database Store
// ============================================

export class DatabaseStore implements IGameStore {
  private scenarioCache: Map<string, ScenarioTemplate> = new Map();
  private initialized = false;

  /**
   * Initialize the store and seed default data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Seed default scenarios if none exist
    const scenarioCount = await prisma.scenarioTemplate.count();
    if (scenarioCount === 0) {
      await this.seedDefaultScenarios();
    }

    // Load scenarios into cache
    const scenarios = await prisma.scenarioTemplate.findMany();
    for (const s of scenarios) {
      this.scenarioCache.set(s.id, this.mapScenarioFromPrisma(s));
    }

    this.initialized = true;
    console.log("[DatabaseStore] Initialized with", scenarioCount || 4, "scenarios");
  }

  // ============================================
  // Users
  // ============================================

  async getUser(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.mapUserFromPrisma(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ where: { username } });
    return user ? this.mapUserFromPrisma(user) : undefined;
  }

  async createUser(username: string, email: string): Promise<User> {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        subscriptionTier: "PREMIUM", // Premium for development
        energyCurrent: 0,
        energyMax: 500,
        dailyActionsUsed: 0,
        dailyActionsMax: Number.MAX_SAFE_INTEGER > 2147483647 ? 2147483647 : Number.MAX_SAFE_INTEGER,
      },
    });
    return this.mapUserFromPrisma(user);
  }

  async updateUser(user: User): Promise<void> {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: user.username,
        email: user.email,
        subscriptionTier: toPrismaSubscriptionTier(user.subscriptionTier),
        energyCurrent: user.energy.current,
        energyMax: user.energy.max,
        lastRechargeAt: new Date(user.energy.lastRechargeAt),
        dailyActionsUsed: user.energy.dailyActionsUsed,
        dailyActionsMax: Math.min(user.energy.dailyActionsMax, 2147483647),
        lastActiveAt: new Date(user.lastActiveAt),
      },
    });
  }

  private mapUserFromPrisma(user: any): User {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      subscriptionTier: fromPrismaSubscriptionTier(user.subscriptionTier),
      energy: {
        current: user.energyCurrent,
        max: user.energyMax,
        lastRechargeAt: user.lastRechargeAt.toISOString(),
        dailyActionsUsed: user.dailyActionsUsed,
        dailyActionsMax: user.dailyActionsMax,
      },
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
    };
  }

  // ============================================
  // Characters
  // ============================================

  async getCharacter(id: string): Promise<Character | undefined> {
    const character = await prisma.character.findUnique({ where: { id } });
    return character ? this.mapCharacterFromPrisma(character) : undefined;
  }

  async getCharactersByUser(userId: string): Promise<Character[]> {
    const characters = await prisma.character.findMany({ where: { userId } });
    return characters.map((c) => this.mapCharacterFromPrisma(c));
  }

  async createCharacter(character: Character): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Create character
      await tx.character.create({
        data: {
          id: character.id,
          userId: character.userId,
          name: character.name,
          race: toPrismaRace(character.race),
          characterClass: toPrismaClass(character.characterClass),
          level: character.level,
          experience: character.experience,
          hitPoints: character.hitPoints,
          maxHitPoints: character.maxHitPoints,
          armorClass: character.armorClass,
          abilities: character.abilities as any,
          appearance: character.appearance as any,
          portraitUrl: character.portraitUrl,
          backstory: character.backstory,
          traits: character.traits,
        },
      });

      // Create initial inventory
      await tx.inventory.create({
        data: {
          characterId: character.id,
          gold: 50,
          maxSlots: 20,
        },
      });
    });
  }

  async updateCharacter(character: Character): Promise<void> {
    await prisma.character.update({
      where: { id: character.id },
      data: {
        name: character.name,
        race: toPrismaRace(character.race),
        characterClass: toPrismaClass(character.characterClass),
        level: character.level,
        experience: character.experience,
        hitPoints: character.hitPoints,
        maxHitPoints: character.maxHitPoints,
        armorClass: character.armorClass,
        abilities: character.abilities as any,
        appearance: character.appearance as any,
        portraitUrl: character.portraitUrl,
        backstory: character.backstory,
        traits: character.traits,
      },
    });
  }

  private mapCharacterFromPrisma(c: any): Character {
    return {
      id: c.id,
      userId: c.userId,
      name: c.name,
      race: fromPrismaRace(c.race) as Character["race"],
      characterClass: fromPrismaClass(c.characterClass) as Character["characterClass"],
      level: c.level,
      experience: c.experience,
      hitPoints: c.hitPoints,
      maxHitPoints: c.maxHitPoints,
      armorClass: c.armorClass,
      abilities: c.abilities as AbilityScores,
      appearance: c.appearance as CharacterAppearance,
      portraitUrl: c.portraitUrl ?? undefined,
      backstory: c.backstory,
      traits: c.traits,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  // ============================================
  // Sessions
  // ============================================

  async getSession(id: string): Promise<GameSession | undefined> {
    const session = await prisma.gameSession.findUnique({ where: { id } });
    return session ? this.mapSessionFromPrisma(session) : undefined;
  }

  async getSessionsByUser(userId: string): Promise<GameSession[]> {
    const sessions = await prisma.gameSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return sessions.map((s) => this.mapSessionFromPrisma(s));
  }

  async createSession(session: GameSession): Promise<void> {
    await prisma.gameSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        characterId: session.characterId,
        title: session.title,
        scenarioId: session.scenario,
        genre: toPrismaGenre(session.genre ?? "fantasy"),
        setting: session.setting,
        currentChapter: session.currentChapter,
        turnCount: session.turnCount,
        mood: toPrismaMood(session.mood),
        isActive: session.isActive,
      },
    });
  }

  async updateSession(session: GameSession): Promise<void> {
    await prisma.gameSession.update({
      where: { id: session.id },
      data: {
        title: session.title,
        currentChapter: session.currentChapter,
        turnCount: session.turnCount,
        mood: toPrismaMood(session.mood),
        isActive: session.isActive,
      },
    });
  }

  private mapSessionFromPrisma(s: any): GameSession {
    return {
      id: s.id,
      userId: s.userId,
      characterId: s.characterId,
      title: s.title,
      scenario: s.scenarioId,
      genre: fromPrismaGenre(s.genre) as GameSession["genre"],
      setting: s.setting ?? undefined,
      currentChapter: s.currentChapter,
      turnCount: s.turnCount,
      mood: fromPrismaMood(s.mood),
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  // ============================================
  // Turns
  // ============================================

  async getTurns(sessionId: string): Promise<GameTurn[]> {
    const turns = await prisma.gameTurn.findMany({
      where: { sessionId },
      orderBy: { turnNumber: "asc" },
    });
    return turns.map((t) => this.mapTurnFromPrisma(t));
  }

  async getLastTurn(sessionId: string): Promise<GameTurn | undefined> {
    const turn = await prisma.gameTurn.findFirst({
      where: { sessionId },
      orderBy: { turnNumber: "desc" },
    });
    return turn ? this.mapTurnFromPrisma(turn) : undefined;
  }

  async getTurnById(sessionId: string, turnId: string): Promise<GameTurn | undefined> {
    const turn = await prisma.gameTurn.findFirst({
      where: { sessionId, id: turnId },
    });
    return turn ? this.mapTurnFromPrisma(turn) : undefined;
  }

  async addTurn(turn: GameTurn): Promise<void> {
    await prisma.gameTurn.create({
      data: {
        id: turn.id,
        sessionId: turn.sessionId,
        turnNumber: turn.turnNumber,
        narrative: turn.narrative,
        mood: toPrismaMood(turn.mood),
        imagePrompt: turn.imagePrompt,
        imageUrl: turn.imageUrl,
        options: turn.options as any,
        playerAction: turn.playerAction as any,
        diceRolls: turn.diceRolls as any,
      },
    });
  }

  async updateTurnImage(turnId: string, imageUrl: string): Promise<void> {
    await prisma.gameTurn.update({
      where: { id: turnId },
      data: { imageUrl },
    });
  }

  private mapTurnFromPrisma(t: any): GameTurn {
    return {
      id: t.id,
      sessionId: t.sessionId,
      turnNumber: t.turnNumber,
      narrative: t.narrative,
      mood: fromPrismaMood(t.mood),
      imagePrompt: t.imagePrompt ?? undefined,
      imageUrl: t.imageUrl ?? undefined,
      options: t.options as ActionOption[],
      playerAction: t.playerAction as PlayerAction | undefined,
      diceRolls: t.diceRolls as DiceRoll[],
      timestamp: t.timestamp.toISOString(),
    };
  }

  // ============================================
  // Inventory
  // ============================================

  async getInventory(characterId: string): Promise<Inventory | undefined> {
    const inventory = await prisma.inventory.findUnique({
      where: { characterId },
      include: { items: true },
    });
    return inventory ? this.mapInventoryFromPrisma(inventory) : undefined;
  }

  async addItem(characterId: string, item: Item): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { characterId },
      include: { items: true },
    });

    if (!inventory || inventory.items.length >= inventory.maxSlots) {
      return false;
    }

    await prisma.item.create({
      data: {
        id: item.id,
        inventoryId: inventory.id,
        name: item.name,
        description: item.description,
        category: toPrismaItemCategory(item.category),
        rarity: toPrismaItemRarity(item.rarity),
        visualDescription: item.visualDescription,
        imageUrl: item.imageUrl,
        properties: item.properties as any,
        scanData: item.scanData as any,
        acquiredTurnId: item.acquiredTurnId,
      },
    });

    return true;
  }

  async removeItem(characterId: string, itemId: string): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { characterId },
    });

    if (!inventory) return false;

    try {
      await prisma.item.delete({
        where: { id: itemId, inventoryId: inventory.id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async removeItemByName(characterId: string, itemName: string): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { characterId },
      include: { items: true },
    });

    if (!inventory) return false;

    const item = inventory.items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase()
    );

    if (!item) return false;

    await prisma.item.delete({ where: { id: item.id } });
    return true;
  }

  async updateInventoryGold(characterId: string, gold: number): Promise<void> {
    await prisma.inventory.update({
      where: { characterId },
      data: { gold },
    });
  }

  private mapInventoryFromPrisma(inv: any): Inventory {
    return {
      characterId: inv.characterId,
      items: inv.items.map((i: any) => this.mapItemFromPrisma(i)),
      gold: inv.gold,
      maxSlots: inv.maxSlots,
      equippedWeapon: inv.equippedWeapon ?? undefined,
      equippedArmor: inv.equippedArmor ?? undefined,
    };
  }

  private mapItemFromPrisma(i: any): Item {
    return {
      id: i.id,
      name: i.name,
      description: i.description,
      category: fromPrismaItemCategory(i.category) as Item["category"],
      rarity: fromPrismaItemRarity(i.rarity) as Item["rarity"],
      visualDescription: i.visualDescription,
      imageUrl: i.imageUrl ?? undefined,
      properties: i.properties as ItemProperties,
      scanData: i.scanData as ScannedObjectData | undefined,
      acquiredAt: i.acquiredAt.toISOString(),
      acquiredTurnId: i.acquiredTurnId ?? "",
    };
  }

  // ============================================
  // Scenarios
  // ============================================

  getScenario(id: string): ScenarioTemplate | undefined {
    return this.scenarioCache.get(id);
  }

  getAllScenarios(): ScenarioTemplate[] {
    return Array.from(this.scenarioCache.values());
  }

  async createScenario(scenario: ScenarioTemplate): Promise<void> {
    await prisma.scenarioTemplate.create({
      data: {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        genre: toPrismaGenre(scenario.genre),
        difficulty: scenario.difficulty,
        openingNarrative: scenario.openingNarrative,
        setting: scenario.setting,
        tags: scenario.tags,
        creatorId: scenario.creatorId,
        isPublic: true,
      },
    });
    this.scenarioCache.set(scenario.id, scenario);
  }

  private mapScenarioFromPrisma(s: any): ScenarioTemplate {
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      genre: fromPrismaGenre(s.genre) as ScenarioTemplate["genre"],
      difficulty: s.difficulty as ScenarioTemplate["difficulty"],
      openingNarrative: s.openingNarrative,
      setting: s.setting,
      tags: s.tags,
      creatorId: s.creatorId ?? undefined,
    };
  }

  private async seedDefaultScenarios(): Promise<void> {
    const defaults: Omit<ScenarioTemplate, "creatorId">[] = [
      {
        id: "scenario_lost_mines",
        title: "Die verlorenen Minen von Drachenfels",
        description: "Tief unter den Eisenruecken-Bergen liegt eine vergessene Zwergenmine, nun ueberrannt von Kreaturen der Dunkelheit. Legenden erzaehlen von einem unbezahlbaren Edelstein in ihren Tiefen.",
        genre: "fantasy",
        difficulty: "medium",
        openingNarrative: "Du stehst am Eingang eines broeckelnden Minenschachts. Kalte Luft stroemt dir entgegen, getragen vom schwachen Geruch nach Schwefel und altem Gestein. Deine Fackel flackert, als du in die Dunkelheit hinabspaehst. Irgendwo in der Tiefe hallt ein metallisches Klopfen wider — als wuerde etwas auf dich warten.",
        setting: "A vast underground dwarven mine complex beneath snow-capped mountains, with crumbling stone corridors, underground rivers, glowing crystal caverns, and ancient dwarven runes on the walls.",
        tags: ["Dungeon", "Erkundung", "Kampf", "Schatz"],
      },
      {
        id: "scenario_haunted_manor",
        title: "Der Fluch von Rabenstein",
        description: "Das einst prachtvolle Herrenhaus Rabenstein steht seit Jahrzehnten verlassen. Nun wurden seltsame Lichter in seinen Fenstern gesehen, und die Dorfbewohner fluestern von einem uralten Fluch.",
        genre: "horror",
        difficulty: "hard",
        openingNarrative: "Regen peitscht gegen deinen Umhang, waehrend du dich dem schmiedeeisernen Tor von Herrenhaus Rabenstein naeherst. Ein Blitz erhellt das verfallene Gebaeude, und fuer einen kurzen Moment — du koenntest schwoeren — siehst du eine Gestalt in einem der oberen Fenster. Die Tuer steht einen Spalt offen, als wuerdest du erwartet.",
        setting: "A Gothic Victorian manor on a hilltop in a thunderstorm, surrounded by dead gardens and an overgrown graveyard. Inside: dusty ballrooms with broken chandeliers, secret passages behind bookshelves, and a haunted library with floating books.",
        tags: ["Horror", "Mysterium", "Untote", "Raetsel"],
      },
      {
        id: "scenario_dragon_market",
        title: "Der Markt des Drachen",
        description: "In der schwebenden Stadt Aethernebel erscheint einmal im Jahrhundert ein legendaerer Markt, gefuehrt von einem uralten Drachen, der mit Erinnerungen und Geheimnissen handelt.",
        genre: "fantasy",
        difficulty: "easy",
        openingNarrative: "Die schwebende Plattform knarrt, waehrend sie durch die Wolken aufsteigt. Als du absteigst, bietet sich dir ein unmoeglicher Anblick: Marktstaende, so weit das Auge reicht, Haendler aller Voelker, die Waren feilbieten, die im Licht magisch schimmern. Der suesse Duft exotischer Gewuerze mischt sich mit dem Knistern arkaner Energie.",
        setting: "A magical floating marketplace above the clouds at sunset, with colorful silk tents, exotic creatures, and vendors selling glowing enchanted items. A massive ancient dragon coiled around a crystal spire at the center.",
        tags: ["Sozial", "Handel", "Magie", "Friedlich"],
      },
      {
        id: "scenario_void_breach",
        title: "Riss im Nichts",
        description: "Die Realitaet selbst zerreisst. Kreaturen aus den Zwischendimensionen stroemen durch Risse im Raum, und nur du kannst den Nexus-Kristall erreichen, um den Bruch zu versiegeln.",
        genre: "scifi",
        difficulty: "legendary",
        openingNarrative: "Der Himmel spaltet sich mit einem ohrenbetaeubenden Knall. Violette Energie ergiesst sich ueber den Horizont, waehrend die Realitaet wie Glas zersplittert. Um dich herum beginnen Gebaeude sich zu verzerren und zu verschieben. Mittelalterliche Tuerme verschmelzen mit futuristischer Technologie. Die Zeit laeuft ab.",
        setting: "A city at the intersection of multiple dimensions where physics breaks down — medieval castles merged with futuristic neon technology, floating debris, purple dimensional rifts tearing through the sky.",
        tags: ["Dimensional", "Kampf", "Raetsel", "Zeitdruck"],
      },
    ];

    await prisma.scenarioTemplate.createMany({
      data: defaults.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        genre: toPrismaGenre(s.genre),
        difficulty: s.difficulty,
        openingNarrative: s.openingNarrative,
        setting: s.setting,
        tags: s.tags,
        isPublic: true,
      })),
    });
  }
}

// Create singleton instance
export const databaseStore = new DatabaseStore();
