import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { IGameStore } from "../store/index.js";
import type { EnergyService } from "../services/energy/energy-service.js";
import type { ApiResponse, ScenarioTemplate, CreateScenarioRequest } from "@aetheria/shared";

export function createScenarioRoutes(
  store: IGameStore,
  energyService: EnergyService
): Router {
  const router = Router();

  /**
   * GET /api/scenarios
   * List all available scenarios.
   */
  router.get("/", async (_req: Request, res: Response) => {
    const scenarios = store.getAllScenarios();
    const response: ApiResponse<ScenarioTemplate[]> = { success: true, data: scenarios };
    res.json(response);
  });

  /**
   * GET /api/scenarios/:id
   * Get a specific scenario.
   */
  router.get("/:id", async (req: Request, res: Response) => {
    const scenario = store.getScenario(req.params.id);
    if (!scenario) {
      res.status(404).json({ success: false, error: { code: "SCENARIO_NOT_FOUND", message: "Scenario not found" } });
      return;
    }

    const response: ApiResponse<ScenarioTemplate> = { success: true, data: scenario };
    res.json(response);
  });

  /**
   * POST /api/scenarios
   * Create a custom scenario (Creator feature).
   */
  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as CreateScenarioRequest;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing user ID" } });
      return;
    }

    const user = await store.getUser(userId);
    if (!user) {
      res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
      return;
    }

    // Only Creator tier can create scenarios
    if (user.subscriptionTier !== "creator") {
      res.status(403).json({
        success: false,
        error: { code: "UPGRADE_REQUIRED", message: "Creator Pass required to create custom scenarios" },
      });
      return;
    }

    // Check energy
    const energyCheck = energyService.checkEnergy(user, "scenarioCreation");
    if (!energyCheck.allowed) {
      res.status(403).json({ success: false, error: { code: "INSUFFICIENT_ENERGY", message: energyCheck.reason } });
      return;
    }

    const scenario: ScenarioTemplate = {
      id: uuidv4(),
      title: body.title,
      description: body.description,
      genre: body.genre,
      difficulty: body.difficulty,
      openingNarrative: body.openingNarrative,
      setting: body.setting,
      tags: body.tags,
      creatorId: userId,
    };

    await store.createScenario(scenario);

    const updatedUser = energyService.consumeEnergy(user, "scenarioCreation");
    await store.updateUser(updatedUser);

    const response: ApiResponse<ScenarioTemplate> = { success: true, data: scenario };
    res.status(201).json(response);
  });

  return router;
}
