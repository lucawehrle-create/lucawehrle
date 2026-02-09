import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { loadConfig } from "./config.js";
import { initializeStore, getStore, getStoreType } from "./store/index.js";
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

// ============================================
// Rate Limiting Configuration
// ============================================

/** General API rate limit: 100 requests per minute per IP */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Zu viele Anfragen. Bitte warte einen Moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** AI-intensive endpoints: 20 requests per minute per IP */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: "Zu viele KI-Anfragen. Bitte warte einen Moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Auth endpoints: 10 requests per minute per IP (prevent brute force) */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Zu viele Login-Versuche. Bitte warte einen Moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// App Factory
// ============================================

export async function createApp() {
  const config = loadConfig();
  const app = express();

  // Initialize store (database or in-memory)
  await initializeStore();

  // ---- Security Middleware ----

  // CORS - restrict in production
  const corsOrigins = process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:5173", "http://localhost:4173"];
  app.use(cors({
    origin: process.env.NODE_ENV === "production" ? corsOrigins : true,
    credentials: true,
  }));

  // JSON body parser with size limit
  app.use(express.json({ limit: "10mb" })); // Large limit for base64 image scans

  // Apply general rate limiter to all routes
  app.use(generalLimiter);

  // Trust proxy (needed for rate limiting behind reverse proxy)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // ---- AI Service Initialization ----
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

  // ---- Other Services ----
  const store = getStore();
  const memoryService = new InMemoryMemoryService();
  const safetyService = new ContentSafetyService();
  const energyService = new FreemiumEnergyService();
  const scannerService = new ObjectScannerService(aiService);
  const dungeonMaster = new DungeonMaster(aiService, memoryService, safetyService);

  // ---- Routes with Rate Limiting ----

  // Auth routes with stricter limiting
  app.use("/api/users/register", authLimiter);
  app.use("/api/users/login", authLimiter);

  // AI-intensive routes with AI limiting
  app.use("/api/game/sessions/:sessionId/action", aiLimiter);
  app.use("/api/game/scan", aiLimiter);

  // Main routes
  app.use("/api/game", createGameRoutes(store, dungeonMaster, energyService, scannerService, aiService));
  app.use("/api/users", createUserRoutes(store, energyService, aiService));
  app.use("/api/scenarios", createScenarioRoutes(store, energyService));

  // ---- Health Check ----
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Aetheria AI",
      version: "1.0.0",
      aiProvider: config.aiProvider,
      storeType: getStoreType(),
      imageGeneration: config.aiProvider === "gemini" ? "gemini" : config.aiProvider === "anthropic" && !!config.openaiApiKey ? "dall-e-3" : "placeholder",
      timestamp: new Date().toISOString(),
    });
  });

  return { app, store, config };
}
