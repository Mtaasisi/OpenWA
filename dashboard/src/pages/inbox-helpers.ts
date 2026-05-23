import type { TFunction } from 'i18next';
import type { Conversation, InboxMessage } from '../services/api';

export type ConversationFilter = 'all' | 'unread' | 'needs_reply' | 'private' | 'groups' | 'resolved';

export function isGroupChat(chatId: string): boolean {
  return chatId.endsWith('@g.us');
}

export function isLinkedDeviceChat(chatId: string): boolean {
  return /@lid$/i.test(chatId);
}

export type ChatKind = 'group' | 'private';

export function getChatKind(chatId: string): ChatKind {
  if (isGroupChat(chatId)) return 'group';
  return 'private';
}

export function conversationListHasMixedChatKinds(conversations: Conversation[]): boolean {
  if (conversations.length < 2) return false;
  let hasGroup = false;
  let hasPrivate = false;
  for (const conv of conversations) {
    if (isGroupChat(conv.chatId)) hasGroup = true;
    else hasPrivate = true;
    if (hasGroup && hasPrivate) return true;
  }
  return false;
}

/** Show Direct/Group badges only when the visible list mixes both chat types. */
export function shouldShowChatKindBadge(conversations: Conversation[]): boolean {
  return conversationListHasMixedChatKinds(conversations);
}

/** Distinct accent per WhatsApp session — stable from sessionId (for list node labels). */
export const INBOX_SESSION_ACCENT_PALETTE = [
  '#128C7E',
  '#2563EB',
  '#7C3AED',
  '#C026D3',
  '#DC2626',
  '#D97706',
  '#059669',
  '#0E7490',
  '#4F46E5',
  '#BE185D',
] as const;

export function sessionAccentColor(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = (h + sessionId.charCodeAt(i)) % INBOX_SESSION_ACCENT_PALETTE.length;
  }
  return INBOX_SESSION_ACCENT_PALETTE[h];
}

function formatNumericId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return raw;
  if (digits.length > 15) {
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const ccLen = digits.length === 11 ? 1 : digits.length - 10;
  const cc = digits.slice(0, ccLen);
  const national = digits.slice(ccLen);
  const grouped = national.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return `+${cc} ${grouped}`;
}

export type ChatIdLabelOptions = {
  groupSuffix?: string;
};

/** Human-readable phone or chat id for CRM display */
export function formatChatIdLabel(chatId: string, options?: ChatIdLabelOptions): string {
  const base = chatId
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@lid$/i, '');
  const groupSuffix = options?.groupSuffix ?? '(group)';
  if (isGroupChat(chatId)) return `${formatNumericId(base)} ${groupSuffix}`;
  return formatNumericId(base);
}

export function formatChatIdLabelI18n(chatId: string, t: TFunction): string {
  return formatChatIdLabel(chatId, {
    groupSuffix: `(${t('inbox.chipGroup')})`,
  });
}

export function getConversationTitle(conv: Conversation): string {
  if (conv.customerName?.trim()) return conv.customerName.trim();
  if (conv.displayName?.trim() && conv.displayName !== conv.chatId) return conv.displayName;
  return formatChatIdLabel(conv.chatId);
}

/** Placeholders for CRM name / phone fields (avoids mixing WA display name with @lid chat IDs). */
export function getCrmFieldPlaceholders(conv: Conversation, t: TFunction): {
  namePlaceholder: string;
  phonePlaceholder: string;
} {
  const chatLabel = formatChatIdLabelI18n(conv.chatId, t);
  const display = conv.displayName?.trim();
  const linked = isLinkedDeviceChat(conv.chatId);

  let namePlaceholder: string;
  if (linked && display && display !== conv.chatId) {
    namePlaceholder = t('inbox.crm.namePlaceholderWhatsapp', { name: display });
  } else if (display && display !== conv.chatId) {
    namePlaceholder = display;
  } else {
    namePlaceholder = t('inbox.crm.customerNamePlaceholder');
  }

  const phonePlaceholder = linked
    ? t('inbox.crm.phonePlaceholderLinkedChat', { chatId: chatLabel })
    : chatLabel;

  return { namePlaceholder, phonePlaceholder };
}

/** Tactical CRM header subtitle — session, optional ERP id, display name, and chat id. */
export function getTacticalCrmSubtitle(
  conv: Conversation,
  linkedExternalId: string | null | undefined,
  t: TFunction,
): string {
  const parts: string[] = [conv.sessionName];
  if (linkedExternalId?.trim()) parts.push(linkedExternalId.trim());
  const display = conv.displayName?.trim();
  if (display && display !== conv.chatId) parts.push(display);
  parts.push(formatChatIdLabelI18n(conv.chatId, t));
  return parts.join(' · ');
}

