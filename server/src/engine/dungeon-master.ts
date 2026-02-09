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
  Quest,
  QuestLog,
  ObjectiveType,
  NPCRelationship,
  StoryMilestone,
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
import { QuestManager } from "../services/quest/quest-manager.js";

/**
 * The Dungeon Master orchestrates the game loop:
 * 1. Receives player action
 * 2. Resolves mechanics (dice rolls, rules)
 * 3. Generates narrative via AI
 * 4. Updates game state
 * 5. Returns the new turn
 */
export class DungeonMaster {
  private questManagers: Map<string, QuestManager> = new Map();

  constructor(
    private aiService: AIService,
    private memoryService: MemoryService,
    private safetyService: SafetyService
  ) {}

  /**
   * Get or create a QuestManager for a session.
   */
  getQuestManager(sessionId: string, existingLog?: QuestLog): QuestManager {
    let manager = this.questManagers.get(sessionId);
    if (!manager) {
      manager = new QuestManager(sessionId, existingLog);
      this.questManagers.set(sessionId, manager);
    }
    return manager;
  }

  /**
   * Get the quest log for a session.
   */
  getQuestLog(sessionId: string): QuestLog | null {
    const manager = this.questManagers.get(sessionId);
    return manager?.getQuestLog() ?? null;
  }

