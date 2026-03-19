import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import type { Config } from './config.js';

export interface IncomingMessage {
  chatId: string;
  chatName: string;
  senderJid: string;
  senderName: string;
  text: string;
  isGroup: boolean;
  isMentioned: boolean;
  messageKey: proto.IMessageKey;
}

type MessageHandler = (message: IncomingMessage) => Promise<void>;

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private config: Config;
  private logger: pino.Logger;
  private messageHandler: MessageHandler | null = null;
  private myJid: string = '';

  constructor(config: Config) {
    this.config = config;
    this.logger = pino({ level: config.logLevel });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  async connect(): Promise<void> {
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
        this.myJid = this.socket?.user?.id ?? '';
        console.log('\n✅ WhatsApp verbunden!');
        console.log(`   Angemeldet als: ${this.socket?.user?.name ?? 'Unbekannt'}`);
        console.log(`   Auto-Reply: ${this.config.autoReplyEnabled ? 'AN' : 'AUS'}\n`);
      }
    });

    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        await this.handleIncomingMessage(msg);
      }
    });
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
    if (!msg.message || !msg.key.remoteJid) return;
    if (msg.key.fromMe) return;

    const text = this.extractText(msg);
    if (!text) return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const senderJid = isGroup ? msg.key.participant ?? '' : chatId;

    // Filter: erlaubte/blockierte Chats
    if (this.config.allowedChats.length > 0 && !this.config.allowedChats.includes(chatId)) {
      return;
    }
    if (this.config.blockedChats.includes(chatId)) {
      return;
    }

    // In Gruppen: nur antworten wenn erwähnt
    const isMentioned = this.checkIfMentioned(msg, text);
    if (isGroup && this.config.groupsOnlyWhenMentioned && !isMentioned) {
      return;
    }

    const chatName = await this.getChatName(chatId, msg);
    const senderName = msg.pushName ?? senderJid.split('@')[0];

    if (this.messageHandler) {
      await this.messageHandler({
        chatId,
        chatName,
        senderJid,
        senderName,
        text,
        isGroup,
        isMentioned,
        messageKey: msg.key,
      });
    }
  }

  private extractText(msg: proto.IWebMessageInfo): string | null {
    const m = msg.message!;
    return (
      m.conversation ??
      m.extendedTextMessage?.text ??
      m.imageMessage?.caption ??
      m.videoMessage?.caption ??
      null
    );
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
      // Gruppenname aus Metadaten holen
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
