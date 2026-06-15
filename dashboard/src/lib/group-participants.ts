import type { TFunction } from 'i18next';
import type { Conversation, InboxMessage } from '../services/api';
import { formatChatIdLabelI18n } from '../pages/inbox-helpers';
import {
  formatPhoneDigits,
  isLinkedDeviceChatId,
  isPlausiblePhoneDigits,
  phoneDigitsFromChatId,
  resolveCustomerPhone,
} from './inbox-customer-display';

export type GroupParticipantFromMessages = {
  id: string;
  label: string;
  phone?: string | null;
  isAdmin?: boolean;
  messageCount: number;
  lastMessageAt: string;
  lastPreview: string;
};

export function getGroupMessageSenderId(msg: InboxMessage): string | null {
  const meta = msg.metadata as { author?: string } | null | undefined;
  const author = meta?.author?.trim();
  if (author && author !== 'me' && !author.includes('@g.us')) return author;

  const from = msg.from?.trim();
  if (!from || from === 'me' || from.includes('@g.us')) return null;
  return from;
}

export function getGroupMessageSenderLabel(
  msg: InboxMessage,
  participantId: string,
  t: TFunction,
): string {
  const meta = msg.metadata as { notifyName?: string } | null | undefined;
  const notifyName = meta?.notifyName?.trim();
  if (notifyName) return notifyName;
  if (isLinkedDeviceChatId(participantId)) {
    return t('inbox.groupCrm.unnamedMember', { defaultValue: 'Group member' });
  }
  return formatChatIdLabelI18n(participantId, t);
}

/** Infer group participants from incoming message senders (no members API). */
export function extractGroupParticipantsFromMessages(
  messages: InboxMessage[],
  t: TFunction,
): GroupParticipantFromMessages[] {
  const map = new Map<
    string,
    { count: number; lastAt: string; lastPreview: string; label?: string }
  >();

  for (const msg of messages) {
    if (msg.direction !== 'incoming') continue;
    const participantId = getGroupMessageSenderId(msg);
    if (!participantId) continue;

    const preview = msg.body?.trim().slice(0, 100) || msg.type;
    const existing = map.get(participantId);
    if (!existing) {
      map.set(participantId, {
        count: 1,
        lastAt: msg.createdAt,
        lastPreview: preview,
        label: getGroupMessageSenderLabel(msg, participantId, t),
      });
      continue;
    }
    existing.count += 1;
    if (new Date(msg.createdAt).getTime() > new Date(existing.lastAt).getTime()) {
      existing.lastAt = msg.createdAt;
      existing.lastPreview = preview;
      existing.label = getGroupMessageSenderLabel(msg, participantId, t);
    }
  }

  return [...map.entries()]
    .map(([id, data]) => ({
      id,
      label: data.label ?? formatChatIdLabelI18n(id, t),
      messageCount: data.count,
      lastMessageAt: data.lastAt,
      lastPreview: data.lastPreview,
    }))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function filterGroupMessagesByMember(
  messages: InboxMessage[],
  memberId: string,
): InboxMessage[] {
  return messages.filter(msg => getGroupMessageSenderId(msg) === memberId);
}

export type GroupMemberMessageHighlight = 'active' | 'dimmed';

/** Highlight incoming bubbles from the selected member; dim others (when not filtering). */
export function resolveGroupMemberMessageHighlight(
  message: InboxMessage,
  selectedMemberId: string | null | undefined,
  filterEnabled: boolean,
): GroupMemberMessageHighlight | undefined {
  if (!selectedMemberId || filterEnabled) return undefined;
  if (message.direction !== 'incoming') return undefined;
  const senderId = getGroupMessageSenderId(message);
  if (!senderId) return undefined;
  return senderId === selectedMemberId ? 'active' : 'dimmed';
}

/** Synthetic 1:1 conversation for Customer 360 when inspecting a group member. */
export function buildGroupMemberConversation(
  conversation: Conversation | undefined,
  memberId: string,
  memberLabel: string,
  memberPhone?: string | null,
): Conversation | undefined {
  if (!conversation) return undefined;
  return {
    ...conversation,
    chatId: memberId,
    displayName: memberLabel,
    customerName: memberLabel,
    profilePicUrl: null,
    customerPhone: resolveCustomerPhone(
      memberId,
      memberPhone,
      conversation.customerPhone,
    ),
    hasUnread: false,
    unreadCount: 0,
  };
}

export function resolveGroupMemberPhone(
  memberId: string,
  participants?: GroupParticipantFromMessages[],
): string | null {
  const fromRoster = participants?.find(p => p.id === memberId)?.phone?.trim();
  if (fromRoster) return fromRoster;
  const fromChat = phoneDigitsFromChatId(memberId);
  return fromChat ? formatPhoneDigits(fromChat) : null;
}

export function resolveGroupMemberLabel(
  memberId: string,
  messages: InboxMessage[],
  t: TFunction,
  participants?: GroupParticipantFromMessages[],
): string {
  const pool = participants ?? extractGroupParticipantsFromMessages(messages, t);
  const participant = pool.find(p => p.id === memberId);
  return participant?.label ?? formatChatIdLabelI18n(memberId, t);
}

function formatParticipantPhoneLabel(number: string): string | null {
  const digits = number.replace(/\D/g, '');
  if (!isPlausiblePhoneDigits(digits)) return null;
  return formatPhoneDigits(digits);
}

function resolveParticipantPhone(id: string, apiNumber?: string): string | null {
  if (apiNumber) {
    const formatted = formatParticipantPhoneLabel(apiNumber);
    if (formatted) return formatted;
  }
  const fromChat = phoneDigitsFromChatId(id);
  return fromChat ? formatPhoneDigits(fromChat) : null;
}

/** Merge WhatsApp group roster with message-inferred activity stats. */
export function mergeGroupParticipants(
  fromMessages: GroupParticipantFromMessages[],
  fromApi: { id: string; name?: string; number: string; isAdmin?: boolean }[],
  t: TFunction,
): GroupParticipantFromMessages[] {
  const messageMap = new Map(fromMessages.map(p => [p.id, p]));
  const apiMap = new Map(fromApi.map(p => [p.id, p]));
  const allIds = new Set([...messageMap.keys(), ...apiMap.keys()]);
  const noMessagesLabel = t('inbox.groupCrm.noMessagesLoaded', { defaultValue: 'No messages loaded' });

  return [...allIds]
    .map(id => {
      const msg = messageMap.get(id);
      const api = apiMap.get(id);
      const apiName = api?.name?.trim();
      const phone = resolveParticipantPhone(id, api?.number);
      const phoneLabel = phone;
      const label =
        apiName ||
        msg?.label ||
        phoneLabel ||
        (isLinkedDeviceChatId(id)
          ? t('inbox.groupCrm.unnamedMember', { defaultValue: 'Group member' })
          : formatChatIdLabelI18n(id, t));

      return {
        id,
        label,
        phone,
        isAdmin: Boolean(api?.isAdmin),
        messageCount: msg?.messageCount ?? 0,
        lastMessageAt: msg?.lastMessageAt ?? '',
        lastPreview: msg?.lastPreview ?? noMessagesLabel,
      };
    })
    .sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.label.localeCompare(b.label);
    });
}

/** Best-effort group title from persisted message metadata (when conversation displayName is missing). */
export function extractGroupChatNameFromMessages(messages: InboxMessage[]): string | null {
  for (const msg of messages) {
    const chatName = (msg.metadata as { chatName?: string } | null | undefined)?.chatName?.trim();
    if (chatName) return chatName;
  }
  return null;
}
