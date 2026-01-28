import { createApp } from "./app.js";

const PORT = process.env.PORT ?? 4000;

const { app } = createApp();

app.listen(PORT, () => {
  console.log(`[Aetheria AI] Server running on http://localhost:${PORT}`);
  console.log(`[Aetheria AI] Health: http://localhost:${PORT}/api/health`);
});
