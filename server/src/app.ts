import express from "express";
import cors from "cors";
import { GameStore } from "./store/game-store.js";
import { DungeonMaster } from "./engine/dungeon-master.js";
import { MockAIService } from "./services/ai/ai-service.js";
import { InMemoryMemoryService } from "./services/memory/memory-service.js";
import { ContentSafetyService } from "./services/safety/safety-service.js";
import { FreemiumEnergyService } from "./services/energy/energy-service.js";
import { ObjectScannerService } from "./services/scanner/scanner-service.js";
import { createGameRoutes } from "./routes/game-routes.js";
import { createUserRoutes } from "./routes/user-routes.js";
import { createScenarioRoutes } from "./routes/scenario-routes.js";

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" })); // Large limit for base64 image scans

  // Initialize services
  const store = new GameStore();
  const aiService = new MockAIService();
  const memoryService = new InMemoryMemoryService();
  const safetyService = new ContentSafetyService();
  const energyService = new FreemiumEnergyService();
  const scannerService = new ObjectScannerService(aiService);
  const dungeonMaster = new DungeonMaster(aiService, memoryService, safetyService);

  // Routes
  app.use("/api/game", createGameRoutes(store, dungeonMaster, energyService, scannerService, aiService));
  app.use("/api/users", createUserRoutes(store, energyService));
  app.use("/api/scenarios", createScenarioRoutes(store, energyService));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Aetheria AI",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  return { app, store };
}
