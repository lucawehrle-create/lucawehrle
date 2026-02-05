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
    // Default to premium tier for unlimited actions during development
    // Change to "free" for production with monetization
    const user: User = {
      id: uuidv4(),
      username,
      email,
      subscriptionTier: "premium",
      energy: {
        current: 0,
        max: 500,
        lastRechargeAt: new Date().toISOString(),
        dailyActionsUsed: 0,
        dailyActionsMax: Number.MAX_SAFE_INTEGER,
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

  getTurnById(sessionId: string, turnId: string): GameTurn | undefined {
    const sessionTurns = this.turns.get(sessionId) ?? [];
    return sessionTurns.find((t) => t.id === turnId);
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

  removeItemByName(characterId: string, itemName: string): boolean {
    const inventory = this.inventories.get(characterId);
    if (!inventory) return false;

    const idx = inventory.items.findIndex(
      (i) => i.name.toLowerCase() === itemName.toLowerCase(),
    );
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

    for (const scenario of defaults) {
      this.scenarios.set(scenario.id, scenario);
    }
  }
}
