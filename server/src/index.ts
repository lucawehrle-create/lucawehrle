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

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`[Aetheria AI] Server laeuft auf http://localhost:${config.port}`);
  console.log(`[Aetheria AI] Health: http://localhost:${config.port}/api/health`);
});