export function avatarInitials(name: string): string {
  const digits = name.replace(/\D/g, '');
  const letterCount = (name.match(/[a-zA-Z]/g) ?? []).length;
  if (digits.length >= 4 && letterCount < 2) {
    return digits.slice(-2);
  }
  const parts = name.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]?.length >= 2) return parts[0].slice(0, 2).toUpperCase();
  if (parts[0]?.length === 1) return parts[0].toUpperCase();
  return '?';
}

export function matchesConversationFilter(conv: Conversation, filter: ConversationFilter): boolean {
  const group = isGroupChat(conv.chatId);
  if (filter === 'groups') return group;
  if (group) return false;

  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return conv.unreadCount > 0;
    case 'needs_reply':
      return conv.lastDirection === 'incoming' && !conv.resolved;
    case 'private':
      return true;
    case 'resolved':
      return conv.resolved === true;
    default:
      return true;
  }
}

export function matchesConversationSearch(conv: Conversation, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = getConversationTitle(conv).toLowerCase();
  return (
    title.includes(q) ||
    conv.displayName.toLowerCase().includes(q) ||
    conv.chatId.toLowerCase().includes(q) ||
    conv.sessionName.toLowerCase().includes(q) ||
    (conv.lastPreview?.toLowerCase().includes(q) ?? false) ||
    (conv.customerName?.toLowerCase().includes(q) ?? false) ||
    (conv.linkedExternalId?.toLowerCase().includes(q) ?? false)
  );
}

export function filterConversations(
  conversations: Conversation[],
  searchQuery: string,
  filter: ConversationFilter,
): Conversation[] {
  return conversations.filter(
    c => matchesConversationSearch(c, searchQuery) && matchesConversationFilter(c, filter),
  );
}

export type ConversationStatusChip = 'needs_reply' | 'replied' | 'group' | 'resolved' | 'follow_up';

export function conversationStatusChips(conv: Conversation): ConversationStatusChip[] {
  const chips: ConversationStatusChip[] = [];
  if (isGroupChat(conv.chatId)) chips.push('group');
  if (conv.hasFollowUp) chips.push('follow_up');
  if (conv.resolved) {
    chips.push('resolved');
    return chips;
  }
  if (conv.lastDirection === 'incoming') chips.push('needs_reply');
  else chips.push('replied');
  return chips;
}

export function conversationCrmStatusLabel(conv: Conversation, t: TFunction): string {
  if (conv.resolved) return t('inbox.chipResolved');
  if (conv.lastDirection === 'incoming') return t('inbox.chipNeedsReply');
  return t('inbox.chipReplied');
}

export const MESSAGE_COLLAPSE_LENGTH = 420;
export const INBOX_MESSAGE_PAGE_SIZE = 100;

export function messageDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toDateString();
}

export function formatMessageDateLabel(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return iso;
  if (d.toDateString() === now.toDateString()) return t('inbox.dateToday');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return t('inbox.dateYesterday');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}

export function formatMessageStatus(status: string, t: TFunction): string {
  const translated = t(`inbox.messageStatus.${status}`, { defaultValue: '' });
  return translated || status;
}

export type InboxMessageListItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: InboxMessage };

export function buildMessageListItems(messages: InboxMessage[], t: TFunction): InboxMessageListItem[] {
  const items: InboxMessageListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const dk = messageDateKey(msg.createdAt);
    if (dk !== lastDate) {
      lastDate = dk;
      items.push({
        kind: 'date',
        key: `date-${dk}`,
        label: formatMessageDateLabel(msg.createdAt, t),
      });
    }
    items.push({ kind: 'message', key: msg.id, message: msg });
  }
  return items;
}

export function createOptimisticOutgoingMessage(
  sessionId: string,
  chatId: string,
  text: string,
): InboxMessage {
  return {
    id: `pending-${Date.now()}`,
    sessionId,
    chatId,
    from: 'me',
    to: chatId,
    body: text,
    type: 'chat',
    direction: 'outgoing',
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata: { optimistic: true },
  };
}

export function createOptimisticOutgoingImageMessage(
  sessionId: string,
  chatId: string,
  caption: string,
  localPreviewUrl: string,
): InboxMessage {
  return {
    id: `pending-${Date.now()}`,
    sessionId,
    chatId,
    from: 'me',
    to: chatId,
    body: caption,
    type: 'image',
    direction: 'outgoing',
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata: { optimistic: true, localPreviewUrl },
  };
}
