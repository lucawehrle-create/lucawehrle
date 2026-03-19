import { mkdirSync } from 'fs';
import { ConfigManager } from './config-manager.js';
import { AIService } from './ai.js';
import { WhatsAppClient } from './whatsapp.js';
import { MessageHandler } from './message-handler.js';
import { Dashboard } from './dashboard.js';
import { Store } from './store.js';

async function main() {
  console.log('🤖 WhatsApp AI Agent startet...\n');

  // data-Verzeichnis sicherstellen
  mkdirSync('data', { recursive: true });

  const configManager = new ConfigManager();
  const store = new Store('data/chat-history.db');
  const ai = new AIService(configManager);
  const wa = new WhatsAppClient(configManager);
  const handler = new MessageHandler(configManager, ai, wa, store);

  // Dashboard starten
  const dashboard = new Dashboard(
    configManager,
    () => handler.getStore(),
    () => wa.getStatus()
  );
  handler.setDashboard(dashboard);

  wa.onMessage((msg) => handler.handle(msg));

  await wa.connect();

  dashboard.addLog({
    type: 'system',
    text: 'Agent gestartet, warte auf WhatsApp-Verbindung...',
    timestamp: Date.now(),
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('\n👋 Agent wird beendet...');
    store.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
