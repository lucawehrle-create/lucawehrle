import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ConfigManager, ConfigUpdate } from './config-manager.js';
import type { ChatHistory } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface LogEntry {
  type: 'incoming' | 'outgoing' | 'system' | 'error';
  chatId?: string;
  chatName?: string;
  senderName?: string;
  text: string;
  timestamp: number;
}

export class Dashboard {
  private app: express.Express;
  private wss: WebSocketServer;
  private logs: LogEntry[] = [];
  private configManager: ConfigManager;
  private getChatHistories: () => Map<string, ChatHistory>;
  private getConnectionStatus: () => { connected: boolean; name?: string };

  constructor(
    configManager: ConfigManager,
    getChatHistories: () => Map<string, ChatHistory>,
    getConnectionStatus: () => { connected: boolean; name?: string }
  ) {
    this.configManager = configManager;
    this.getChatHistories = getChatHistories;
    this.getConnectionStatus = getConnectionStatus;

    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '..', 'public')));

    this.setupRoutes();

    const server = createServer(this.app);
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      // Sende aktuelle Logs beim Verbinden
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
      const updates: ConfigUpdate = req.body;
      const config = this.configManager.update(updates);
      const { anthropicApiKey, ...safeConfig } = config;
      this.addLog({ type: 'system', text: 'Einstellungen aktualisiert', timestamp: Date.now() });
      res.json(safeConfig);
    });

    // Connection Status
    this.app.get('/api/status', (_req, res) => {
      res.json(this.getConnectionStatus());
    });

    // Chat-Historien
    this.app.get('/api/chats', (_req, res) => {
      const histories = this.getChatHistories();
      const chats = Array.from(histories.entries()).map(([id, h]) => ({
        chatId: id,
        chatName: h.chatName,
        isGroup: h.isGroup,
        messageCount: h.messages.length,
        lastMessage: h.messages[h.messages.length - 1],
      }));
      res.json(chats);
    });

    this.app.get('/api/chats/:chatId', (req, res) => {
      const histories = this.getChatHistories();
      const history = histories.get(req.params.chatId);
      if (!history) {
        res.status(404).json({ error: 'Chat nicht gefunden' });
        return;
      }
      res.json(history);
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
