import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';

/** Chats that cannot be used as normal inbox threads (status, newsletters, etc.). */
export function isInboxChat(chatId: string): boolean {
  if (!chatId) return false;
  const id = chatId.toLowerCase();
  if (id === 'status@broadcast') return false;
  if (id.includes('@broadcast')) return false;
  if (id.endsWith('@newsletter')) return false;
  return true;
}

const SKIP_MESSAGE_TYPES = new Set([
  'notification_template',
  'e2e_notification',
  'gp2',
  'protocol',
  'call_log',
  'ciphertext',
  'revoked',
  'unknown',
]);

/** Whether an inbound engine event should be stored and shown in the inbox. */
export function shouldPersistMessage(incoming: IncomingMessage): boolean {
  if (!isInboxChat(incoming.chatId)) return false;
  if (SKIP_MESSAGE_TYPES.has(incoming.type)) return false;
  const hasContent = Boolean(incoming.body?.trim()) || Boolean(incoming.media);
  if (!incoming.fromMe && !hasContent) return false;
  return true;
}

export function formatMessagePreview(body: string | null | undefined, type: string): string {
  const text = body?.trim();
  if (text) return text.slice(0, 200);
  switch (type) {
    case 'image':
      return '📷 Image';
    case 'video':
      return '🎬 Video';
    case 'audio':
    case 'ptt':
      return '🎤 Audio';
    case 'document':
      return '📎 Document';
    case 'sticker':
      return '🎭 Sticker';
    case 'location':
      return '📍 Location';
    case 'vcard':
    case 'contact_card':
      return '👤 Contact';
    default:
      return `[${type}]`;
  }
}
