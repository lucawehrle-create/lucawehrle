import { loadConfig } from './config.js';
import { AIService } from './ai.js';
import { WhatsAppClient } from './whatsapp.js';
import { MessageHandler } from './message-handler.js';

async function main() {
  console.log('🤖 WhatsApp AI Agent startet...\n');

  const config = loadConfig();
  const ai = new AIService(config);
  const wa = new WhatsAppClient(config);
  const handler = new MessageHandler(config, ai, wa);

  wa.onMessage((msg) => handler.handle(msg));

  await wa.connect();

  // Graceful Shutdown
  const shutdown = () => {
    console.log('\n👋 Agent wird beendet...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
