export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  senderName?: string;
}

export interface ChatHistory {
  chatId: string;
  chatName: string;
  messages: ChatMessage[];
  isGroup: boolean;
}
