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
    previousTurn: GameTurn,
    recentTurns: GameTurn[] = []
  ): Promise<{ turn: GameTurn; events: GameEvent[]; updatedSession: GameSession }> {
    const turnNumber = session.turnCount + 1;
    const diceRolls: DiceRoll[] = [];
    const events: GameEvent[] = [];

    // Resolve mechanics based on action type
    let mechanicsContext = "";
    let outcomeDirective = ""; // Clear instruction for the AI about what MUST happen

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
          if (combat.attackResult.success) {
            mechanicsContext = `[ANGRIFF TRIFFT${combat.attackResult.criticalHit ? " - KRITISCH!" : ""}] Wuerfelergebnis ${combat.attackResult.total} gegen RK ${enemyAC}. ${combat.damageResult ? `${combat.damageResult.total} Schaden verursacht.` : ""}`;
            outcomeDirective = `PFLICHT: Der Angriff TRIFFT. Beschreibe wie der Schlag/Zauber den Gegner trifft und Schaden verursacht.`;
          } else {
            mechanicsContext = `[ANGRIFF VERFEHLT${combat.attackResult.criticalFail ? " - PATZER!" : ""}] Wuerfelergebnis ${combat.attackResult.total} gegen RK ${enemyAC}.`;
            outcomeDirective = `PFLICHT: Der Angriff VERFEHLT. Der Gegner weicht aus oder blockt. Der Spieler bleibt im Kampf.`;
          }
        } else {
          // Check if this is a trivial action that should auto-succeed
          const dc = selectedOption.difficultyClass ?? 10;
          const isTrivialAction = this.isTrivialAction(selectedOption, action.text, dc);

          if (isTrivialAction) {
            // AUTO-SUCCESS for trivial actions - no dice roll needed!
            mechanicsContext = `[AUTOMATISCHER ERFOLG] Einfache Aktion ohne Wuerfelwurf.`;
            outcomeDirective = `PFLICHT: Die Aktion "${action.text}" GELINGT AUTOMATISCH. Diese Aktion ist einfach genug, dass sie keinen Wuerfelwurf erfordert. Beschreibe wie der Spieler erfolgreich ist und die Geschichte voranschreitet.`;
          } else {
            // Normal skill check for non-trivial actions
            const check = resolveSkillCheck(character, ability, difficulty, selectedOption.text);
            diceRolls.push(check);
            if (check.success) {
              mechanicsContext = `[PROBE BESTANDEN${check.criticalHit ? " - NAT 20!" : ""}] ${ability}-Probe: ${check.total} gegen SG ${dc}.`;
              outcomeDirective = `PFLICHT: Die Aktion "${action.text}" GELINGT VOLLSTAENDIG. Der Spieler erreicht sein Ziel. Wenn er irgendwo hinein will, ist er DRINNEN. Wenn er etwas oeffnen will, ist es OFFEN. Wenn er jemanden ueberzeugen will, ist die Person UEBERZEUGT.`;
            } else {
              mechanicsContext = `[PROBE GESCHEITERT${check.criticalFail ? " - NAT 1!" : ""}] ${ability}-Probe: ${check.total} gegen SG ${dc}.`;
              // "Fail Forward" - even on failure, something happens to advance the story
              outcomeDirective = `PFLICHT: Die Aktion "${action.text}" SCHEITERT TEILWEISE. Der Spieler erreicht sein Ziel nicht wie geplant, ABER die Geschichte geht trotzdem weiter. Statt komplettem Stillstand: Eine Komplikation tritt auf, ein neuer Hinweis erscheint, oder ein alternativer Weg oeffnet sich. Der Spieler kommt TROTZDEM voran, nur anders als erwartet.`;
            }
          }
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

    // Build explicit action history from recent turns to prevent repetition
    const actionHistory = this.buildActionHistory(recentTurns);

    // Combine context summary with action history
    let recentContext: string;
    if (contextSummary) {
      recentContext = `${contextSummary.overallSummary}\n\n${actionHistory}\n\nAktuelle Szene: ${contextSummary.recentEvents}`;
    } else {
      recentContext = `${actionHistory}\n\nAktuelle Szene: ${previousTurn.narrative.slice(0, 500)}`;
    }

    // Build player action text with clear outcome directive
    let playerActionText = action.text;
    if (mechanicsContext) {
      playerActionText = `${action.text}\n\n${mechanicsContext}`;
    }
    if (outcomeDirective) {
      playerActionText += `\n\n>>> ${outcomeDirective} <<<`;
    }

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

  /**
   * Build a compact action history from recent turns.
   * This prevents the AI from suggesting the same options repeatedly
   * AND ensures logical story continuity.
   */
  private buildActionHistory(recentTurns: GameTurn[]): string {
    if (recentTurns.length === 0) {
      return "=== AKTIONSHISTORIE ===\nDies ist der erste Zug.";
    }

    // Get the last 6 turns with player actions (skip turns without player action)
    const turnsWithActions = recentTurns
      .filter((t) => t.playerAction?.text)
      .slice(-6);

    if (turnsWithActions.length === 0) {
      return "=== AKTIONSHISTORIE ===\nDies ist der erste Zug.";
    }

    const actionLines = turnsWithActions.map((t, i) => {
      const action = t.playerAction!.text;
      // Add outcome from dice rolls
      const diceOutcome = t.diceRolls.length > 0
        ? t.diceRolls.some((r) => r.success) ? "ERFOLG" : "FEHLSCHLAG"
        : "ausgefuehrt";
      // Extract first sentence of narrative as brief result (max 80 chars)
      const narrativeFirst = t.narrative.split(/[.!?]/)[0]?.slice(0, 80) || "";
      return `${i + 1}. "${action}" → ${diceOutcome}: ${narrativeFirst}...`;
    });

    // Get current state from the last turn
    const lastTurn = recentTurns[recentTurns.length - 1];
    const currentScene = lastTurn.narrative.slice(0, 200);

    // Infer current state from mood and narrative
    const stateHints = this.inferCurrentState(lastTurn);

    return `=== AKTIONSHISTORIE (KRITISCH!) ===
BISHERIGE AKTIONEN UND IHRE ERGEBNISSE:
${actionLines.join("\n")}

AKTUELLER ZUSTAND:
${stateHints}

AKTUELLE SZENE (hier geht es weiter!):
${currentScene}...

WICHTIG: Die naechste Erzaehlung MUSS LOGISCH an dieser Position anknuepfen!`;
  }

  /**
   * Infer the current game state from the last turn for better AI context.
   */
  private inferCurrentState(turn: GameTurn): string {
    const hints: string[] = [];

    // Mood-based state
    switch (turn.mood) {
      case "combat":
        hints.push("- Spieler ist IM KAMPF (Kampfoptionen anbieten, Gegner beschreiben)");
        break;
      case "danger":
        hints.push("- Spieler ist in GEFAHR (Spannung aufbauen, Bedrohung praesent)");
        break;
      case "dialogue":
        hints.push("- Spieler ist IM GESPRAECH mit einem NPC (Dialog fortsetzen)");
        break;
      case "mystery":
        hints.push("- Spieler untersucht ein RAETSEL (Hinweise geben, nicht auflösen)");
        break;
      case "safe":
        hints.push("- Spieler ist an einem SICHEREN ORT (Erholung, Planung moeglich)");
        break;
      case "exploration":
        hints.push("- Spieler ERKUNDET die Umgebung (neue Details zeigen)");
        break;
    }

    // Location hints from narrative keywords
    const narrative = turn.narrative.toLowerCase();
    if (narrative.includes("betritt") || narrative.includes("innere") || narrative.includes("raum") || narrative.includes("halle")) {
      hints.push("- Spieler ist DRINNEN in einem Gebaeude/Raum");
    }
    if (narrative.includes("draussen") || narrative.includes("weg") || narrative.includes("pfad") || narrative.includes("wald") || narrative.includes("strasse")) {
      hints.push("- Spieler ist DRAUSSEN im Freien");
    }
    if (narrative.includes("tuer") || narrative.includes("fenster") || narrative.includes("eingang")) {
      hints.push("- Spieler ist an einem EINGANG/UEBERGANG");
    }

    // Action context from player's last action
    if (turn.playerAction?.text) {
      const action = turn.playerAction.text.toLowerCase();
      const hadSuccess = turn.diceRolls.some((r) => r.success);

      if ((action.includes("hinein") || action.includes("betreten") || action.includes("oeffnen") || action.includes("klettern")) && hadSuccess) {
        hints.push("- LETZTE AKTION WAR ERFOLGREICH: Spieler hat sein Ziel erreicht!");
      }
    }

    return hints.length > 0 ? hints.join("\n") : "- Normale Erkundungssituation";
  }

  /**
   * Determine if an action is trivial and should auto-succeed without dice roll.
   * This prevents frustrating gameplay where simple actions like "walk forward" fail.
   */
  private isTrivialAction(option: ActionOption, actionText: string, dc: number): boolean {
    // Very low DC actions always auto-succeed
    if (dc <= 8) return true;

    // Certain action types are typically trivial
    const trivialTypes = ["exploration"];
    if (trivialTypes.includes(option.type) && dc <= 10) return true;

    // Check for trivial action keywords in the action text
    const trivialKeywords = [
      // Movement
      "gehen", "laufen", "weitergehen", "folgen", "betreten", "verlassen",
      "hinaufsteigen", "hinabsteigen", "ueberqueren", "durchqueren",
      // Looking/Observing (no interaction)
      "umsehen", "beobachten", "schauen", "blicken", "ansehen",
      // Simple interactions
      "nehmen", "aufheben", "ablegen", "hinlegen",
      // Waiting/Resting
      "warten", "rasten", "ausruhen",
    ];

    const lowerAction = actionText.toLowerCase();
    const hasTrivialKeyword = trivialKeywords.some((kw) => lowerAction.includes(kw));

    // If it has a trivial keyword AND DC is not high, auto-succeed
    if (hasTrivialKeyword && dc <= 12) return true;

    // Check for NON-trivial keywords that should ALWAYS require a roll
    const nonTrivialKeywords = [
      // Combat
      "angreifen", "kaempfen", "schlagen", "toeten",
      // Stealth/Deception
      "schleichen", "verstecken", "luegen", "taeuschen", "stehlen",
      // Persuasion/Social
      "ueberzeugen", "ueberreden", "verhandeln", "einschuechtern",
      // Difficult physical
      "klettern", "springen", "balancieren", "schwimmen",
      // Magic/Special
      "zaubern", "wirken", "beschworen",
      // Locks/Traps
      "knacken", "oeffnen.*schloss", "entschaerfen",
    ];

    const hasNonTrivialKeyword = nonTrivialKeywords.some((kw) =>
      new RegExp(kw, "i").test(lowerAction)
    );

    // If it has a non-trivial keyword, always require roll
    if (hasNonTrivialKeyword) return false;

    // Default: if DC is 10 or less and no non-trivial keyword, auto-succeed
    return dc <= 10;
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
