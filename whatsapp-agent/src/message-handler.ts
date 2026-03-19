import type { AIService } from './ai.js';
import type { WhatsAppClient, IncomingMessage } from './whatsapp.js';
import type { ConfigManager } from './config-manager.js';
import type { Dashboard } from './dashboard.js';
import type { ChatHistory, ChatMessage } from './types.js';

export class MessageHandler {
  private configManager: ConfigManager;
  private ai: AIService;
  private wa: WhatsAppClient;
  private dashboard: Dashboard | null = null;
  private chatHistories: Map<string, ChatHistory> = new Map();

  constructor(configManager: ConfigManager, ai: AIService, wa: WhatsAppClient) {
    this.configManager = configManager;
    this.ai = ai;
    this.wa = wa;
  }

  setDashboard(dashboard: Dashboard): void {
    this.dashboard = dashboard;
  }

  getChatHistories(): Map<string, ChatHistory> {
    return this.chatHistories;
  }

  async handle(incoming: IncomingMessage): Promise<void> {
    const config = this.configManager.get();

    console.log(
      `📨 [${incoming.isGroup ? incoming.chatName : incoming.senderName}] ${incoming.senderName}: ${incoming.text}`
    );

    this.dashboard?.addLog({
      type: 'incoming',
      chatId: incoming.chatId,
      chatName: incoming.chatName,
      senderName: incoming.senderName,
      text: incoming.text,
      timestamp: Date.now(),
    });

    // Nachricht zur Historie hinzufügen
    this.addToHistory(incoming.chatId, {
      role: 'user',
      content: incoming.text,
      timestamp: Date.now(),
      senderName: incoming.senderName,
    }, incoming.chatName, incoming.isGroup);

    if (!config.autoReplyEnabled) {
      console.log('   ⏸️  Auto-Reply ist deaktiviert, überspringe.');
      return;
    }

    try {
      const history = this.getHistory(incoming.chatId);

      // Tipp-Simulation
      const typingMs = config.replyDelaySeconds * 1000;
      await this.wa.simulateTyping(incoming.chatId, typingMs);

      // AI-Antwort generieren
      const reply = await this.ai.generateReply(
        incoming.chatName,
        incoming.isGroup,
        incoming.senderName,
        history
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

      // Antwort zur Historie hinzufügen
      this.addToHistory(incoming.chatId, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }, incoming.chatName, incoming.isGroup);
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

  private addToHistory(
    chatId: string,
    message: ChatMessage,
    chatName: string,
    isGroup: boolean
  ): void {
    if (!this.chatHistories.has(chatId)) {
      this.chatHistories.set(chatId, {
        chatId,
        chatName,
        messages: [],
        isGroup,
      });
    }

    const history = this.chatHistories.get(chatId)!;
    history.messages.push(message);

    const config = this.configManager.get();
    if (history.messages.length > config.maxHistory) {
      history.messages = history.messages.slice(-config.maxHistory);
    }
  }

  private getHistory(chatId: string): ChatMessage[] {
    return this.chatHistories.get(chatId)?.messages ?? [];
  }
}
