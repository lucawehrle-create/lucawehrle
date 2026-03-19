import type { AIService } from './ai.js';
import type { WhatsAppClient, IncomingMessage } from './whatsapp.js';
import type { ConfigManager } from './config-manager.js';
import type { Dashboard } from './dashboard.js';
import type { Store } from './store.js';
import type { ChatMessage } from './types.js';

export class MessageHandler {
  private configManager: ConfigManager;
  private ai: AIService;
  private wa: WhatsAppClient;
  private store: Store;
  private dashboard: Dashboard | null = null;

  constructor(configManager: ConfigManager, ai: AIService, wa: WhatsAppClient, store: Store) {
    this.configManager = configManager;
    this.ai = ai;
    this.wa = wa;
    this.store = store;
  }

  setDashboard(dashboard: Dashboard): void {
    this.dashboard = dashboard;
  }

  getStore(): Store {
    return this.store;
  }

  async handle(incoming: IncomingMessage): Promise<void> {
    const config = this.configManager.get();

    const mediaLabel = incoming.mediaType
      ? ` [${incoming.mediaType}${incoming.mediaPath ? ' gespeichert' : ''}]`
      : '';

    console.log(
      `📨 [${incoming.isGroup ? incoming.chatName : incoming.senderName}] ${incoming.senderName}: ${incoming.text || incoming.mediaType || '?'}${mediaLabel}`
    );

    this.dashboard?.addLog({
      type: 'incoming',
      chatId: incoming.chatId,
      chatName: incoming.chatName,
      senderName: incoming.senderName,
      text: incoming.text || `[${incoming.mediaType ?? 'Medien'} gesendet]`,
      timestamp: Date.now(),
      mediaType: incoming.mediaType ?? undefined,
      mediaPath: incoming.mediaPath ?? undefined,
    });

    // Nachricht in DB speichern
    const userMessage: ChatMessage = {
      role: 'user',
      content: incoming.text || '',
      timestamp: Date.now(),
      senderName: incoming.senderName,
      mediaType: incoming.mediaType ?? undefined,
      mediaPath: incoming.mediaPath ?? undefined,
    };
    this.store.addMessage(incoming.chatId, incoming.chatName, incoming.isGroup, userMessage);

    if (!config.autoReplyEnabled) {
      console.log('   ⏸️  Auto-Reply ist deaktiviert, überspringe.');
      return;
    }

    try {
      const history = this.store.getHistory(incoming.chatId, config.maxHistory);

      // Tipp-Simulation
      const typingMs = config.replyDelaySeconds * 1000;
      await this.wa.simulateTyping(incoming.chatId, typingMs);

      // Medien-Kontext für aktuelle Nachricht
      const currentMedia =
        incoming.mediaBuffer && incoming.mediaType && incoming.mediaMimeType
          ? {
              buffer: incoming.mediaBuffer,
              mimeType: incoming.mediaMimeType,
              mediaType: incoming.mediaType,
            }
          : undefined;

      // AI-Antwort generieren
      const reply = await this.ai.generateReply(
        incoming.chatName,
        incoming.isGroup,
        incoming.senderName,
        history,
        currentMedia
      );

      if (!reply) {
        console.log('   ⏭️  AI hat keine Antwort generiert, überspringe.');
        return;
      }

      // Antwort senden
      await this.wa.sendMessage(incoming.chatId, reply);
      console.log(`📤 [${incoming.isGroup ? incoming.chatName : incoming.senderName}] Antwort: ${reply}`);

      this.dashboard?.addLog({
        type: 'outgoing',
        chatId: incoming.chatId,
        chatName: incoming.chatName,
        text: reply,
        timestamp: Date.now(),
      });

      // Antwort in DB speichern
      this.store.addMessage(incoming.chatId, incoming.chatName, incoming.isGroup, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Fehler bei der Verarbeitung:`, error);
      this.dashboard?.addLog({
        type: 'error',
        chatId: incoming.chatId,
        chatName: incoming.chatName,
        text: `Fehler: ${errMsg}`,
        timestamp: Date.now(),
      });
    }
  }
}
