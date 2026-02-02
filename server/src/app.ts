import express from "express";
import cors from "cors";
import { loadConfig } from "./config.js";
import { GameStore } from "./store/game-store.js";
import { DungeonMaster } from "./engine/dungeon-master.js";
import { MockAIService } from "./services/ai/ai-service.js";
import { LiveAIService } from "./services/ai/live-ai-service.js";
import { GeminiAIService } from "./services/ai/gemini-ai-service.js";
import type { AIService } from "./services/ai/ai-service.js";
import { InMemoryMemoryService } from "./services/memory/memory-service.js";
import { ContentSafetyService } from "./services/safety/safety-service.js";
import { FreemiumEnergyService } from "./services/energy/energy-service.js";
import { ObjectScannerService } from "./services/scanner/scanner-service.js";
import { createGameRoutes } from "./routes/game-routes.js";
import { createUserRoutes } from "./routes/user-routes.js";
import { createScenarioRoutes } from "./routes/scenario-routes.js";

export function createApp() {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" })); // Large limit for base64 image scans

  // Initialize AI service based on configured provider
  let aiService: AIService;

  switch (config.aiProvider) {
    case "anthropic":
      aiService = new LiveAIService({
        anthropicApiKey: config.anthropicApiKey!,
        openaiApiKey: config.openaiApiKey,
        textModel: config.aiTextModel,
      });
      console.log("[Aetheria AI] KI-Modus: LIVE (Claude + DALL-E)");
      break;

    case "gemini":
      aiService = new GeminiAIService({
        geminiApiKey: config.geminiApiKey!,
        openaiApiKey: config.openaiApiKey,
        textModel: config.aiTextModel,
      });
      console.log("[Aetheria AI] KI-Modus: LIVE (Gemini – Text + Bilder)");
      break;

    default:
      aiService = new MockAIService();
      console.log("[Aetheria AI] KI-Modus: MOCK (vorgeschriebene Texte)");
      console.log("[Aetheria AI] Tipp: Setze ANTHROPIC_API_KEY oder GEMINI_API_KEY in .env fuer echte KI");
      break;
  }

  if (config.aiProvider === "anthropic" && !config.openaiApiKey) {
    console.log("[Aetheria AI] Hinweis: Kein OPENAI_API_KEY – Bilder werden als Platzhalter angezeigt");
  }

  // Initialize other services
  const store = new GameStore();
  const memoryService = new InMemoryMemoryService();
  const safetyService = new ContentSafetyService();
  const energyService = new FreemiumEnergyService();
  const scannerService = new ObjectScannerService(aiService);
  const dungeonMaster = new DungeonMaster(aiService, memoryService, safetyService);

  // Routes
  app.use("/api/game", createGameRoutes(store, dungeonMaster, energyService, scannerService, aiService));
  app.use("/api/users", createUserRoutes(store, energyService, aiService));
  app.use("/api/scenarios", createScenarioRoutes(store, energyService));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Aetheria AI",
      version: "1.0.0",
      aiProvider: config.aiProvider,
      imageGeneration: config.aiProvider === "gemini" ? "gemini" : config.aiProvider === "anthropic" && !!config.openaiApiKey ? "dall-e-3" : "placeholder",
      timestamp: new Date().toISOString(),
    });
  });

  return { app, store, config };
}
