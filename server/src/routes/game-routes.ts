import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { GameStore } from "../store/game-store.js";
import type { DungeonMaster } from "../engine/dungeon-master.js";
import type { EnergyService } from "../services/energy/energy-service.js";
import type { ScannerService } from "../services/scanner/scanner-service.js";
import type { AIService } from "../services/ai/ai-service.js";
import type {
  ApiResponse,
  Character,
  GameSession,
  GameTurn,
  GameEvent,
  PlayerAction,
  CreateSessionRequest,
  SubmitActionRequest,
  ScanObjectRequest,
  Inventory,
  Item,
  ItemCategory,
  ItemRarity,
  ItemEffect,
} from "@aetheria/shared";
import { LEVEL_THRESHOLDS } from "@aetheria/shared";
import { buildCharacterAppearance, genreToImageStyle } from "../services/ai/prompts.js";

/**
 * Calculate XP reward for a turn based on events and dice rolls.
 */
function calculateXPReward(events: GameEvent[], turn: GameTurn): number {
  let xp = 25; // Base XP per turn

  for (const event of events) {
    switch (event.type) {
      case "combat_end": xp += 50; break;
      case "combat_start": xp += 10; break;
      case "quest_complete": xp += 150; break;
      case "quest_start": xp += 25; break;
      case "npc_met": xp += 15; break;
      case "item_acquired": xp += 10; break;
    }
  }

  // Bonus XP for successful dice rolls
  for (const roll of turn.diceRolls) {
    if (roll.success) xp += 15;
    if (roll.criticalHit) xp += 30;
  }

  return xp;
}

/**
 * Check if character should level up and apply stat increases.
 * Returns the new level if leveled up, or null.
 */
function checkAndApplyLevelUp(character: Character): number | null {
  const nextThreshold = LEVEL_THRESHOLDS[character.level + 1];
  if (nextThreshold === undefined) return null; // Max level
  if (character.experience < nextThreshold) return null;

  character.level += 1;

  // HP increase per level (constitution-based)
  const conMod = Math.floor((character.abilities.constitution - 10) / 2);
  const hpGain = Math.max(1, 6 + conMod); // d6 average + con modifier, minimum 1
  character.maxHitPoints += hpGain;
  character.hitPoints = character.maxHitPoints; // Full heal on level up

  // Small AC boost every 4 levels
  if (character.level % 4 === 0) {
    character.armorClass += 1;
  }

  character.updatedAt = new Date().toISOString();
  return character.level;
}

