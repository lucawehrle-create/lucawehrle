import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { GameStore } from "../store/game-store.js";
import type { DungeonMaster } from "../engine/dungeon-master.js";
import type { EnergyService } from "../services/energy/energy-service.js";
import type { ScannerService } from "../services/scanner/scanner-service.js";
import type { AIService } from "../services/ai/ai-service.js";
import type {
  ApiResponse,
  GameSession,
  GameTurn,
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

      // Generate image asynchronously
      aiService.generateImage({
        prompt: firstTurn.imagePrompt,
        characterAppearance: character.appearance.clothing,
        mood: firstTurn.mood,
        style: "fantasy_painting",
        modelTier: "standard",
      }).then((imageResult) => {
        firstTurn.imageUrl = imageResult.imageUrl;
      }).catch(() => {
        // Image generation failure is non-blocking
      });

      const response: ApiResponse<{ session: GameSession; turn: GameTurn }> = {
        success: true,
        data: { session, turn: firstTurn },
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

      // Generate scene image asynchronously
      aiService.generateImage({
        prompt: result.turn.imagePrompt,
        characterAppearance: character.appearance.clothing,
        mood: result.turn.mood,
        style: "fantasy_painting",
        modelTier: "standard",
      }).then((imageResult) => {
        result.turn.imageUrl = imageResult.imageUrl;
      }).catch(() => {
        // Image generation failure is non-blocking
      });

      // Process inventory events from AI
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

          // Generate item image asynchronously via AI
          if (newItem.visualDescription) {
            aiService
              .generateItemImage(newItem.visualDescription, newItem.name)
              .then((imageUrl) => {
                if (imageUrl) {
                  newItem.imageUrl = imageUrl;
                }
              })
              .catch(() => {
                // Item image generation failure is non-blocking
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

      const updatedInventory = store.getInventory(character.id)!;

      const response: ApiResponse<{ turn: GameTurn; events: typeof result.events; inventory: Inventory }> = {
        success: true,
        data: { turn: result.turn, events: result.events, inventory: updatedInventory },
      };
      res.json(response);
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
