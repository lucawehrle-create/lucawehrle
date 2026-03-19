import type { Config } from './config.js';
import type { AIService } from './ai.js';
import type { WhatsAppClient, IncomingMessage } from './whatsapp.js';
import type { ChatHistory, ChatMessage } from './types.js';

export class MessageHandler {
  private config: Config;
  private ai: AIService;
  private wa: WhatsAppClient;
  private chatHistories: Map<string, ChatHistory> = new Map();

  constructor(config: Config, ai: AIService, wa: WhatsAppClient) {
    this.config = config;
    this.ai = ai;
    this.wa = wa;
  }

  async handle(incoming: IncomingMessage): Promise<void> {
    console.log(
      `📨 [${incoming.isGroup ? incoming.chatName : incoming.senderName}] ${incoming.senderName}: ${incoming.text}`
    );

    // Nachricht zur Historie hinzufügen
    this.addToHistory(incoming.chatId, {
      role: 'user',
      content: incoming.text,
      timestamp: Date.now(),
      senderName: incoming.senderName,
    }, incoming.chatName, incoming.isGroup);

    if (!this.config.autoReplyEnabled) {
      console.log('   ⏸️  Auto-Reply ist deaktiviert, überspringe.');
      return;
    }

    try {
      const history = this.getHistory(incoming.chatId);

      // Tipp-Simulation
      const typingMs = this.config.replyDelaySeconds * 1000;
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

      // Antwort zur Historie hinzufügen
      this.addToHistory(incoming.chatId, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      }, incoming.chatName, incoming.isGroup);
    } catch (error) {
      console.error(`❌ Fehler bei der Verarbeitung:`, error);
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

    // Historie begrenzen
    if (history.messages.length > this.config.maxHistory) {
      history.messages = history.messages.slice(-this.config.maxHistory);
    }
  }

  private getHistory(chatId: string): ChatMessage[] {
    return this.chatHistories.get(chatId)?.messages ?? [];
  }
}
