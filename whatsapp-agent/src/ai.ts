import Anthropic from '@anthropic-ai/sdk';
import type { ConfigManager } from './config-manager.js';
import type { ChatMessage } from './types.js';

export class AIService {
  private client: Anthropic;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    const config = configManager.get();
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  async generateReply(
    chatName: string,
    isGroup: boolean,
    senderName: string,
    history: ChatMessage[]
  ): Promise<string> {
    const config = this.configManager.get();

    const contextInfo = isGroup
      ? `Du bist in einer WhatsApp-Gruppe namens "${chatName}". Die letzte Nachricht ist von "${senderName}".`
      : `Du chattest mit "${chatName}" auf WhatsApp.`;

    const systemPrompt = `${config.systemPrompt}

${contextInfo}

Wichtige Regeln:
- Antworte NUR mit dem Nachrichtentext, keine Formatierung wie "Antwort:" oder Anführungszeichen
- Benutze keine Emojis, es sei denn der Gesprächspartner verwendet welche
- Passe deinen Stil an den des Gesprächspartners an (formell/informell)
- Wenn du dir bei etwas unsicher bist, sag das ehrlich
- Antworte NICHT auf Nachrichten die offensichtlich nicht an dich gerichtet sind
- Halte dich kurz - WhatsApp-Nachrichten sind typischerweise kurz`;

    const messages = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content:
        msg.role === 'user' && msg.senderName
          ? `[${msg.senderName}]: ${msg.content}`
          : msg.content,
    }));

    const response = await this.client.messages.create({
      model: config.claudeModel,
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text?.trim() ?? '';
  }
}
