import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { GameStore } from "../store/game-store.js";
import type { EnergyService } from "../services/energy/energy-service.js";
import type { AIService } from "../services/ai/ai-service.js";
import type {
  ApiResponse,
  User,
  Character,
  AbilityScores,
  CreateCharacterRequest,
} from "@aetheria/shared";
import {
  applyRacialBonuses,
  calculateMaxHP,
  calculateArmorClass,
  rollAbilityScores,
} from "../engine/index.js";
import type { CharacterRace, CharacterClass } from "@aetheria/shared";

export function createUserRoutes(
  store: GameStore,
  energyService: EnergyService,
  aiService: AIService
): Router {
  const router = Router();

  /**
   * POST /api/users
   * Register a new user.
   */
  router.post("/", (req: Request, res: Response) => {
    const { username, email } = req.body as { username: string; email: string };

    if (!username || !email) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Username and email are required" },
      });
      return;
    }

    const user = store.createUser(username, email);
    const response: ApiResponse<User> = { success: true, data: user };
    res.status(201).json(response);
  });

  /**
   * GET /api/users/:userId
   * Get user profile and energy state.
   */
  router.get("/:userId", (req: Request, res: Response) => {
    const user = store.getUser(req.params.userId);
    if (!user) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
      return;
    }

    const response: ApiResponse<User> = { success: true, data: user };
    res.json(response);
  });

  /**
   * POST /api/users/:userId/energy/purchase
   * Purchase an energy pack.
   */
  router.post("/:userId/energy/purchase", (req: Request, res: Response) => {
    const { energyAmount } = req.body as { energyAmount: number };
    const user = store.getUser(req.params.userId);

    if (!user) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
      return;
    }

    if (!energyAmount || energyAmount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Valid energy amount required" },
      });
      return;
    }

    const updatedUser = energyService.addPurchasedEnergy(user, energyAmount);
    store.updateUser(updatedUser);

    const response: ApiResponse<User> = { success: true, data: updatedUser };
    res.json(response);
  });

  /**
   * GET /api/users/:userId/energy/costs
   * Get energy costs for the user's subscription tier.
   */
  router.get("/:userId/energy/costs", (req: Request, res: Response) => {
    const user = store.getUser(req.params.userId);
    if (!user) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
      return;
    }

    const costs = energyService.getCosts(user.subscriptionTier);
    const response: ApiResponse<typeof costs> = { success: true, data: costs };
    res.json(response);
  });

  /**
   * POST /api/users/:userId/characters
   * Create a new character.
   */
  router.post("/:userId/characters", (req: Request, res: Response) => {
    const body = req.body as CreateCharacterRequest;
    const userId = req.params.userId;

    const user = store.getUser(userId);
    if (!user) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
      return;
    }

    // Roll ability scores
    const scores = rollAbilityScores();
    const baseAbilities: AbilityScores = {
      strength: scores[0],
      dexterity: scores[1],
      constitution: scores[2],
      intelligence: scores[3],
      wisdom: scores[4],
      charisma: scores[5],
    };

    const race = body.race as CharacterRace;
    const characterClass = body.characterClass as CharacterClass;

    // Apply racial bonuses
    const abilities = applyRacialBonuses(baseAbilities, race);
    const maxHP = calculateMaxHP(characterClass, 1, abilities.constitution);
    const ac = calculateArmorClass(abilities.dexterity, false);

    const character: Character = {
      id: uuidv4(),
      userId,
      name: body.name,
      race,
      characterClass,
      level: 1,
      experience: 0,
      hitPoints: maxHP,
      maxHitPoints: maxHP,
      armorClass: ac,
      abilities,
      appearance: body.appearance,
      backstory: body.backstory,
      traits: body.traits,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.createCharacter(character);

    // Generate character portrait asynchronously
    const appearanceDesc = [
      `${character.appearance.hairColor} ${character.appearance.hairStyle} hair`,
      `${character.appearance.eyeColor} eyes`,
      `${character.appearance.skinTone} skin`,
      `${character.appearance.height} height, ${character.appearance.build} build`,
      character.appearance.clothing,
      ...character.appearance.distinguishingFeatures,
    ].filter(Boolean).join(", ");

    aiService
      .generatePortrait(appearanceDesc, character.race, character.characterClass)
      .then((portraitUrl) => {
        if (portraitUrl) {
          character.portraitUrl = portraitUrl;
          store.updateCharacter(character);
        }
      })
      .catch(() => {
        // Portrait generation failure is non-blocking
      });

    const response: ApiResponse<Character> = { success: true, data: character };
    res.status(201).json(response);
  });

  /**
   * GET /api/users/:userId/characters
   * List user's characters.
   */
  router.get("/:userId/characters", (req: Request, res: Response) => {
    const characters = store.getCharactersByUser(req.params.userId);
    const response: ApiResponse<Character[]> = { success: true, data: characters };
    res.json(response);
  });

  return router;
}
