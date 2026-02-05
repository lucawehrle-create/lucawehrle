import type {
  Character,
  GameSession,
  GameTurn,
  PlayerAction,
  ActionOption,
  DiceRoll,
  GameEvent,
  SceneMood,
  ScenarioTemplate,
  ContextSummary,
  Inventory,
} from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";
import {
  resolveSkillCheck,
  resolveCombatAttack,
  inferAbilityForAction,
  inferDifficulty,
} from "./rules.js";
import type { AIService } from "../services/ai/ai-service.js";
import type { MemoryService } from "../services/memory/memory-service.js";
import type { SafetyService } from "../services/safety/safety-service.js";

/**
 * The Dungeon Master orchestrates the game loop:
 * 1. Receives player action
 * 2. Resolves mechanics (dice rolls, rules)
 * 3. Generates narrative via AI
 * 4. Updates game state
 * 5. Returns the new turn
 */
export class DungeonMaster {
  constructor(
    private aiService: AIService,
    private memoryService: MemoryService,
    private safetyService: SafetyService
  ) {}

  /**
   * Starts a new game session with an opening narrative.
   */
  async startSession(
    character: Character,
    scenario: ScenarioTemplate,
    inventory: Inventory
  ): Promise<{ session: GameSession; firstTurn: GameTurn }> {
    const sessionId = uuidv4();

    const session: GameSession = {
      id: sessionId,
      userId: character.userId,
      characterId: character.id,
      title: scenario.title,
      scenario: scenario.id,
      genre: scenario.genre,
      setting: scenario.setting,
      currentChapter: 1,
      turnCount: 0,
      mood: "exploration",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Build the opening context
    const characterSummary = this.buildCharacterSummary(character);
    const inventoryContext = this.buildInventoryContext(inventory);
    const scenarioContext = this.buildScenarioContext(scenario);

    // Generate opening narrative
    const aiResponse = await this.aiService.generateText({
      sessionId,
      characterSummary,
      recentContext: "",
      memoryContext: "",
      inventoryContext,
      playerAction: `[GAME START] ${scenario.openingNarrative}`,
      mood: "exploration",
      modelTier: "standard",
      scenarioContext,
    });

    // Safety check
    const safetyResult = await this.safetyService.checkContent({
      content: aiResponse.narrative,
      contentType: "text",
    });

    const narrative = safetyResult.safe
      ? aiResponse.narrative
      : safetyResult.filteredContent ?? "The story begins in a mysterious land...";

    const options: ActionOption[] = aiResponse.options.map((opt) => ({
      id: uuidv4(),
      text: opt.text,
      type: opt.type as ActionOption["type"],
      requiredAbility: opt.requiredAbility,
      difficultyClass: opt.difficultyClass,
    }));

    const firstTurn: GameTurn = {
      id: uuidv4(),
      sessionId,
      turnNumber: 1,
      narrative,
      mood: aiResponse.mood as SceneMood,
      imagePrompt: aiResponse.imagePrompt,
      options,
      diceRolls: [],
      timestamp: new Date().toISOString(),
    };

    // Store opening in memory
    await this.memoryService.storeMemory({
      id: uuidv4(),
      sessionId,
      turnId: firstTurn.id,
      turnNumber: 1,
      content: narrative,
      category: "location_discovery",
      importance: 0.8,
      entities: [],
      timestamp: firstTurn.timestamp,
    });

    return { session, firstTurn };
  }

  /**
   * Processes a player action and generates the next turn.
   */
  async processAction(
    session: GameSession,
    character: Character,
    inventory: Inventory,
    action: PlayerAction,
    previousTurn: GameTurn
  ): Promise<{ turn: GameTurn; events: GameEvent[]; updatedSession: GameSession }> {
    const turnNumber = session.turnCount + 1;
    const diceRolls: DiceRoll[] = [];
    const events: GameEvent[] = [];

    // Resolve mechanics based on action type
    let mechanicsContext = "";

    if (action.type === "option" && action.optionId) {
      const selectedOption = previousTurn.options.find((o) => o.id === action.optionId);
      if (selectedOption) {
        const ability = inferAbilityForAction(selectedOption, character.characterClass);
        const difficulty = inferDifficulty(selectedOption, turnNumber);

        if (selectedOption.type === "combat") {
          // Scale enemy AC with character level (13 at L1, up to 18 at L20)
          const enemyAC = 13 + Math.floor(character.level / 4);
          const combat = resolveCombatAttack(character, enemyAC, selectedOption.text);
          diceRolls.push(combat.attackResult);
          if (combat.damageResult) {
            diceRolls.push(combat.damageResult);
          }
          mechanicsContext = combat.attackResult.success
            ? `[ATTACK HIT${combat.attackResult.criticalHit ? " - CRITICAL!" : ""}] Rolled ${combat.attackResult.total} vs AC ${enemyAC}. ${combat.damageResult ? `Dealt ${combat.damageResult.total} damage.` : ""}`
            : `[ATTACK MISSED${combat.attackResult.criticalFail ? " - CRITICAL FAIL!" : ""}] Rolled ${combat.attackResult.total} vs AC ${enemyAC}.`;
        } else {
          const check = resolveSkillCheck(character, ability, difficulty, selectedOption.text);
          diceRolls.push(check);
          mechanicsContext = check.success
            ? `[CHECK PASSED${check.criticalHit ? " - NATURAL 20!" : ""}] ${ability} check: rolled ${check.total} vs DC ${check.results[0] + check.modifier >= (selectedOption.difficultyClass ?? 15) ? selectedOption.difficultyClass : "?"}.`
            : `[CHECK FAILED${check.criticalFail ? " - NATURAL 1!" : ""}] ${ability} check: rolled ${check.total}.`;
        }
      }
    }

    // Retrieve memories and context summary in parallel
    const [memories, contextSummary] = await Promise.all([
      this.memoryService.queryMemories({
        sessionId: session.id,
        queryText: action.text,
        maxResults: 5,
        minImportance: 0.3,
      }),
      this.memoryService.getContextSummary(session.id),
    ]);

    const memoryContext = memories.map((m) => m.content).join("\n");

    // Build AI prompt context
    const characterSummary = this.buildCharacterSummary(character);
    const inventoryContext = this.buildInventoryContext(inventory);
    const recentContext = contextSummary
      ? `${contextSummary.overallSummary}\n\nRecent: ${contextSummary.recentEvents}`
      : `Previous scene: ${previousTurn.narrative}`;

    const playerActionText = mechanicsContext
      ? `${action.text}\n${mechanicsContext}`
      : action.text;

    // Build scenario context from session if available
    const scenarioContext = session.genre && session.setting
      ? `Genre: ${session.genre}\nSetting (KONSISTENT halten): ${session.setting}`
      : undefined;

    // Generate narrative response
    const aiResponse = await this.aiService.generateText({
      sessionId: session.id,
      characterSummary,
      recentContext,
      memoryContext,
      inventoryContext,
      playerAction: playerActionText,
      mood: session.mood,
      modelTier: "standard",
      scenarioContext,
    });

    // Safety check
    const safetyResult = await this.safetyService.checkContent({
      content: aiResponse.narrative,
      contentType: "text",
    });

    const narrative = safetyResult.safe
      ? aiResponse.narrative
      : safetyResult.filteredContent ?? "The adventure continues...";

    // Build action options
    const options: ActionOption[] = aiResponse.options.map((opt) => ({
      id: uuidv4(),
      text: opt.text,
      type: opt.type as ActionOption["type"],
      requiredAbility: opt.requiredAbility,
      difficultyClass: opt.difficultyClass,
    }));

    const newMood = aiResponse.mood as SceneMood;
    const turnId = uuidv4();

    // Process events from AI (using the actual turn ID)
    for (const evt of aiResponse.events) {
      events.push({
        type: evt.type as GameEvent["type"],
        payload: evt.payload,
        turnId,
        timestamp: new Date().toISOString(),
      });
    }

    const turn: GameTurn = {
      id: turnId,
      sessionId: session.id,
      turnNumber,
      narrative,
      mood: newMood,
      imagePrompt: aiResponse.imagePrompt,
      options,
      playerAction: action,
      diceRolls,
      timestamp: new Date().toISOString(),
    };

    // Store turn in memory
    const importance = this.calculateImportance(events, diceRolls);
    await this.memoryService.storeMemory({
      id: uuidv4(),
      sessionId: session.id,
      turnId: turn.id,
      turnNumber,
      content: `Player: ${action.text}\n${mechanicsContext}\nResult: ${narrative}`,
      category: this.categorizeEvent(events, newMood),
      importance,
      entities: [],
      timestamp: turn.timestamp,
    });

    // Update session
    const updatedSession: GameSession = {
      ...session,
      turnCount: turnNumber,
      mood: newMood,
      updatedAt: new Date().toISOString(),
    };

    return { turn, events, updatedSession };
  }

  private buildCharacterSummary(character: Character): string {
    // Build a rich character summary that the AI can use to shape narrative tone
    const abilityLine = `STR:${character.abilities.strength} DEX:${character.abilities.dexterity} CON:${character.abilities.constitution} INT:${character.abilities.intelligence} WIS:${character.abilities.wisdom} CHA:${character.abilities.charisma}`;

    // Highlight primary stat for class flavor
    const classStrengths: Record<string, string> = {
      warrior: "Stark im Nahkampf, fuehrt Waffen meisterhaft",
      mage: "Beherrscht arkane Kuenste, erkennt magische Phaenomene",
      rogue: "Geschickt in Heimlichkeit, entdeckt verborgene Gefahren",
      cleric: "Goettlich gesegnet, heilt und schuetzt",
      ranger: "Meister der Wildnis, liest Spuren und Zeichen der Natur",
      bard: "Charismatisch, gewinnt Herzen und entdeckt Geheimnisse durch Worte",
      paladin: "Heiliger Krieger, spuert Boeses und verteidigt Unschuldige",
    };
    const classFlavor = classStrengths[character.characterClass] ?? "";

    // Traits influence how the character perceives and reacts
    const traitInfluence = character.traits.length > 0
      ? `Persoenlichkeit (beeinflusst Wahrnehmung und Reaktionen): ${character.traits.join(", ")}`
      : "";

    // Backstory provides personal history to reference
    const backstoryContext = character.backstory
      ? `Hintergrundgeschichte (referenziere wenn passend): ${character.backstory}`
      : "";

    return [
      `Name: ${character.name}`,
      `Rasse: ${character.race}, Klasse: ${character.characterClass} (Level ${character.level})`,
      classFlavor && `Klassentalent: ${classFlavor}`,
      `HP: ${character.hitPoints}/${character.maxHitPoints}, AC: ${character.armorClass}`,
      abilityLine,
      `Aussehen: ${character.appearance.hairColor} ${character.appearance.hairStyle} Haar, ${character.appearance.eyeColor} Augen, ${character.appearance.skinTone} Haut, ${character.appearance.height}, ${character.appearance.build}, traegt ${character.appearance.clothing}`,
      traitInfluence,
      backstoryContext,
    ].filter(Boolean).join("\n");
  }

  /** Build scenario context string for narrative consistency. */
  private buildScenarioContext(scenario: ScenarioTemplate): string {
    // Genre guidance + setting reference for the AI to maintain consistency
    const genreDescriptions: Record<string, string> = {
      fantasy: "Klassische Fantasy — episch, heroisch, magisch, wunderbar",
      horror: "Horror — beklemmend, unheimlich, langsam aufbauende Spannung, Andeutungen statt Enthuellung",
      scifi: "Science-Fiction — fremd, technologisch, dimensionsuebergreifend, ehrfuerchterregend",
      mystery: "Mysterium — raetselhaft, vielschichtig, jedes Detail ist ein Hinweis",
      comedy: "Komoedie — humorvoll, absurde Situationen, selbstironisch, trotzdem funktionale Handlung",
    };
    const genreDesc = genreDescriptions[scenario.genre] ?? "Fantasy";

    return [
      `Titel: "${scenario.title}"`,
      `Genre: ${scenario.genre} — ${genreDesc}`,
      `Setting (KONSISTENT halten in imagePrompt): ${scenario.setting}`,
      `Tags: ${scenario.tags.join(", ")}`,
    ].join("\n");
  }

  private buildInventoryContext(inventory: Inventory): string {
    if (inventory.items.length === 0) {
      return "Inventory: Empty. Gold: " + inventory.gold;
    }
    const items = inventory.items.map((i) => `- ${i.name} (${i.category}): ${i.description}`);
    return `Inventory (${inventory.items.length}/${inventory.maxSlots}):\n${items.join("\n")}\nGold: ${inventory.gold}`;
  }

  private calculateImportance(events: GameEvent[], diceRolls: DiceRoll[]): number {
    let importance = 0.5;

    if (events.some((e) => e.type === "quest_complete" || e.type === "level_up")) {
      importance = 1.0;
    } else if (events.some((e) => e.type === "npc_met" || e.type === "quest_start")) {
      importance = 0.9;
    } else if (events.some((e) => e.type === "item_acquired")) {
      importance = 0.7;
    }

    if (diceRolls.some((r) => r.criticalHit || r.criticalFail)) {
      importance = Math.max(importance, 0.8);
    }

    return importance;
  }

  private categorizeEvent(
    events: GameEvent[],
    mood: SceneMood
  ): import("@aetheria/shared").MemoryCategory {
    if (events.some((e) => e.type === "npc_met")) return "npc_interaction";
    if (events.some((e) => e.type === "item_acquired" || e.type === "item_lost")) return "item_event";
    if (events.some((e) => e.type === "quest_start" || e.type === "quest_complete")) return "quest_event";
    if (events.some((e) => e.type === "combat_start" || e.type === "combat_end")) return "combat_event";
    if (mood === "combat" || mood === "danger") return "combat_event";
    if (mood === "exploration") return "location_discovery";
    return "player_decision";
  }
}
