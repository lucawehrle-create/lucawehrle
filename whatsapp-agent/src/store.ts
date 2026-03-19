import Database from 'better-sqlite3';
import type { ChatMessage, ChatHistory, ChatSettings, ChatReplyMode, MediaType } from './types.js';

export class Store {
  private db: Database.Database;

  constructor(dbPath: string = 'data/chat-history.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        chat_id TEXT PRIMARY KEY,
        chat_name TEXT NOT NULL,
        is_group INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sender_name TEXT,
        media_type TEXT,
        media_path TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

      CREATE TABLE IF NOT EXISTS chat_settings (
        chat_id TEXT PRIMARY KEY,
        reply_mode TEXT NOT NULL DEFAULT 'default' CHECK(reply_mode IN ('default', 'enabled', 'disabled', 'proactive')),
        custom_prompt TEXT,
        reply_delay_min INTEGER,
        reply_delay_max INTEGER,
        FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
      );
    `);

    // Migration: alte reply_delay_seconds Spalte in min/max konvertieren
    try {
      const cols = this.db.pragma('table_info(chat_settings)') as Array<{ name: string }>;
      const hasOldColumn = cols.some((c) => c.name === 'reply_delay_seconds');
      if (hasOldColumn) {
        this.db.exec(`
          ALTER TABLE chat_settings RENAME TO chat_settings_old;
          CREATE TABLE chat_settings (
            chat_id TEXT PRIMARY KEY,
            reply_mode TEXT NOT NULL DEFAULT 'default' CHECK(reply_mode IN ('default', 'enabled', 'disabled', 'proactive')),
            custom_prompt TEXT,
            reply_delay_min INTEGER,
            reply_delay_max INTEGER,
            FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
          );
          INSERT INTO chat_settings (chat_id, reply_mode, custom_prompt, reply_delay_min, reply_delay_max)
            SELECT chat_id, reply_mode, custom_prompt, reply_delay_seconds, reply_delay_seconds FROM chat_settings_old;
          DROP TABLE chat_settings_old;
        `);
      }
    } catch { /* table doesn't exist yet or already migrated */ }
  }

  addMessage(
    chatId: string,
    chatName: string,
    isGroup: boolean,
    message: ChatMessage
  ): number {
    // Upsert Chat
    this.db.prepare(`
      INSERT INTO chats (chat_id, chat_name, is_group, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        chat_name = excluded.chat_name,
        updated_at = excluded.updated_at
    `).run(chatId, chatName, isGroup ? 1 : 0, message.timestamp);

    // Insert Message
    const result = this.db.prepare(`
      INSERT INTO messages (chat_id, role, content, timestamp, sender_name, media_type, media_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      chatId,
      message.role,
      message.content,
      message.timestamp,
      message.senderName ?? null,
      message.mediaType ?? null,
      message.mediaPath ?? null
    );

    return Number(result.lastInsertRowid);
  }

  getHistory(chatId: string, limit: number = 20): ChatMessage[] {
    const rows = this.db.prepare(`
      SELECT id, role, content, timestamp, sender_name, media_type, media_path
      FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(chatId, limit) as Array<{
      id: number;
      role: string;
      content: string;
      timestamp: number;
      sender_name: string | null;
      media_type: string | null;
      media_path: string | null;
    }>;

    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      timestamp: row.timestamp,
      senderName: row.sender_name ?? undefined,
      mediaType: (row.media_type as MediaType) ?? undefined,
      mediaPath: row.media_path ?? undefined,
    }));
  }

  getChatDetail(chatId: string): ChatHistory | null {
    const chat = this.db.prepare(`
      SELECT chat_id, chat_name, is_group FROM chats WHERE chat_id = ?
    `).get(chatId) as { chat_id: string; chat_name: string; is_group: number } | undefined;

    if (!chat) return null;

    return {
      chatId: chat.chat_id,
      chatName: chat.chat_name,
      isGroup: chat.is_group === 1,
      messages: this.getHistory(chatId, 100),
    };
  }

  getAllChats(): Array<{
    chatId: string;
    chatName: string;
    isGroup: boolean;
    messageCount: number;
    lastMessage?: ChatMessage;
  }> {
    const chats = this.db.prepare(`
      SELECT
        c.chat_id,
        c.chat_name,
        c.is_group,
        COUNT(m.id) as message_count,
        c.updated_at
      FROM chats c
      LEFT JOIN messages m ON c.chat_id = m.chat_id
      GROUP BY c.chat_id
      ORDER BY c.updated_at DESC
    `).all() as Array<{
      chat_id: string;
      chat_name: string;
      is_group: number;
      message_count: number;
      updated_at: number;
    }>;

    return chats.map((chat) => {
      const lastMsg = this.db.prepare(`
        SELECT id, role, content, timestamp, sender_name, media_type, media_path
        FROM messages
        WHERE chat_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(chat.chat_id) as {
        id: number;
        role: string;
        content: string;
        timestamp: number;
        sender_name: string | null;
        media_type: string | null;
        media_path: string | null;
      } | undefined;

      return {
        chatId: chat.chat_id,
        chatName: chat.chat_name,
        isGroup: chat.is_group === 1,
        messageCount: chat.message_count,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              role: lastMsg.role as 'user' | 'assistant',
              content: lastMsg.content,
              timestamp: lastMsg.timestamp,
              senderName: lastMsg.sender_name ?? undefined,
              mediaType: (lastMsg.media_type as MediaType) ?? undefined,
              mediaPath: lastMsg.media_path ?? undefined,
            }
          : undefined,
      };
    });
  }

  getChatSettings(chatId: string): ChatSettings | null {
    const row = this.db.prepare(`
      SELECT chat_id, reply_mode, custom_prompt, reply_delay_min, reply_delay_max
      FROM chat_settings
      WHERE chat_id = ?
    `).get(chatId) as {
      chat_id: string;
      reply_mode: string;
      custom_prompt: string | null;
      reply_delay_min: number | null;
      reply_delay_max: number | null;
    } | undefined;

    if (!row) return null;

    return {
      chatId: row.chat_id,
      replyMode: row.reply_mode as ChatReplyMode,
      customPrompt: row.custom_prompt,
      replyDelayMin: row.reply_delay_min,
      replyDelayMax: row.reply_delay_max,
    };
  }

  updateChatSettings(chatId: string, settings: Partial<Omit<ChatSettings, 'chatId'>>): ChatSettings {
    const current = this.getChatSettings(chatId);

    const replyMode = settings.replyMode ?? current?.replyMode ?? 'default';
    const customPrompt = settings.customPrompt !== undefined ? settings.customPrompt : (current?.customPrompt ?? null);
    const delayMin = settings.replyDelayMin !== undefined ? settings.replyDelayMin : (current?.replyDelayMin ?? null);
    const delayMax = settings.replyDelayMax !== undefined ? settings.replyDelayMax : (current?.replyDelayMax ?? null);

    this.db.prepare(`
      INSERT INTO chat_settings (chat_id, reply_mode, custom_prompt, reply_delay_min, reply_delay_max)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        reply_mode = excluded.reply_mode,
        custom_prompt = excluded.custom_prompt,
        reply_delay_min = excluded.reply_delay_min,
        reply_delay_max = excluded.reply_delay_max
    `).run(chatId, replyMode, customPrompt, delayMin, delayMax);

    return {
      chatId,
      replyMode: replyMode as ChatReplyMode,
      customPrompt,
      replyDelayMin: delayMin,
      replyDelayMax: delayMax,
    };
  }

  getAllChatSettings(): ChatSettings[] {
    const rows = this.db.prepare(`
      SELECT chat_id, reply_mode, custom_prompt, reply_delay_min, reply_delay_max
      FROM chat_settings
    `).all() as Array<{
      chat_id: string;
      reply_mode: string;
      custom_prompt: string | null;
      reply_delay_min: number | null;
      reply_delay_max: number | null;
    }>;

    return rows.map((row) => ({
      chatId: row.chat_id,
      replyMode: row.reply_mode as ChatReplyMode,
      customPrompt: row.custom_prompt,
      replyDelayMin: row.reply_delay_min,
      replyDelayMax: row.reply_delay_max,
    }));
  }

  close(): void {
    this.db.close();
  }
}
