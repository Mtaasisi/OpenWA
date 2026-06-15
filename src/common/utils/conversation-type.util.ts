/** Backend chat type inference (mirrors dashboard conversation-types.ts). */

export type StorageChatType =
  | 'direct_customer'
  | 'group'
  | 'broadcast'
  | 'internal'
  | 'system'
  | 'unknown';

const SYSTEM_CHAT_IDS = new Set(['status@broadcast']);

function isSystemChat(chatId: string): boolean {
  const id = chatId.toLowerCase();
  if (SYSTEM_CHAT_IDS.has(id)) return true;
  if (id.endsWith('@s.whatsapp.net')) return true;
  return false;
}

function isBroadcastChat(chatId: string): boolean {
  const id = chatId.toLowerCase();
  if (id.includes('@broadcast')) return true;
  if (id.endsWith('@newsletter')) return true;
  return false;
}

function isGroupChat(chatId: string): boolean {
  return chatId.toLowerCase().endsWith('@g.us');
}

function isLinkedDeviceChatId(chatId: string): boolean {
  return chatId.toLowerCase().endsWith('@lid');
}

function isDirectCustomerChat(chatId: string): boolean {
  return (
    chatId.endsWith('@c.us') ||
    chatId.endsWith('@lid') ||
    /@s\.whatsapp\.net$/i.test(chatId)
  );
}

/** Infer storage chat type from WhatsApp JID (no CRM context). */
export function inferStorageChatType(chatId: string): StorageChatType {
  if (!chatId) return 'unknown';
  if (isSystemChat(chatId)) return 'system';
  if (isBroadcastChat(chatId)) return 'broadcast';
  if (isGroupChat(chatId)) return 'group';
  if (isLinkedDeviceChatId(chatId)) return 'internal';
  if (isDirectCustomerChat(chatId)) return 'direct_customer';
  return 'unknown';
}

/** Map WhatsApp message type to storage media kind. */
export function messageTypeToMediaKind(
  type: string,
): 'image' | 'video' | 'document' | 'audio' | 'voice' | 'sticker' | null {
  switch (type) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'document':
      return 'document';
    case 'audio':
      return 'audio';
    case 'ptt':
      return 'voice';
    case 'sticker':
      return 'sticker';
    default:
      return null;
  }
}
