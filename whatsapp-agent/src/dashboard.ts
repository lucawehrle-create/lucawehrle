import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ConfigManager, ConfigUpdate } from './config-manager.js';
import type { Store } from './store.js';
import type { MediaType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LogEntry {
  type: 'incoming' | 'outgoing' | 'system' | 'error';
  chatId?: string;
  chatName?: string;
  senderName?: string;
  text: string;
  timestamp: number;
  mediaType?: MediaType;
  mediaPath?: string;
}

export class Dashboard {
  private app: express.Express;
  private wss: WebSocketServer;
  private logs: LogEntry[] = [];
  private configManager: ConfigManager;
  private getStore: () => Store;
  private getConnectionStatus: () => { connected: boolean; name?: string };
  private sendWhatsAppMessage: ((chatId: string, text: string) => Promise<void>) | null = null;

  constructor(
    configManager: ConfigManager,
    getStore: () => Store,
    getConnectionStatus: () => { connected: boolean; name?: string }
  ) {
    this.configManager = configManager;
    this.getStore = getStore;
    this.getConnectionStatus = getConnectionStatus;

    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '..', 'public')));

    // Medien-Dateien servieren
    this.app.use('/media', express.static('data/media'));

    this.setupRoutes();

    const server = createServer(this.app);
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'init', logs: this.logs.slice(-100) }));
    });

    const port = parseInt(process.env.DASHBOARD_PORT ?? '3333', 10);
    server.listen(port, () => {
      console.log(`\n📊 Dashboard: http://localhost:${port}\n`);
    });
  }

  private setupRoutes(): void {
    // Config lesen
    this.app.get('/api/config', (_req, res) => {
      const config = this.configManager.get();
      const { anthropicApiKey, ...safeConfig } = config;
      res.json(safeConfig);
    });

    // Config updaten
    this.app.put('/api/config', (req, res) => {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Ungültiger Request Body' });
        return;
      }

      const updates: ConfigUpdate = {};
      if (typeof body.systemPrompt === 'string') updates.systemPrompt = body.systemPrompt.slice(0, 5000);
      if (typeof body.claudeModel === 'string') updates.claudeModel = body.claudeModel;
      if (typeof body.autoReplyEnabled === 'boolean') updates.autoReplyEnabled = body.autoReplyEnabled;
      if (typeof body.groupsOnlyWhenMentioned === 'boolean') updates.groupsOnlyWhenMentioned = body.groupsOnlyWhenMentioned;
      if (typeof body.replyDelayMin === 'number') updates.replyDelayMin = Math.max(0, Math.min(3600, body.replyDelayMin));
      if (typeof body.replyDelayMax === 'number') updates.replyDelayMax = Math.max(0, Math.min(3600, body.replyDelayMax));
      if (typeof body.maxHistory === 'number') updates.maxHistory = Math.max(1, Math.min(50, body.maxHistory));
      if (Array.isArray(body.allowedChats)) updates.allowedChats = body.allowedChats.filter((s: unknown) => typeof s === 'string');
      if (Array.isArray(body.blockedChats)) updates.blockedChats = body.blockedChats.filter((s: unknown) => typeof s === 'string');

      const config = this.configManager.update(updates);
      const { anthropicApiKey, ...safeConfig } = config;
      this.addLog({ type: 'system', text: 'Einstellungen aktualisiert', timestamp: Date.now() });
      res.json(safeConfig);
    });

    // Connection Status
    this.app.get('/api/status', (_req, res) => {
      res.json(this.getConnectionStatus());
    });

    // Chat-Übersicht (aus DB)
    this.app.get('/api/chats', (_req, res) => {
      const store = this.getStore();
      res.json(store.getAllChats());
    });

    // Chat-Detail (aus DB)
    this.app.get('/api/chats/:chatId', (req, res) => {
      const store = this.getStore();
      const history = store.getChatDetail(req.params.chatId);
      if (!history) {
        res.status(404).json({ error: 'Chat nicht gefunden' });
        return;
      }
      res.json(history);
    });

    // Chat-Settings lesen
    this.app.get('/api/chats/:chatId/settings', (req, res) => {
      const store = this.getStore();
      const settings = store.getChatSettings(req.params.chatId);
      res.json(settings ?? {
        chatId: req.params.chatId,
        replyMode: 'default',
        customPrompt: null,
        replyDelayMin: null,
        replyDelayMax: null,
      });
    });

    // Chat-Settings updaten
    this.app.put('/api/chats/:chatId/settings', (req, res) => {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Ungültiger Request Body' });
        return;
      }

      const updates: Record<string, unknown> = {};
      if (typeof body.replyMode === 'string' && ['default', 'enabled', 'disabled', 'proactive'].includes(body.replyMode)) {
        updates.replyMode = body.replyMode;
      }
      if (body.customPrompt !== undefined) {
        updates.customPrompt = typeof body.customPrompt === 'string' && body.customPrompt.trim()
          ? body.customPrompt.slice(0, 5000)
          : null;
      }
      if (body.replyDelayMin !== undefined) {
        updates.replyDelayMin = typeof body.replyDelayMin === 'number'
          ? Math.max(0, Math.min(3600, body.replyDelayMin))
          : null;
      }
      if (body.replyDelayMax !== undefined) {
        updates.replyDelayMax = typeof body.replyDelayMax === 'number'
          ? Math.max(0, Math.min(3600, body.replyDelayMax))
          : null;
      }

      const store = this.getStore();
      const settings = store.updateChatSettings(req.params.chatId, updates);
      this.addLog({
        type: 'system',
        chatId: req.params.chatId,
        text: `Chat-Einstellungen aktualisiert: ${settings.replyMode}`,
        timestamp: Date.now(),
      });
      res.json(settings);
    });

    // Logs
    this.app.get('/api/logs', (_req, res) => {
      res.json(this.logs.slice(-200));
    });

    // Logs löschen
    this.app.delete('/api/logs', (_req, res) => {
      this.logs = [];
      this.broadcast({ type: 'clear' });
      res.json({ ok: true });
    });

    // Manuelle Nachricht senden
    this.app.post('/api/chats/:chatId/send', async (req, res) => {
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text darf nicht leer sein' });
        return;
      }

      if (!this.sendWhatsAppMessage) {
        res.status(503).json({ error: 'WhatsApp ist nicht verfügbar' });
        return;
      }

      const chatId = req.params.chatId;
      const store = this.getStore();

      try {
        await this.sendWhatsAppMessage(chatId, text.trim());

        // In DB speichern
        const chat = store.getChatDetail(chatId);
        store.addMessage(chatId, chat?.chatName ?? chatId, chat?.isGroup ?? false, {
          role: 'assistant',
          content: text.trim(),
          timestamp: Date.now(),
        });

        this.addLog({
          type: 'outgoing',
          chatId,
          chatName: chat?.chatName ?? chatId,
          text: text.trim(),
          timestamp: Date.now(),
        });

        res.json({ ok: true });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: errMsg });
      }
    });
  }

  setSendMessage(fn: (chatId: string, text: string) => Promise<void>): void {
    this.sendWhatsAppMessage = fn;
  }

  addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
    this.broadcast({ type: 'log', entry });
  }

  private broadcast(data: unknown): void {
    const msg = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}
