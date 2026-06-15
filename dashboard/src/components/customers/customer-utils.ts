import type { TFunction } from 'i18next';
import type { FollowupConversation, PipelineCard } from '../../services/api';
import {
  formatCustomerLabel,
  formatSanitizedPhoneDisplay,
  enrichConversationIdentity,
  isLinkedDeviceChatId,
  phoneDigitsFromChatId,
  resolveCustomerPhone,
} from '../../lib/inbox-customer-display';

export function isGroupChat(card: PipelineCard): boolean {
  return card.chatId.endsWith('@g.us');
}

export function isAiEscalationPipelineCard(card: PipelineCard): boolean {
  return (
    card.stage === 'ai_escalation' ||
    card.stage === 'group_lead' ||
    card.id.startsWith('ai-esc-')
  );
}

export function isGroupLeadPipelineCard(card: PipelineCard): boolean {
  return card.stage === 'group_lead';
}

export function customerInitials(card: PipelineCard, t?: TFunction): string {
  const label = displayName(card, t?.('pipeline.unnamed') ?? '?');
  const linked = t ? t('inbox.linkedContact') : 'Linked contact';
  if (label === linked || label === (t?.('pipeline.unnamed') ?? 'Unnamed lead')) {
    const digits = phoneDigitsFromChatId(card.chatId);
    if (digits) return digits.slice(-2);
    if (isGroupChat(card)) return 'GR';
    if (isLinkedDeviceChatId(card.chatId)) return 'LC';
  }
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  const alnum = label.replace(/[^a-zA-Z0-9]/g, '');
  return (alnum.slice(0, 2) || '?').toUpperCase();
}

export function customerSubtitle(card: PipelineCard, t: TFunction): string | null {
  const name = displayName(card, t('pipeline.unnamed'));
  const phone = formatSanitizedPhoneDisplay(
    card.chatId,
    resolveCustomerPhone(card.chatId, card.customerPhone),
    t,
  );
  if (phone && phone !== name) return phone;
  if (isGroupChat(card)) return t('inbox.chipGroup');
  if (isLinkedDeviceChatId(card.chatId) && name === t('inbox.linkedContact')) {
    return t('customers.linkedDeviceHint');
  }
  if (card.customerHandle?.trim() && card.customerHandle !== name) return card.customerHandle.trim();
  return null;
}

export function lastActivityIso(card: PipelineCard): string | null {
  const customer = card.lastCustomerMessageAt ? new Date(card.lastCustomerMessageAt).getTime() : 0;
  const staff = card.lastStaffMessageAt ? new Date(card.lastStaffMessageAt).getTime() : 0;
  const latest = Math.max(customer, staff);
  if (!latest) return null;
  return new Date(latest).toISOString();
}

export function fmtActivity(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function displayName(card: PipelineCard, fallback: string, t?: TFunction): string {
  if (card.chatId && card.sessionId !== 'manual') {
    const label = formatCustomerLabel(
      {
        chatId: card.chatId,
        customerName: card.customerName,
        customerPhone: card.customerPhone,
        displayName: card.customerHandle,
      },
      t,
    );
    if (label && label !== card.chatId) return label;
  }
  return card.customerName || card.customerHandle || card.customerPhone || fallback;
}

export function inboxDeepLink(
  sessionId: string,
  chatId: string,
  groupMemberId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set('session', sessionId);
  params.set('chat', chatId);
  if (groupMemberId?.trim()) params.set('member', groupMemberId.trim());
  return `/inbox?${params.toString()}`;
}

export function inboxLink(card: PipelineCard): string | null {
  if (card.isManual || card.sessionId === 'manual') return null;
  return inboxDeepLink(card.sessionId, card.chatId);
}

export function pipelineDeepLink(sessionId: string, chatId: string): string {
  return `/pipeline?session=${encodeURIComponent(sessionId)}&chat=${encodeURIComponent(chatId)}`;
}

/** Minimal pipeline card for opening lead detail from inbox thread context. */
export function followupConversationToPipelineCard(conv: FollowupConversation): PipelineCard {
  const enriched = enrichConversationIdentity(conv);
  return {
    id: conv.id,
    sessionId: conv.sessionId,
    chatId: conv.chatId,
    customerName: enriched.customerName,
    customerPhone: enriched.customerPhone,
    customerHandle: conv.customerHandle ?? null,
    source: conv.source,
    channel: conv.channel ?? null,
    stage: conv.stage,
    productInterest: conv.productInterest,
    priority: conv.priority ?? 'normal',
    budget: conv.budget,
    lastCustomerMessageAt: conv.lastCustomerMessageAt,
    lastStaffMessageAt: conv.lastStaffMessageAt,
    nextFollowupAt: conv.nextFollowupAt,
    nextAction: conv.nextAction ?? null,
    assignedStaffId: conv.assignedStaffId,
    assignedStaffName: null,
    isManual: conv.isManual ?? false,
    linkedSaleId: conv.linkedSaleId,
    responseTimeSeconds: conv.responseTimeSeconds ?? null,
    customerId: conv.customerId ?? null,
  };
}
