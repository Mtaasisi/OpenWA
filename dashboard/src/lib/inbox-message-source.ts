import type { InboxMessage } from '../services/api';

export function isAiAutoReplyMessage(message: InboxMessage): boolean {
  if (message.direction !== 'outgoing') return false;
  if (message.isAiGenerated) return true;
  const source = message.metadata?.source;
  return source === 'ai-auto-reply' || source === 'ai-staff-wa';
}
