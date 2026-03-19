import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, Base64ImageSource } from '@anthropic-ai/sdk/resources/messages/messages.js';
import type { ConfigManager } from './config-manager.js';
import type { ChatMessage } from './types.js';

type ImageMediaType = Base64ImageSource['media_type'];

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
    history: ChatMessage[],
    currentMedia?: { buffer: Buffer; mimeType: string; mediaType: string }
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
- Halte dich kurz - WhatsApp-Nachrichten sind typischerweise kurz
- Wenn ein Bild gesendet wird, beschreibe oder kommentiere es kurz und natürlich
- Wenn eine Sprachnachricht gesendet wird, erwähne dass du sie leider nicht abspielen kannst`;

    const messages = this.buildMessages(history, currentMedia);

    const response = await this.client.messages.create({
      model: config.claudeModel,
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text?.trim() ?? '';
  }

  private buildMessages(
    history: ChatMessage[],
    currentMedia?: { buffer: Buffer; mimeType: string; mediaType: string }
  ): Anthropic.MessageCreateParams['messages'] {
    const messages: Anthropic.MessageCreateParams['messages'] = [];

    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      const isLast = i === history.length - 1;

      if (msg.role === 'user') {
        const content: ContentBlockParam[] = [];
        const prefix = msg.senderName ? `[${msg.senderName}]: ` : '';

        // Bild der aktuellen Nachricht anhängen (nur bei letzter Nachricht)
        if (isLast && currentMedia && this.isImageType(currentMedia.mimeType)) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: currentMedia.mimeType as ImageMediaType,
              data: currentMedia.buffer.toString('base64'),
            },
          });
        }

        // Medien-Hinweis für ältere Nachrichten mit Medien
        let textContent = msg.content;
        if (!isLast && msg.mediaType && !msg.content) {
          const mediaLabels: Record<string, string> = {
            image: 'Bild',
            video: 'Video',
            audio: 'Sprachnachricht',
            sticker: 'Sticker',
          };
          textContent = `[${mediaLabels[msg.mediaType] ?? 'Medien'} gesendet]`;
        }

        // Bei aktueller Nachricht ohne Text aber mit Bild
        if (isLast && !msg.content && currentMedia) {
          if (currentMedia.mediaType === 'audio') {
            textContent = `${prefix}[Sprachnachricht gesendet]`;
          } else if (currentMedia.mediaType === 'video') {
            textContent = `${prefix}[Video gesendet]`;
          } else if (currentMedia.mediaType === 'sticker') {
            textContent = `${prefix}[Sticker gesendet]`;
          } else {
            textContent = `${prefix}[Bild gesendet]`;
          }
        } else {
          textContent = `${prefix}${textContent || '[Nachricht ohne Text]'}`;
        }

        content.push({ type: 'text', text: textContent });
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    return messages;
  }

  private isImageType(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
  }
}
