import type { TFunction } from 'i18next';
import type { Conversation, Session } from '../services/api';
import { formatCustomerLabel } from './inbox-customer-display';
import { getConversationTitle } from '../pages/inbox-helpers';

export type SafetyQueueRowLike = {
  chatId: string;
  phone?: string | null;
  sessionId?: string;
};

function labelOrFallback(t: TFunction, key: string, raw: string): string {
  const translated = t(key);
  return translated === key ? raw.replace(/_/g, ' ') : translated;
}

export function formatSafetyQueueStatus(status: string, t: TFunction): string {
  return labelOrFallback(t, `whatsappSafety.labels.queueStatus.${status}`, status);
}

export function formatSafetySendSource(source: string, t: TFunction): string {
  return labelOrFallback(t, `whatsappSafety.labels.sendSource.${source}`, source);
}

export function formatSafetyRiskLevel(risk: string, t: TFunction): string {
  return labelOrFallback(t, `whatsappSafety.labels.riskLevel.${risk}`, risk);
}

export function formatSafetySessionLabel(sessionId: string, sessions: Session[]): string {
  const session = sessions.find(s => s.id === sessionId);
  const name = session?.name?.trim();
  if (name) return name;
  const phone = session?.phone?.trim();
  if (phone) return phone;
  return sessionId;
}

export function formatSafetyQueueScheduledAt(
  scheduledAt: string | null | undefined,
  t: TFunction,
): string {
  if (!scheduledAt) return '—';
  const ms = new Date(scheduledAt).getTime() - Date.now();
  if (ms <= 0) return t('whatsappSafety.queue.sendsNow');
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return t('whatsappSafety.queue.sendsInSeconds', { seconds });
  }
  const minutes = Math.ceil(seconds / 60);
  return t('whatsappSafety.queue.sendsInMinutes', { minutes });
}

export function formatSafetyQueueChatLabel(
  row: SafetyQueueRowLike,
  conversation: Conversation | undefined,
  t: TFunction,
): string {
  if (conversation) return getConversationTitle(conversation, t);
  return formatCustomerLabel(
    {
      chatId: row.chatId,
      customerPhone: row.phone,
    },
    t,
  );
}

export function safetyConversationKey(sessionId: string, chatId: string): string {
  return `${sessionId}:${chatId}`;
}

export function buildSafetyConversationMap(conversations: Conversation[]): Map<string, Conversation> {
  const map = new Map<string, Conversation>();
  for (const conv of conversations) {
    map.set(safetyConversationKey(conv.sessionId, conv.chatId), conv);
  }
  return map;
}
