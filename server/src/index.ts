import dotenv from "dotenv";

// .env laden (Hauptdatei), dann .env.example als Fallback
// So funktioniert der Key, egal in welcher Datei er steht.
// Werte aus .env haben Vorrang – .env.example ueberschreibt nichts.
dotenv.config();                            // .env
dotenv.config({ path: ".env.example" });    // Fallback

import { createApp } from "./app.js";

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`[Aetheria AI] Server laeuft auf http://localhost:${config.port}`);
  console.log(`[Aetheria AI] Health: http://localhost:${config.port}/api/health`);
});
