import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';

/** WhatsApp group thread id suffix. */
export function isGroupChat(chatId: string | null | undefined): boolean {
  if (!chatId) return false;
  return chatId.toLowerCase().endsWith('@g.us');
}

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
  if (incoming.isStatus) return false;
  if (SKIP_MESSAGE_TYPES.has(incoming.type)) return false;
  const hasContent = Boolean(incoming.body?.trim()) || Boolean(incoming.media);
  if (!incoming.fromMe && !hasContent) return false;
  return true;
}

/** Incoming message sent via the sender's WhatsApp broadcast list. */
export function isBroadcastListMessage(incoming: Pick<IncomingMessage, 'broadcast' | 'fromMe'>): boolean {
  return Boolean(incoming.broadcast) && !incoming.fromMe;
}

const MEDIA_MESSAGE_TYPES = new Set(['image', 'sticker', 'video', 'audio', 'ptt', 'document']);

/** Map Baileys/proto content types (e.g. imageMessage) to inbox message types (image). */
export function normalizeMessageType(type: string): string {
  switch (type) {
    case 'imageMessage':
      return 'image';
    case 'videoMessage':
      return 'video';
    case 'audioMessage':
      return 'audio';
    case 'documentMessage':
      return 'document';
    case 'stickerMessage':
      return 'sticker';
    case 'extendedTextMessage':
    case 'conversation':
      return 'chat';
    default:
      return type;
  }
}

export function isMediaMessageType(type: string): boolean {
  return MEDIA_MESSAGE_TYPES.has(normalizeMessageType(type));
}

export function defaultMimetypeForMessageType(type: string): string {
  switch (normalizeMessageType(type)) {
    case 'image':
    case 'sticker':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
    case 'ptt':
      return 'audio/ogg';
    case 'document':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

export function extensionForMimetype(mimetype: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
  };
  if (map[mimetype]) return map[mimetype];
  const sub = mimetype.split('/')[1];
  return sub?.split(';')[0] || 'bin';
}

export function formatMessagePreview(body: string | null | undefined, type: string): string {
  const text = body?.trim();
  if (text) return text.slice(0, 200);
  switch (normalizeMessageType(type)) {
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