export function createGameRoutes(
  store: GameStore,
  dungeonMaster: DungeonMaster,
  energyService: EnergyService,
  scannerService: ScannerService,
  aiService: AIService
): Router {
  const router = Router();

  /**
   * GET /api/game/scenarios
   * List all available scenarios.
   */
  router.get("/scenarios", (_req: Request, res: Response) => {
    const scenarios = store.getAllScenarios();
    const response: ApiResponse<typeof scenarios> = { success: true, data: scenarios };
    res.json(response);
  });

  /**
   * POST /api/game/sessions
   * Start a new game session.
   */
  router.post("/sessions", async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateSessionRequest;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing user ID" } });
        return;
      }

      const user = store.getUser(userId);
      if (!user) {
        res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
        return;
      }

      const character = store.getCharacter(body.characterId);
      if (!character) {
        res.status(404).json({ success: false, error: { code: "CHARACTER_NOT_FOUND", message: "Character not found" } });
        return;
      }

      // Check energy
      const energyCheck = energyService.checkEnergy(user, "textGeneration");
      if (!energyCheck.allowed) {
        res.status(403).json({ success: false, error: { code: "INSUFFICIENT_ENERGY", message: energyCheck.reason } });
        return;
      }

      const scenario = body.scenarioId
        ? store.getScenario(body.scenarioId)
        : store.getAllScenarios()[0];

      if (!scenario) {
        res.status(404).json({ success: false, error: { code: "SCENARIO_NOT_FOUND", message: "Scenario not found" } });
        return;
      }

      const inventory = store.getInventory(character.id)!;

      const { session, firstTurn } = await dungeonMaster.startSession(character, scenario, inventory);

      // Consume energy
      const updatedUser = energyService.consumeEnergy(user, "textGeneration");
      store.updateUser(updatedUser);

      // Store session and turn
      store.createSession(session);
      store.addTurn(firstTurn);

      // Generate journey narrative (text-only, fast) — await with timeout + fallback
      const fallbackNarrative = `${character.name} hatte lange nach diesem Ort gesucht. "${scenario.title}" — nun stand das Abenteuer unmittelbar bevor.`;
      let journeyNarrative = fallbackNarrative;

      try {
        const narrativePromise = aiService.generateJourneyNarrative(
          character.name,
          character.backstory,
          character.traits,
          scenario.title,
          scenario.setting ?? scenario.description,
        );
        // Timeout after 8 seconds — if text gen is slow, use fallback
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Journey narrative timeout")), 8000),
        );
        journeyNarrative = await Promise.race([narrativePromise, timeoutPromise]);
        console.log(`[GameRoutes] Journey narrative generated for ${character.name}`);
      } catch (err) {
        console.error("[GameRoutes] Journey narrative generation failed:", err instanceof Error ? err.message : err);
        journeyNarrative = fallbackNarrative;
      }

      // Send response IMMEDIATELY — no waiting for image generation
      const response: ApiResponse<{ session: GameSession; turn: GameTurn; character: Character; journeyNarrative: string }> = {
        success: true,
        data: { session, turn: firstTurn, character, journeyNarrative },
      };
      res.status(201).json(response);

      // --- Fire-and-forget: generate images in background AFTER response is sent ---

      // Generate character portrait if not already present
      // Pass traits and backstory for personality-infused portrait
      if (!character.portraitUrl) {
        aiService
          .generatePortrait(
            buildCharacterAppearance({ ...character, traits: character.traits }),
            character.race,
            character.characterClass,
            character.traits,
            character.backstory,
          )
          .then((portraitUrl) => {
            if (portraitUrl) {
              character.portraitUrl = portraitUrl;
              store.updateCharacter(character);
              console.log(`[GameRoutes] Character portrait generated for ${character.name}`);
            }
          })
          .catch((err) => {
            console.error("[GameRoutes] Portrait generation failed:", err instanceof Error ? err.message : err);
          });
      }

      // Generate opening scene image (first turn ALWAYS gets an image)
      // Client polls /turns/:turnId/image to pick it up when ready
      const openingImagePrompt = firstTurn.imagePrompt
        || `${scenario.setting || scenario.description}. Fantasy RPG scene, dramatic lighting, cinematic composition, atmospheric ${firstTurn.mood} mood.`;
      firstTurn.imagePrompt = openingImagePrompt; // Ensure imagePrompt is set for polling logic

      // Use genre-appropriate art style for visual consistency
      const imageStyle = genreToImageStyle(scenario.genre);

      aiService
        .generateImage({
          prompt: openingImagePrompt,
          characterAppearance: buildCharacterAppearance({ ...character, traits: character.traits }),
          mood: firstTurn.mood,
          style: imageStyle,
          modelTier: "standard",
        })
        .then((imageResult) => {
          if (imageResult.imageUrl) {
            firstTurn.imageUrl = imageResult.imageUrl;
            console.log(`[GameRoutes] Opening scene image generated for session ${session.id}`);
          } else {
            console.warn(`[GameRoutes] Opening scene image returned empty for session ${session.id}`);
          }
        })
        .catch((err) => {
          console.error("[GameRoutes] Opening scene image generation failed:", err instanceof Error ? err.message : err);
        });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  });

  /**
   * GET /api/game/sessions/:sessionId
   * Get session details with recent turns.
   */
  router.get("/sessions/:sessionId", (req: Request, res: Response) => {
    const session = store.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ success: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
      return;
    }

    const turns = store.getTurns(session.id);
    const response: ApiResponse<{ session: GameSession; turns: GameTurn[] }> = {
      success: true,
      data: { session, turns },
    };
    res.json(response);
  });

  /**
   * GET /api/game/sessions/:sessionId/turns/:turnId/image
   * Poll for a turn's scene image (generated asynchronously).
   */
  router.get("/sessions/:sessionId/turns/:turnId/image", (req: Request, res: Response) => {
    const turn = store.getTurnById(req.params.sessionId, req.params.turnId);
    if (!turn) {
      res.status(404).json({ success: false, error: { code: "TURN_NOT_FOUND", message: "Turn not found" } });
      return;
    }

    const response: ApiResponse<{ imageUrl: string | null }> = {
      success: true,
      data: { imageUrl: turn.imageUrl ?? null },
    };
    res.json(response);
  });

  /**
   * POST /api/game/sessions/:sessionId/action
   * Submit a player action (chosen option or free text).
   */
  router.post("/sessions/:sessionId/action", async (req: Request, res: Response) => {
    try {
      const body = req.body as SubmitActionRequest;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing user ID" } });
        return;
      }

      const user = store.getUser(userId);
      if (!user) {
        res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
        return;
      }

      const session = store.getSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
        return;
      }

      if (!session.isActive) {
        res.status(400).json({ success: false, error: { code: "SESSION_ENDED", message: "This session has ended" } });
        return;
      }

      // Check energy
      const energyCheck = energyService.checkEnergy(user, "textGeneration");
      if (!energyCheck.allowed) {
        res.status(403).json({ success: false, error: { code: "INSUFFICIENT_ENERGY", message: energyCheck.reason } });
        return;
      }

      const character = store.getCharacter(session.characterId);
      if (!character) {
        res.status(404).json({ success: false, error: { code: "CHARACTER_NOT_FOUND", message: "Character not found" } });
        return;
      }

      const inventory = store.getInventory(character.id)!;
      const previousTurn = store.getLastTurn(session.id);
      if (!previousTurn) {
        res.status(400).json({ success: false, error: { code: "NO_PREVIOUS_TURN", message: "No previous turn found" } });
        return;
      }

      const playerAction: PlayerAction = {
        type: body.action.type,
        optionId: body.action.optionId,
        text: body.action.text,
      };

      const result = await dungeonMaster.processAction(
        session,
        character,
        inventory,
        playerAction,
        previousTurn
      );

      // Consume energy
      const updatedUser = energyService.consumeEnergy(user, "textGeneration");
      store.updateUser(updatedUser);

      // Update session
      store.updateSession(result.updatedSession);
      store.addTurn(result.turn);

      // Only generate a new scene image when the AI indicates a visual scene change
      const hasNewScene = result.turn.imagePrompt && result.turn.imagePrompt.trim().length > 0;

      if (!hasNewScene && previousTurn.imageUrl) {
        // Reuse previous turn's scene image immediately (same location/scene)
        result.turn.imageUrl = previousTurn.imageUrl;
      }

      // Enrich combat events with generated enemy stats
      const enemyAC = 13 + Math.floor(character.level / 4);
      const hasCombatStart = result.events.some(e => e.type === "combat_start");
      for (const event of result.events) {
        if (event.type === "combat_start") {
          const p = event.payload as Record<string, unknown>;
          const baseHp = 15 + character.level * 8;
          if (p.enemyHp === undefined) p.enemyHp = baseHp;
          if (p.enemyMaxHp === undefined) p.enemyMaxHp = baseHp;
          if (p.enemyAc === undefined) p.enemyAc = enemyAC;
        }
      }

      // If combat dice rolls exist with combat mood but no combat_start event, inject one
      const hasCombatRolls = result.turn.diceRolls.some(r => r.diceType === "d20" && r.success !== undefined);
      if (hasCombatRolls && result.turn.mood === "combat" && !hasCombatStart) {
        const baseHp = 15 + character.level * 8;
        result.events.unshift({
          type: "combat_start",
          payload: { enemy: "Gegner", enemyHp: baseHp, enemyMaxHp: baseHp, enemyAc: enemyAC },
          turnId: result.turn.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Add items to store IMMEDIATELY (without images) so response includes them
      for (const event of result.events) {
        if (event.type === "item_acquired") {
          const p = event.payload as Record<string, unknown>;
          const validCategories: ItemCategory[] = ["weapon", "armor", "potion", "scroll", "key", "quest", "material", "food", "tool", "scanned_object"];
          const validRarities: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "artifact"];
          const rawCategory = String(p.category ?? "quest");
          const rawRarity = String(p.rarity ?? "common");

          const newItem: Item = {
            id: uuidv4(),
            name: String(p.name ?? "Unbekannter Gegenstand"),
            description: String(p.description ?? ""),
            category: validCategories.includes(rawCategory as ItemCategory) ? rawCategory as ItemCategory : "quest",
            rarity: validRarities.includes(rawRarity as ItemRarity) ? rawRarity as ItemRarity : "common",
            visualDescription: String(p.visualDescription ?? ""),
            properties: {
              weight: Number(p.weight) || 1,
              value: Number(p.value) || 0,
              effects: Array.isArray(p.effects)
                ? (p.effects as ItemEffect[])
                : [],
            },
            acquiredAt: new Date().toISOString(),
            acquiredTurnId: result.turn.id,
          };

          store.addItem(character.id, newItem);

          // Generate item image in background (fire-and-forget)
          // Pass rarity for quality-based visual effects
          const visualDesc = String(p.visualDescription ?? "");
          if (visualDesc) {
            aiService.generateItemImage(visualDesc, newItem.name, newItem.rarity)
              .then((imageUrl) => {
                if (imageUrl) {
                  newItem.imageUrl = imageUrl;
                  console.log(`[GameRoutes] Item image generated for ${newItem.name}`);
                }
              })
              .catch((err) => {
                console.error("[GameRoutes] Item image generation failed:", err instanceof Error ? err.message : err);
              });
          }
        } else if (event.type === "item_lost") {
          const p = event.payload as Record<string, unknown>;
          const itemName = String(p.name ?? "");
          if (itemName) {
            store.removeItemByName(character.id, itemName);
          }
        }
      }

      // Award XP and check for level-up
      const xpGained = calculateXPReward(result.events, result.turn);
      const prevLevel = character.level;
      character.experience += xpGained;
      const newLevel = checkAndApplyLevelUp(character);
      store.updateCharacter(character);

      // If leveled up, inject a level_up event
      if (newLevel !== null) {
        result.events.push({
          type: "level_up",
          payload: {
            newLevel,
            previousLevel: prevLevel,
            xpGained,
            totalXP: character.experience,
            hpGained: character.maxHitPoints - (character.maxHitPoints - (6 + Math.max(0, Math.floor((character.abilities.constitution - 10) / 2)))),
          },
          turnId: result.turn.id,
          timestamp: new Date().toISOString(),
        });
      }

      const updatedInventory = store.getInventory(character.id)!;

      const response: ApiResponse<{ turn: GameTurn; events: typeof result.events; inventory: Inventory; character: Character; xpGained: number }> = {
        success: true,
        data: { turn: result.turn, events: result.events, inventory: updatedInventory, character, xpGained },
      };
      res.json(response);

      // Generate scene image in background AFTER response is sent (fire-and-forget)
      // The client polls /turns/:turnId/image to pick it up when ready
      if (hasNewScene) {
        // Use genre-appropriate art style for visual consistency
        const sceneImageStyle = genreToImageStyle(session.genre);

        aiService.generateImage({
          prompt: result.turn.imagePrompt!,
          characterAppearance: buildCharacterAppearance({ ...character, traits: character.traits }),
          mood: result.turn.mood,
          style: sceneImageStyle,
          modelTier: "standard",
        })
          .then((imageResult) => {
            if (imageResult.imageUrl) {
              result.turn.imageUrl = imageResult.imageUrl;
              console.log(`[GameRoutes] Scene image generated for turn ${result.turn.id}`);
            } else if (previousTurn.imageUrl) {
              result.turn.imageUrl = previousTurn.imageUrl;
              console.warn(`[GameRoutes] Scene image returned empty for turn ${result.turn.id}, using previous`);
            }
          })
          .catch((err) => {
            if (previousTurn.imageUrl) {
              result.turn.imageUrl = previousTurn.imageUrl;
            }
            console.error("[GameRoutes] Scene image generation failed:", err instanceof Error ? err.message : err);
          });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  });

  /**
   * POST /api/game/sessions/:sessionId/scan
   * Scan a real-world object and add it to inventory.
   */
  router.post("/sessions/:sessionId/scan", async (req: Request, res: Response) => {
    try {
      const body = req.body as ScanObjectRequest;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing user ID" } });
        return;
      }

      const user = store.getUser(userId);
      if (!user) {
        res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
        return;
      }

      // Object scanning costs more energy
      const energyCheck = energyService.checkEnergy(user, "objectScan");
      if (!energyCheck.allowed) {
        res.status(403).json({ success: false, error: { code: "INSUFFICIENT_ENERGY", message: energyCheck.reason } });
        return;
      }

      const session = store.getSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: { code: "SESSION_NOT_FOUND", message: "Session not found" } });
        return;
      }

      const lastTurn = store.getLastTurn(session.id);
      const turnId = lastTurn?.id ?? "unknown";

      const { item, scanResponse } = await scannerService.scanObject(
        { imageData: body.imageData, format: body.format },
        session.id,
        turnId
      );

      // Add to inventory
      const added = store.addItem(session.characterId, item);
      if (!added) {
        res.status(400).json({ success: false, error: { code: "INVENTORY_FULL", message: "Inventory is full" } });
        return;
      }

      // Consume energy
      const updatedUser = energyService.consumeEnergy(user, "objectScan");
      store.updateUser(updatedUser);

      const response: ApiResponse<{ item: typeof item; analysis: typeof scanResponse }> = {
        success: true,
        data: { item, analysis: scanResponse },
      };
      res.status(201).json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  });

  /**
   * GET /api/game/inventory/:characterId
   * Get character's inventory.
   */
  router.get("/inventory/:characterId", (req: Request, res: Response) => {
    const inventory = store.getInventory(req.params.characterId);
    if (!inventory) {
      res.status(404).json({ success: false, error: { code: "INVENTORY_NOT_FOUND", message: "Inventory not found" } });
      return;
    }

    const response: ApiResponse<typeof inventory> = { success: true, data: inventory };
    res.json(response);
  });

  /**
   * DELETE /api/game/inventory/:characterId/items/:itemId
   * Discard (drop) an item from inventory.
   */
  router.delete("/inventory/:characterId/items/:itemId", (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing user ID" } });
      return;
    }

    const character = store.getCharacter(req.params.characterId);
    if (!character || character.userId !== userId) {
      res.status(404).json({ success: false, error: { code: "CHARACTER_NOT_FOUND", message: "Character not found" } });
      return;
    }

    const removed = store.removeItem(req.params.characterId, req.params.itemId);
    if (!removed) {
      res.status(404).json({ success: false, error: { code: "ITEM_NOT_FOUND", message: "Item not found in inventory" } });
      return;
    }

    const inventory = store.getInventory(req.params.characterId)!;
    const response: ApiResponse<Inventory> = { success: true, data: inventory };
    res.json(response);
  });

  return router;
}
