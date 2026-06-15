import type { TFunction } from 'i18next';
import type { Conversation } from '../services/api';
import { isGroupChat } from '../pages/inbox-helpers';
import {
  isInternalLidUserId,
  isLinkedDeviceChatId,
  looksLikePersonLabel,
} from './inbox-customer-display';

export type ConversationType =
  | 'direct_customer'
  | 'group'
  | 'broadcast'
  | 'internal'
  | 'system'
  | 'spam'
  | 'unknown';

export type ConversationTypeFilter =
  | 'all'
  | 'direct_customer'
  | 'group'
  | 'broadcast'
  | 'internal'
  | 'system'
  | 'spam';

export const CONVERSATION_TYPE_FILTERS: ConversationTypeFilter[] = [
  'all',
  'direct_customer',
  'group',
  'broadcast',
  'internal',
  'system',
  'spam',
];

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

/**
 * WhatsApp @lid threads are usually customer chats (LID privacy ids), not internal workspace.
 * Only treat as internal when there is no usable customer identity — raw lid id only.
 */
function isInternalChat(chatId: string, conversation?: Conversation): boolean {
  if (!isLinkedDeviceChatId(chatId)) return false;

  // Active @lid threads are customer chats even before display names sync from WhatsApp.
  if ((conversation?.messageCount ?? 0) > 0) return false;

  const customerName = conversation?.customerName?.trim();
  if (customerName && !isInternalLidUserId(customerName, chatId)) return false;

  const label = (conversation?.displayName ?? '').trim();
  if (label && looksLikePersonLabel(label) && !isInternalLidUserId(label, chatId)) {
    return false;
  }

  if ((conversation?.messageCount ?? 0) > 0 && label && !isInternalLidUserId(label, chatId)) {
    return false;
  }

  return !label || isInternalLidUserId(label, chatId);
}

function isDirectCustomerChat(chatId: string): boolean {
  return (
    chatId.endsWith('@c.us') ||
    chatId.endsWith('@lid') ||
    /@s\.whatsapp\.net$/i.test(chatId)
  );
}

export function inferConversationType(
  chatId: string,
  conversation?: Conversation,
): ConversationType {
  if (!chatId) return 'unknown';
  if (conversation?.outcome === 'spam' || conversation?.stage === 'spam') return 'spam';
  if (conversation?.lastInboundBroadcast) return 'broadcast';
  if (isSystemChat(chatId)) return 'system';
  if (isBroadcastChat(chatId)) return 'broadcast';
  if (isGroupChat(chatId)) return 'group';
  if (isInternalChat(chatId, conversation)) return 'internal';
  if (isDirectCustomerChat(chatId)) return 'direct_customer';
  return 'unknown';
}

export function getConversationTypeLabel(type: ConversationType, t: TFunction): string {
  return t(`inbox.chatType.${type}`);
}

export function matchesConversationTypeFilter(
  chatId: string,
  filter: ConversationTypeFilter,
  conversation?: Conversation,
): boolean {
  if (filter === 'all') return true;
  return inferConversationType(chatId, conversation) === filter;
}
