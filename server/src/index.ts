import "dotenv/config";
import { createApp } from "./app.js";

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`[Aetheria AI] Server laeuft auf http://localhost:${config.port}`);
  console.log(`[Aetheria AI] Health: http://localhost:${config.port}/api/health`);
});
