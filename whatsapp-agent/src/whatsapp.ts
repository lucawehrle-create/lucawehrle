import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import type { ConfigManager } from './config-manager.js';
import type { MediaType } from './types.js';

const MEDIA_DIR = 'data/media';

export interface IncomingMessage {
  chatId: string;
  chatName: string;
  senderJid: string;
  senderName: string;
  text: string;
  isGroup: boolean;
  isMentioned: boolean;
  messageKey: proto.IMessageKey;
  mediaType?: MediaType;
  mediaPath?: string;
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
}

type MessageHandler = (message: IncomingMessage) => Promise<void>;

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private configManager: ConfigManager;
  private logger: pino.Logger;
  private messageHandler: MessageHandler | null = null;
  private myJid: string = '';
  private connected: boolean = false;
  private userName: string = '';

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    const config = configManager.get();
    this.logger = pino({ level: config.logLevel });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  getStatus(): { connected: boolean; name?: string } {
    return { connected: this.connected, name: this.userName || undefined };
  }

  async connect(): Promise<void> {
    await mkdir(MEDIA_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState('auth');

    this.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger),
      },
      logger: this.logger,
      printQRInTerminal: false,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Scanne diesen QR-Code mit WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\nÖffne WhatsApp → Einstellungen → Verknüpfte Geräte → Gerät verknüpfen\n');
      }

      if (connection === 'close') {
        this.connected = false;
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        console.log(
          `Verbindung getrennt (Grund: ${reason}). ${shouldReconnect ? 'Verbinde erneut...' : 'Ausgeloggt.'}`
        );

        if (shouldReconnect) {
          setTimeout(() => this.connect(), 3000);
        }
      }

      if (connection === 'open') {
        this.connected = true;
        this.myJid = this.socket?.user?.id ?? '';
        this.userName = this.socket?.user?.name ?? 'Unbekannt';
        console.log('\n✅ WhatsApp verbunden!');
        console.log(`   Angemeldet als: ${this.userName}`);
        const config = this.configManager.get();
        console.log(`   Auto-Reply: ${config.autoReplyEnabled ? 'AN' : 'AUS'}\n`);
      }
    });

    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          await this.handleIncomingMessage(msg);
        } catch (error) {
          this.logger.error(error, 'Fehler bei Nachrichtenverarbeitung');
        }
      }
    });
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
    if (!msg.message || !msg.key.remoteJid) return;
    if (msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const senderJid = isGroup ? msg.key.participant ?? '' : chatId;

    const config = this.configManager.get();

    // Filter: erlaubte/blockierte Chats
    if (config.allowedChats.length > 0 && !config.allowedChats.includes(chatId)) {
      return;
    }
    if (config.blockedChats.includes(chatId)) {
      return;
    }

    // Text und Medien extrahieren
    const { text, mediaType, mediaMimeType } = this.extractContent(msg);

    // Mindestens Text oder Medien müssen vorhanden sein
    if (!text && !mediaType) return;

    // In Gruppen: nur antworten wenn erwähnt
    const isMentioned = this.checkIfMentioned(msg, text ?? '');
    if (isGroup && config.groupsOnlyWhenMentioned && !isMentioned) {
      return;
    }

    // Medien herunterladen wenn vorhanden
    let mediaPath: string | undefined;
    let mediaBuffer: Buffer | undefined;
    if (mediaType) {
      try {
        const result = await this.downloadMedia(msg, mediaType, mediaMimeType);
        mediaPath = result.path;
        mediaBuffer = result.buffer;
      } catch (error) {
        this.logger.warn(error, 'Medien konnten nicht heruntergeladen werden');
      }
    }

    const chatName = await this.getChatName(chatId, msg);
    const senderName = msg.pushName ?? senderJid.split('@')[0];

    if (this.messageHandler) {
      await this.messageHandler({
        chatId,
        chatName,
        senderJid,
        senderName,
        text: text ?? '',
        isGroup,
        isMentioned,
        messageKey: msg.key,
        mediaType,
        mediaPath,
        mediaBuffer,
        mediaMimeType,
      });
    }
  }

  private extractContent(msg: proto.IWebMessageInfo): {
    text: string | null;
    mediaType: MediaType;
    mediaMimeType?: string;
  } {
    const m = msg.message!;

    // Bild
    if (m.imageMessage) {
      return {
        text: m.imageMessage.caption ?? null,
        mediaType: 'image',
        mediaMimeType: m.imageMessage.mimetype ?? 'image/jpeg',
      };
    }

    // Video
    if (m.videoMessage) {
      return {
        text: m.videoMessage.caption ?? null,
        mediaType: 'video',
        mediaMimeType: m.videoMessage.mimetype ?? 'video/mp4',
      };
    }

    // Sprachnachricht / Audio
    if (m.audioMessage) {
      return {
        text: null,
        mediaType: 'audio',
        mediaMimeType: m.audioMessage.mimetype ?? 'audio/ogg',
      };
    }

    // Sticker
    if (m.stickerMessage) {
      return {
        text: null,
        mediaType: 'sticker',
        mediaMimeType: m.stickerMessage.mimetype ?? 'image/webp',
      };
    }

    // Nur Text
    const text =
      m.conversation ??
      m.extendedTextMessage?.text ??
      null;

    return { text, mediaType: null };
  }

  private async downloadMedia(
    msg: proto.IWebMessageInfo,
    mediaType: MediaType,
    mimeType?: string
  ): Promise<{ path: string; buffer: Buffer }> {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.socket!.updateMediaMessage,
      }
    ) as Buffer;

    const ext = this.getExtension(mimeType ?? '', mediaType);
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const subDir = join(MEDIA_DIR, mediaType ?? 'other');
    await mkdir(subDir, { recursive: true });
    const filePath = join(subDir, filename);
    await writeFile(filePath, buffer);

    return { path: filePath, buffer };
  }

  private getExtension(mimeType: string, mediaType: MediaType): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
    };
    if (map[mimeType]) return map[mimeType];
    if (mediaType === 'image') return 'jpg';
    if (mediaType === 'video') return 'mp4';
    if (mediaType === 'audio') return 'ogg';
    if (mediaType === 'sticker') return 'webp';
    return 'bin';
  }

  private checkIfMentioned(msg: proto.IWebMessageInfo, text: string): boolean {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const myNumber = this.myJid.split(':')[0].split('@')[0];

    if (mentions.some((jid) => jid.includes(myNumber))) return true;
    if (text.toLowerCase().includes(`@${myNumber}`)) return true;

    return false;
  }

  private async getChatName(
    chatId: string,
    msg: proto.IWebMessageInfo
  ): Promise<string> {
    if (chatId.endsWith('@g.us')) {
      try {
        const metadata = await this.socket?.groupMetadata(chatId);
        return metadata?.subject ?? chatId;
      } catch {
        return chatId;
      }
    }
    return msg.pushName ?? chatId.split('@')[0];
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp ist nicht verbunden');
    await this.socket.sendMessage(chatId, { text });
  }

  async simulateTyping(chatId: string, durationMs: number): Promise<void> {
    if (!this.socket) return;
    await this.socket.sendPresenceUpdate('composing', chatId);
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await this.socket.sendPresenceUpdate('paused', chatId);
  }
}