  /**
   * Starts a new game session with an opening narrative.
   */
  async startSession(
    character: Character,
    scenario: ScenarioTemplate,
    inventory: Inventory
  ): Promise<{ session: GameSession; firstTurn: GameTurn; initialQuest: Quest | null }> {
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

    // Initialize quest manager and generate initial quest
    const questManager = this.getQuestManager(sessionId);
    const initialQuest = questManager.generateQuest(
      "exploration",
      1,
      scenario.openingNarrative
    );
    if (initialQuest) {
      questManager.addQuest(initialQuest);
      // Automatically start the initial quest
      questManager.startQuest(initialQuest.id, 1);
    }

    // Build the opening context
    const characterSummary = this.buildCharacterSummary(character);
    const inventoryContext = this.buildInventoryContext(inventory);
    const scenarioContext = this.buildScenarioContext(scenario);
    const questContext = initialQuest
      ? this.buildQuestContext(questManager)
      : "";

    // Generate opening narrative
    const aiResponse = await this.aiService.generateText({
      sessionId,
      characterSummary,
      recentContext: questContext,
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

    return { session, firstTurn, initialQuest };
  }

  /**
   * Build quest context string for AI prompts.
   */
  private buildQuestContext(questManager: QuestManager): string {
    const summary = questManager.getQuestSummary();
    const activeQuests = questManager.getActiveQuests().filter((q) => q.status === "active");

    if (activeQuests.length === 0) {
      return "";
    }

    const questDetails = activeQuests.map((quest) => {
      const objectiveList = quest.objectives
        .map((obj) => `  - ${obj.description} (${obj.current}/${obj.required})${obj.completed ? " ✓" : ""}`)
        .join("\n");
      return `QUEST: "${quest.title}" [${quest.difficulty}]\n${quest.description}\nZiele:\n${objectiveList}`;
    }).join("\n\n");

    return `=== AKTIVE QUESTS ===\n${questDetails}\n\nHINWEIS: Integriere Quest-Fortschritt in die Erzaehlung wenn passend!`;
  }

  /**
   * Build story context with NPC relationships, locations, and milestones.
   * This enables deeper storytelling with callbacks to past events.
   */
  private buildStoryContext(sessionId: string): string {
    const npcs = this.memoryService.getSessionNPCs(sessionId);
    const locations = this.memoryService.getSessionLocations(sessionId);
    const milestones = this.memoryService.getSessionMilestones(sessionId);

    const sections: string[] = [];

    // NPC Relationships section
    if (npcs.length > 0) {
      const npcLines = npcs
        .sort((a, b) => Math.abs(b.relationshipScore) - Math.abs(a.relationshipScore))
        .slice(0, 5) // Top 5 most significant relationships
        .map((npc) => {
          const scoreIndicator = npc.relationshipScore > 0 ? "+" : "";
          const lastInteraction = npc.keyInteractions.length > 0
            ? ` | Letzte Begegnung: ${npc.keyInteractions[npc.keyInteractions.length - 1]}`
            : "";
          return `  - ${npc.name} [${npc.relationshipLabel.toUpperCase()} ${scoreIndicator}${npc.relationshipScore}]${lastInteraction}`;
        });

      sections.push(`=== BEKANNTE NPCS (Beziehungen beachten!) ===\n${npcLines.join("\n")}`);
    }

    // Known Locations section
    if (locations.length > 0) {
      const locationLines = locations
        .sort((a, b) => b.lastVisitTurn - a.lastVisitTurn)
        .slice(0, 5)
        .map((loc) => {
          const visits = loc.visitCount > 1 ? ` (${loc.visitCount}x besucht)` : "";
          const events = loc.notableEvents.length > 0
            ? ` | ${loc.notableEvents[loc.notableEvents.length - 1]}`
            : "";
          return `  - ${loc.name}${visits}${events}`;
        });

      sections.push(`=== BEKANNTE ORTE ===\n${locationLines.join("\n")}`);
    }

    // Story Milestones for callbacks
    if (milestones.length > 0) {
      const milestoneLines = milestones
        .slice(-3) // Last 3 milestones
        .map((m) => {
          const hint = m.callbackHints.length > 0 ? m.callbackHints[0] : "";
          return `  - [Runde ${m.turnNumber}] ${m.description.slice(0, 80)}...\n    CALLBACK-HINWEIS: ${hint}`;
        });

      sections.push(
        `=== WICHTIGE STORY-MOMENTE (Referenziere wenn passend!) ===\n${milestoneLines.join("\n")}\n\nHINWEIS: Wenn thematisch passend, nimm Bezug auf diese Ereignisse! NPCs koennten sie erwaehnen, Konsequenzen koennten sichtbar werden.`
      );
    }

    return sections.length > 0 ? sections.join("\n\n") : "";
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

    // Get quest context
    const questManager = this.getQuestManager(session.id);
    const questContext = this.buildQuestContext(questManager);

    // Get story context (NPCs, locations, milestones)
    const storyContext = this.buildStoryContext(session.id);

    // Update quest progress based on action
    const questUpdates = this.updateQuestProgress(questManager, action, previousTurn);

    // Combine context summary with action history, quest context, and story context
    let recentContext: string;
    if (contextSummary) {
      recentContext = `${contextSummary.overallSummary}\n\n${storyContext}\n\n${actionHistory}\n\n${questContext}\n\nAktuelle Szene: ${contextSummary.recentEvents}`;
    } else {
      recentContext = `${storyContext}\n\n${actionHistory}\n\n${questContext}\n\nAktuelle Szene: ${previousTurn.narrative.slice(0, 500)}`;
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

    // Extract entities from narrative for tracking
    const extractedEntities = this.memoryService.extractEntitiesFromText(narrative);

    // Update NPC relationships based on narrative content
    for (const entityName of extractedEntities) {
      // Check if this looks like an NPC (appears in dialogue/action context)
      if (this.looksLikeNPC(narrative, entityName)) {
        this.memoryService.updateNPCRelationship(
          session.id,
          entityName,
          narrative,
          turnNumber
        );
      }
      // Check if this looks like a location
      if (this.looksLikeLocation(narrative, entityName)) {
        const notableEvent = events.length > 0 ? events[0].type : undefined;
        this.memoryService.updateLocationVisit(
          session.id,
          entityName,
          turnNumber,
          undefined,
          notableEvent
        );
      }
    }

    // Check for story milestones
    const milestone = this.memoryService.checkForMilestone(
      session.id,
      narrative,
      turnNumber,
      extractedEntities
    );

    if (milestone) {
      events.push({
        type: "narrative_update",
        payload: {
          milestone: true,
          milestoneType: milestone.significance,
          description: milestone.description,
        },
        turnId,
        timestamp: new Date().toISOString(),
      });
    }

    // Store turn in memory with extracted entities
    const importance = this.calculateImportance(events, diceRolls);
    await this.memoryService.storeMemory({
      id: uuidv4(),
      sessionId: session.id,
      turnId: turn.id,
      turnNumber,
      content: `Player: ${action.text}\n${mechanicsContext}\nResult: ${narrative}`,
      category: this.categorizeEvent(events, newMood),
      importance,
      entities: extractedEntities,
      timestamp: turn.timestamp,
    });

    // Check for completed quests and add events
    const completedQuests = questManager.checkCompletedQuests(turnNumber);
    for (const quest of completedQuests) {
      events.push({
        type: "quest_complete",
        payload: {
          questId: quest.id,
          questTitle: quest.title,
          rewards: quest.rewards,
        },
        turnId,
        timestamp: new Date().toISOString(),
      });
    }

    // Add quest progress events
    for (const update of questUpdates) {
      if (update.newlyCompleted) {
        // Objective was just completed - show celebration notification
        events.push({
          type: "quest_progress",
          payload: {
            questId: update.quest.id,
            questTitle: update.quest.title,
            objectiveId: update.objective.id,
            objectiveDescription: update.objective.description,
            completed: true,
          },
          turnId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Maybe generate a new quest if we completed one and have few active
    const activeQuestCount = questManager.getActiveQuests().filter((q) => q.status === "active").length;
    if (completedQuests.length > 0 && activeQuestCount < 2 && turnNumber > 3) {
      const newQuest = questManager.generateQuest(newMood, turnNumber, narrative);
      if (newQuest) {
        questManager.addQuest(newQuest);
        events.push({
          type: "quest_start",
          payload: {
            questId: newQuest.id,
            questTitle: newQuest.title,
            questDescription: newQuest.description,
          },
          turnId,
          timestamp: new Date().toISOString(),
        });
      }
    }

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

  /**
   * Check if an entity name looks like an NPC based on narrative context.
   */
  private looksLikeNPC(narrative: string, name: string): boolean {
    const lowerNarrative = narrative.toLowerCase();
    const lowerName = name.toLowerCase();

    // NPC indicators: speaking, actions, emotions
    const npcPatterns = [
      new RegExp(`${lowerName}\\s+(?:sagt|fragt|antwortet|ruft|flüstert|erklärt|warnt|nickt|lächelt|schaut|blickt)`, "i"),
      new RegExp(`(?:der|die)\\s+${lowerName}\\s+(?:ist|hat|wird|kann|steht|sitzt)`, "i"),
      new RegExp(`"[^"]*"[,.]?\\s*(?:sagt|fragt|ruft)?\\s*${lowerName}`, "i"),
      new RegExp(`${lowerName}(?:'s|s)\\s+(?:augen|stimme|hand|gesicht|blick)`, "i"),
    ];

    return npcPatterns.some((pattern) => pattern.test(narrative));
  }

  /**
   * Check if an entity name looks like a location based on narrative context.
   */
  private looksLikeLocation(narrative: string, name: string): boolean {
    const lowerName = name.toLowerCase();

    // Location suffixes
    const locationSuffixes = [
      "wald", "berg", "tal", "turm", "burg", "höhle", "tempel", "dorf", "stadt",
      "halle", "kammer", "raum", "haus", "hütte", "tor", "brücke", "see", "fluss",
      "weg", "pfad", "gasse", "platz", "markt", "taverne", "schenke", "mine",
      "gruft", "krypta", "ruine", "palast", "schloss", "festung", "hafen",
    ];

    if (locationSuffixes.some((suffix) => lowerName.endsWith(suffix))) {
      return true;
    }

    // Location context patterns
    const locationPatterns = [
      new RegExp(`(?:in|im|ins|nach|zum|zur|am|beim|durch)\\s+(?:den?|die|das|dem|der)?\\s*${lowerName}`, "i"),
      new RegExp(`(?:betritt|betrittst|verlässt|erreichst)\\s+(?:den?|die|das)?\\s*${lowerName}`, "i"),
      new RegExp(`${lowerName}\\s+(?:liegt|befindet|erstreckt|erhebt)`, "i"),
    ];

    return locationPatterns.some((pattern) => pattern.test(narrative));
  }

  /**
   * Update quest progress based on player action and game state.
   */
  private updateQuestProgress(
    questManager: QuestManager,
    action: PlayerAction,
    previousTurn: GameTurn
  ): { quest: import("@aetheria/shared").Quest; objective: import("@aetheria/shared").QuestObjective; newlyCompleted: boolean }[] {
    const updates: { quest: import("@aetheria/shared").Quest; objective: import("@aetheria/shared").QuestObjective; newlyCompleted: boolean }[] = [];
    const actionText = action.text.toLowerCase();
    const narrativeText = previousTurn.narrative.toLowerCase();

    // Map action types to objective types
    const actionTypeMapping: Record<string, ObjectiveType[]> = {
      combat: ["defeat"],
      exploration: ["explore", "investigate"],
      social: ["talk"],
      skill: ["collect", "investigate"],
      magic: ["investigate"],
      item: ["collect", "deliver"],
    };

    // Check for exploration progress
    if (actionText.includes("erkund") || actionText.includes("untersuch") || actionText.includes("betret")) {
      const exploreUpdates = questManager.updateProgress("explore", actionText, 1);
      updates.push(...exploreUpdates);
    }

    // Check for combat progress
    if (previousTurn.mood === "combat" || actionText.includes("angreif") || actionText.includes("kaempf")) {
      // Look for enemy names in the narrative
      const combatUpdates = questManager.updateProgress("defeat", narrativeText, 1);
      updates.push(...combatUpdates);
    }

    // Check for dialogue progress
    if (previousTurn.mood === "dialogue" || actionText.includes("sprech") || actionText.includes("red") || actionText.includes("frag")) {
      const talkUpdates = questManager.updateProgress("talk", narrativeText, 1);
      updates.push(...talkUpdates);
    }

    // Check for investigation progress
    if (actionText.includes("untersuch") || actionText.includes("such") || actionText.includes("find")) {
      const investigateUpdates = questManager.updateProgress("investigate", actionText, 1);
      updates.push(...investigateUpdates);
    }

    // Check for collection progress (items in narrative)
    if (narrativeText.includes("findest") || narrativeText.includes("nimmst") || narrativeText.includes("sammelst")) {
      const collectUpdates = questManager.updateProgress("collect", narrativeText, 1);
      updates.push(...collectUpdates);
    }

    // Check for survival progress (just being alive advances it)
    const surviveUpdates = questManager.updateProgress("survive", "runde", 1);
    updates.push(...surviveUpdates);

    return updates;
  }
}
