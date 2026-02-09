import dotenv from "dotenv";

// .env laden, dann .env.example als Fallback fuer leere Werte.
// dotenv ueberschreibt existierende Keys nicht – auch nicht leere.
// Deshalb pruefen wir manuell: wenn ein Key in .env leer ist,
// wird der Wert aus .env.example eingesetzt.
dotenv.config();
const example = dotenv.config({ path: ".env.example" });
if (example.parsed) {
  for (const [key, value] of Object.entries(example.parsed)) {
    if (!process.env[key]?.trim() && value.trim()) {
      process.env[key] = value;
    }
  }
}

import { createApp } from "./app.js";
import { disconnectPrisma } from "./db/prisma.js";

async function main() {
  try {
    const { app, config } = await createApp();

    const server = app.listen(config.port, () => {
      console.log(`[Aetheria AI] Server laeuft auf http://localhost:${config.port}`);
      console.log(`[Aetheria AI] Health: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n[Aetheria AI] Server wird beendet...");
      server.close(async () => {
        await disconnectPrisma();
        console.log("[Aetheria AI] Auf Wiedersehen!");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("[Aetheria AI] Fehler beim Starten:", error);
    process.exit(1);
  }
}

main();
