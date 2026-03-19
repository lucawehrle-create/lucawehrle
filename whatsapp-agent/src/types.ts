export type MediaType = 'image' | 'video' | 'audio' | 'sticker' | null;

export type ChatReplyMode = 'default' | 'enabled' | 'disabled' | 'proactive';

export interface ChatSettings {
  chatId: string;
  replyMode: ChatReplyMode;
  customPrompt: string | null;
  replyDelaySeconds: number | null;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  senderName?: string;
  mediaType?: MediaType;
  mediaPath?: string;
}

export interface ChatHistory {
  chatId: string;
  chatName: string;
  messages: ChatMessage[];
  isGroup: boolean;
}
