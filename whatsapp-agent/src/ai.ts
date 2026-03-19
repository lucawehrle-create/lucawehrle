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

  /**
   * Analysiert den Schreibstil anhand der User-Nachrichten im Verlauf.
   * Gibt eine Stil-Beschreibung zurück, die ins System-Prompt eingebaut wird.
   */
  private analyzeWritingStyle(history: ChatMessage[]): string {
    const userMessages = history
      .filter((m) => m.role === 'user' && m.content && m.content.length > 0)
      .map((m) => m.content);

    if (userMessages.length === 0) {
      return `Es gibt keinen bisherigen Chatverlauf. Antworte kontextbasiert:
- Erkenne aus der ersten Nachricht die Sprache, den Ton und die Absicht
- Passe dich sofort an den Stil der ersten Nachricht an
- Im Zweifel: freundlich, locker und kurz antworten`;
    }

    // Stil-Merkmale erkennen
    const allText = userMessages.join(' ');
    const avgLength = Math.round(allText.length / userMessages.length);

    const usesEmojis = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(allText);
    const usesSlang = /\b(lol|haha|omg|wtf|bruh|digga|alter|ey|jo|nah|kp|kb|nice|krass|geil|safe|real|fr|ngl|tbh|idk)\b/i.test(allText);
    const usesAbbreviations = /\b(vllt|evtl|bzgl|ggf|mfg|lg|vg|bitte|pls|thx|ty|np|imo|asap|btw)\b/i.test(allText);
    const isLowercase = userMessages.every((m) => m === m.toLowerCase());
    const skipsPunctuation = userMessages.filter((m) => !/[.!?]$/.test(m.trim())).length > userMessages.length * 0.6;
    const usesUppercase = /[A-ZÄÖÜ]{3,}/.test(allText);
    const isGerman = /\b(ich|du|und|ist|nicht|das|ein|die|der|den|dem|hab|hast|kannst|wir|mir|dir|was|wie|wo)\b/i.test(allText);
    const isEnglish = /\b(the|is|are|you|have|can|will|what|how|this|that|with|for|not)\b/i.test(allText);

    const traits: string[] = [];

    // Sprache
    if (isGerman && !isEnglish) traits.push('Sprache: Deutsch');
    else if (isEnglish && !isGerman) traits.push('Sprache: Englisch');
    else if (isGerman && isEnglish) traits.push('Sprache: Deutsch-Englisch gemischt');

    // Länge
    if (avgLength < 20) traits.push('Nachrichtenlänge: sehr kurz (1-3 Wörter)');
    else if (avgLength < 50) traits.push('Nachrichtenlänge: kurz');
    else if (avgLength < 120) traits.push('Nachrichtenlänge: mittel');
    else traits.push('Nachrichtenlänge: eher lang');

    // Formalität
    if (usesSlang) traits.push('Nutzt Slang/Jugendsprache');
    if (usesAbbreviations) traits.push('Nutzt Abkürzungen');
    if (isLowercase) traits.push('Schreibt komplett klein');
    if (skipsPunctuation) traits.push('Lässt Satzzeichen oft weg');
    if (usesUppercase) traits.push('Nutzt Großbuchstaben zur Betonung');
    if (usesEmojis) traits.push('Verwendet Emojis');
    else traits.push('Verwendet keine Emojis');

    // Beispiele sammeln (maximal 5 kürzere Nachrichten als Referenz)
    const examples = userMessages
      .filter((m) => m.length > 2 && m.length < 200)
      .slice(-5);

    let styleDescription = `Schreibstil-Analyse des Gesprächspartners:
${traits.map((t) => `- ${t}`).join('\n')}`;

    if (examples.length > 0) {
      styleDescription += `

Beispiele wie der Gesprächspartner schreibt:
${examples.map((e) => `> "${e}"`).join('\n')}`;
    }

    styleDescription += `

WICHTIG: Spiegle diesen Schreibstil exakt. Wenn der Gesprächspartner klein schreibt, schreib auch klein. Wenn er Slang nutzt, nutz auch Slang. Wenn er kurz schreibt, antworte auch kurz. Passe dich an wie ein Chamäleon.`;

    return styleDescription;
  }

  async generateReply(
    chatName: string,
    isGroup: boolean,
    senderName: string,
    history: ChatMessage[],
    currentMedia?: { buffer: Buffer; mimeType: string; mediaType: string },
    customPrompt?: string
  ): Promise<string> {
    const config = this.configManager.get();

    const contextInfo = isGroup
      ? `Du bist in einer WhatsApp-Gruppe namens "${chatName}". Die letzte Nachricht ist von "${senderName}".`
      : `Du chattest mit "${chatName}" auf WhatsApp.`;

    const styleAnalysis = this.analyzeWritingStyle(history);

    const basePrompt = customPrompt || config.systemPrompt;

    const systemPrompt = `${basePrompt}

${contextInfo}

${styleAnalysis}

Wichtige Regeln:
- Antworte NUR mit dem Nachrichtentext, keine Formatierung wie "Antwort:" oder Anführungszeichen
- Dein Schreibstil MUSS den des Gesprächspartners spiegeln (siehe Stil-Analyse oben)
- Wenn du dir bei etwas unsicher bist, sag das ehrlich
- Antworte NICHT auf Nachrichten die offensichtlich nicht an dich gerichtet sind
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
