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

    // Per-Chat-Einstellungen prüfen
    const chatSettings = this.store.getChatSettings(incoming.chatId);
    const replyMode = chatSettings?.replyMode ?? 'default';

    // Entscheiden ob geantwortet werden soll
    let shouldReply = config.autoReplyEnabled;
    if (replyMode === 'enabled' || replyMode === 'proactive') {
      shouldReply = true;
    } else if (replyMode === 'disabled') {
      shouldReply = false;
    }

    if (!shouldReply) {
      console.log('   ⏸️  Auto-Reply ist deaktiviert, überspringe.');
      return;
    }

    try {
      const history = this.store.getHistory(incoming.chatId, config.maxHistory);

      // Verzögerung berechnen (per-Chat override oder global)
      const delayMin = chatSettings?.replyDelayMin ?? config.replyDelayMin;
      const delayMax = chatSettings?.replyDelayMax ?? config.replyDelayMax;
      const delaySec = delayMin + Math.random() * (Math.max(delayMax, delayMin) - delayMin);
      const delayMs = Math.round(delaySec * 1000);

      if (delayMs > 0) {
        // Bei kurzen Delays: komplett als Tipp-Simulation
        // Bei langen Delays: erst warten, dann kurz tippen
        const TYPING_MAX_MS = 15_000; // Max 15s Tipp-Anzeige
        if (delayMs <= TYPING_MAX_MS) {
          await this.wa.simulateTyping(incoming.chatId, delayMs);
        } else {
          const waitMs = delayMs - TYPING_MAX_MS;
          const typingMs = 3000 + Math.random() * 12_000; // 3-15s tippen
          console.log(`   ⏳ Warte ${Math.round(delaySec)}s bevor geantwortet wird...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          await this.wa.simulateTyping(incoming.chatId, typingMs);
        }
      }

      // Medien-Kontext für aktuelle Nachricht
      const currentMedia =
        incoming.mediaBuffer && incoming.mediaType && incoming.mediaMimeType
          ? {
              buffer: incoming.mediaBuffer,
              mimeType: incoming.mediaMimeType,
              mediaType: incoming.mediaType,
            }
          : undefined;

      // Custom-Prompt für diesen Chat (falls gesetzt)
      const customPrompt = chatSettings?.customPrompt ?? undefined;

      // AI-Antwort generieren
      const reply = await this.ai.generateReply(
        incoming.chatName,
        incoming.isGroup,
        incoming.senderName,
        history,
        currentMedia,
        customPrompt
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
