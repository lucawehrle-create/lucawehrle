import 'dotenv/config';

export interface Config {
  anthropicApiKey: string;
  claudeModel: string;
  systemPrompt: string;
  allowedChats: string[];
  blockedChats: string[];
  autoReplyEnabled: boolean;
  replyDelaySeconds: number;
  maxHistory: number;
  groupsOnlyWhenMentioned: boolean;
  logLevel: string;
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value && fallback === undefined) {
    throw new Error(`Umgebungsvariable ${key} ist nicht gesetzt`);
  }
  return value ?? fallback!;
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(): Config {
  return {
    anthropicApiKey: getEnv('ANTHROPIC_API_KEY'),
    claudeModel: getEnv('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),
    systemPrompt: getEnv(
      'SYSTEM_PROMPT',
      'Du bist ein hilfreicher Assistent, der WhatsApp-Nachrichten im Namen des Nutzers beantwortet. Antworte natürlich, freundlich und in der gleichen Sprache wie die eingehende Nachricht. Halte dich kurz und prägnant.'
    ),
    allowedChats: parseList(getEnv('ALLOWED_CHATS', '')),
    blockedChats: parseList(getEnv('BLOCKED_CHATS', '')),
    autoReplyEnabled: getEnv('AUTO_REPLY_ENABLED', 'true') === 'true',
    replyDelaySeconds: parseInt(getEnv('REPLY_DELAY_SECONDS', '3'), 10),
    maxHistory: parseInt(getEnv('MAX_HISTORY', '20'), 10),
    groupsOnlyWhenMentioned: getEnv('GROUPS_ONLY_WHEN_MENTIONED', 'true') === 'true',
    logLevel: getEnv('LOG_LEVEL', 'info'),
  };
}
