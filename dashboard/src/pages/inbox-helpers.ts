import type { TFunction } from 'i18next';
import type { Conversation, InboxConversationsQuery, InboxMessage, InboxThreadEventRow } from '../services/api';
import {
  formatCustomerLabel,
  formatPhoneDigits,
  enrichConversationIdentity,
  isInternalLidUserId,
  isLinkedDeviceChatId,
  looksLikePersonLabel,
  resolveCustomerPhone,
  resolveCustomerProfileIdentity,
  whatsappChatLocalId,
} from '../lib/inbox-customer-display';
import { inferConversationType } from '../lib/conversation-types';
import { getInboxStaffId } from '../lib/inbox-staff-identity';
import { isMediaMessageType, normalizeMessageType } from './inbox-media';

export type ConversationFilter =
  | 'all'
  | 'unread'
  | 'open'
  | 'needs_reply'
  | 'needs_human'
  | 'ai_opt_out'
  | 'private'
  | 'groups'
  | 'resolved'
  | 'overdue'
  | 'ai_active'
  | 'assigned_to_me'
  | 'my_work'
  | 'hot_leads'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'followup_due'
  | 'unassigned'
  | 'failed_sends';

export const INBOX_CONVERSATION_FILTERS: ConversationFilter[] = [
  'all',
  'my_work',
  'needs_reply',
  'needs_human',
  'hot_leads',
  'waiting_payment',
  'waiting_stock',
  'followup_due',
  'unassigned',
  'assigned_to_me',
  'unread',
  'ai_opt_out',
  'private',
  'groups',
  'resolved',
  'failed_sends',
];

export function isGroupChat(chatId: string): boolean {
  return chatId.endsWith('@g.us');
}

export function isLinkedDeviceChat(chatId: string): boolean {
  return isLinkedDeviceChatId(chatId);
}

export type ChatKind = 'group' | 'private';

export function getChatKind(chatId: string): ChatKind {
  if (isGroupChat(chatId)) return 'group';
  return 'private';
}

/** Whether product send/post is allowed for this inbox chat (aligned with backend isInboxChat). */
export type ProductSendEligibility = 'direct' | 'group' | 'blocked';

export function getProductSendEligibility(chatId: string): ProductSendEligibility {
  const id = chatId?.trim().toLowerCase() ?? '';
  if (!id || id === 'status@broadcast' || id.includes('@broadcast') || id.endsWith('@newsletter')) {
    return 'blocked';
  }
  if (isGroupChat(chatId)) return 'group';
  return 'direct';
}

/** Relative time for Interakt system pill (e.g. "7 minutes ago") */
export function formatInteraktRelativeTime(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const now = Date.now();
  if (Number.isNaN(d.getTime())) return t('inbox.interakt.chatOpenedRecent');
  const diffMs = Math.max(0, now - d.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('inbox.interakt.timeJustNow');
  if (minutes < 60) return t('inbox.interakt.timeMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('inbox.interakt.timeHoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 14) return t('inbox.interakt.timeDaysAgo', { count: days });
  return formatMessageTime(iso);
}

/** Label for Interakt system pill — CRM firstMessageAt, else first incoming message */
export function getInteraktChatOpenedWhen(
  messages: InboxMessage[],
  t: TFunction,
  firstMessageAt?: string | null,
): string {
  const firstIncoming = messages.find(m => m.direction === 'incoming');
  const iso = firstMessageAt ?? firstIncoming?.createdAt ?? messages[0]?.createdAt;
  if (!iso) return t('inbox.interakt.chatOpenedRecent');
  return formatInteraktRelativeTime(iso, t);
}

const PRODUCT_MESSAGE_TITLE_RE = /^📦\s*\*([^*]+)\*/;

/** Names from outgoing catalog messages (📦 *Product* first line). */
export function extractProductNamesFromMessages(messages: InboxMessage[], limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.direction !== 'outgoing') continue;
    const firstLine = m.body?.split('\n')[0]?.trim() ?? '';
    const match = firstLine.match(PRODUCT_MESSAGE_TITLE_RE);
    const name = match?.[1]?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

/** Insert text at the composer caret (or append). */
export function insertComposerText(
  current: string,
  snippet: string,
  selectionStart?: number | null,
  selectionEnd?: number | null,
): { value: string; cursor: number } {
  const start = selectionStart ?? current.length;
  const end = selectionEnd ?? start;
  const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
  return { value: next, cursor: start + snippet.length };
}

/** Product labels for Interakt CRM “Recent products” (interest + quotes + sent catalog). */
export function collectInteraktRecentProductLabels(
  productInterest: string | null | undefined,
  quotes: { updatedAt: string; items: { itemName: string }[] }[],
  messageProductNames: string[] = [],
  limit = 4,
): string[] {
  return collectInteraktRecentProducts(productInterest, quotes, messageProductNames, limit).map(p => p.name);
}

export interface InteraktRecentProduct {
  name: string;
  priceLabel?: string;
}

export function formatInteraktProductPrice(amount: number, currency?: string | null): string {
  const cur = currency?.trim() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Recent products with optional price from quotes. */
export function collectInteraktRecentProducts(
  productInterest: string | null | undefined,
  quotes: { updatedAt: string; currency?: string | null; items: { itemName: string; unitPrice?: number }[] }[],
  messageProductNames: string[] = [],
  limit = 4,
): InteraktRecentProduct[] {
  const priceByName = new Map<string, { amount: number; currency?: string | null }>();
  const sorted = [...quotes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  for (const quote of sorted) {
    for (const item of quote.items ?? []) {
      const key = item.itemName.trim().toLowerCase();
      if (!key || priceByName.has(key)) continue;
      if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
        priceByName.set(key, { amount: item.unitPrice, currency: quote.currency });
      }
    }
  }

  const seen = new Set<string>();
  const out: InteraktRecentProduct[] = [];
  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const price = priceByName.get(key);
    out.push({
      name: n,
      priceLabel: price ? formatInteraktProductPrice(price.amount, price.currency) : undefined,
    });
  };
  if (productInterest?.trim()) add(productInterest);
  for (const name of messageProductNames) add(name);
  for (const quote of sorted) {
    for (const item of quote.items ?? []) add(item.itemName);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Pick the best default thread when opening Interakt inbox (unread open chat first). */
export function pickDefaultInteraktThread(
  conversations: Conversation[],
): { sessionId: string; chatId: string } | null {
  if (conversations.length === 0) return null;
  const open = conversations.filter(c => !c.resolved);
  const pool = open.length > 0 ? open : conversations;
  const unread = pool.find(c => c.hasUnread || (c.unreadCount ?? 0) > 0);
  const conv = unread ?? pool[0];
  if (!conv) return null;
  return { sessionId: conv.sessionId, chatId: conv.chatId };
}

/** Two-letter initials for Interakt-style message avatars (matches list avatars). */
export function getContactInitials(title: string): string {
  return avatarInitials(title);
}

/** Header title + subtitle for Interakt chat chrome. */
export function getInteraktHeaderIdentity(
  conv: Conversation,
  t: TFunction,
  options?: { showSessionLabel?: boolean },
): { title: string; subtitle: string | null } {
  const showSessionLabel = options?.showSessionLabel !== false;

  if (isGroupChat(conv.chatId)) {
    return {
      title: getConversationTitle(conv, t),
      subtitle: null,
    };
  }

  const identity = resolveCustomerProfileIdentity(
    {
      chatId: conv.chatId,
      crmName: conv.customerName,
      crmPhone: conv.customerPhone,
      conversationName: conv.customerName,
      conversationPhone: conv.customerPhone,
      conversationDisplayName: conv.displayName,
    },
    t,
  );

  return {
    title: identity.name,
    subtitle:
      identity.phone ??
      (showSessionLabel ? conv.sessionName : null),
  };
}

/** Formatted customer phone for the chat header when the title is a name (not the number itself). */
export function getInteraktContactPhoneLine(conv: Conversation): string | null {
  if (isGroupChat(conv.chatId)) return null;
  return resolveCustomerProfileIdentity(
    {
      chatId: conv.chatId,
      crmName: conv.customerName,
      crmPhone: conv.customerPhone,
      conversationName: conv.customerName,
      conversationPhone: conv.customerPhone,
      conversationDisplayName: conv.displayName,
    },
  ).phone;
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

/** Show per-conversation session badges only when more than one WhatsApp account is connected. */
export function shouldShowSessionLabel(
  sessions: ReadonlyArray<{ status: string }>,
): boolean {
  return sessions.filter((s) => s.status === 'ready').length > 1;
}

export function sessionAccentColor(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = (h + sessionId.charCodeAt(i)) % INBOX_SESSION_ACCENT_PALETTE.length;
  }
  return INBOX_SESSION_ACCENT_PALETTE[h];
}

function formatNumericId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return formatPhoneDigits(digits);
}

export type ChatIdLabelOptions = {
  groupSuffix?: string;
  linkedFallback?: string;
};

/** Human-readable phone or chat id for CRM display */
export function formatChatIdLabel(chatId: string, options?: ChatIdLabelOptions): string {
  const linkedFallback = options?.linkedFallback;
  if (isLinkedDeviceChat(chatId)) {
    return linkedFallback ?? 'Linked contact';
  }
  const base = whatsappChatLocalId(chatId);
  const groupSuffix = options?.groupSuffix ?? '(group)';
  if (isGroupChat(chatId)) {
    const id = formatNumericId(base);
    if (groupSuffix === '') return id;
    return `${id} ${groupSuffix}`;
  }
  return formatNumericId(base);
}

export function formatChatIdLabelI18n(chatId: string, t: TFunction): string {
  return formatChatIdLabel(chatId, {
    groupSuffix: isGroupChat(chatId) ? '' : undefined,
    linkedFallback: t('inbox.linkedContact'),
  });
}

export function getConversationTitle(conv: Conversation, t?: TFunction): string {
  const enriched = enrichConversationIdentity(conv);
  return formatCustomerLabel(
    {
      chatId: conv.chatId,
      customerName: enriched.customerName,
      customerPhone: enriched.customerPhone,
      displayName: conv.displayName,
    },
    t,
  );
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
  if (
    linked &&
    display &&
    display !== conv.chatId &&
    !isInternalLidUserId(display, conv.chatId) &&
    looksLikePersonLabel(display)
  ) {
    namePlaceholder = t('inbox.crm.namePlaceholderWhatsapp', { name: display });
  } else if (display && display !== conv.chatId && !isInternalLidUserId(display, conv.chatId)) {
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
  if (
    display &&
    display !== conv.chatId &&
    !isInternalLidUserId(display, conv.chatId) &&
    looksLikePersonLabel(display)
  ) {
    parts.push(display);
  }
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

/** Filters that never include WhatsApp group threads. */
export function inboxFilterExcludesGroups(filter: ConversationFilter): boolean {
  return filter === 'unread' || filter === 'private';
}

export function matchesConversationFilter(
  conv: Conversation,
  filter: ConversationFilter,
  options?: { myStaffId?: string | null },
): boolean {
  const group = isGroupChat(conv.chatId);
  if (filter === 'groups') return group;
  if (group && inboxFilterExcludesGroups(filter)) return false;
  if (group && filter !== 'all') return false;

  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !group && conv.unreadCount > 0;
    case 'open':
      return !conv.resolved;
    case 'needs_reply':
      if (conv.needsReply === true) return true;
      return conv.lastDirection === 'incoming' && !conv.resolved;
    case 'needs_human':
      if (conv.needsHuman != null) return conv.needsHuman;
      return conv.aiHandlingState === 'waiting_human' || conv.aiHandlingState === 'human_handling';
    case 'ai_opt_out':
      return conv.aiOptOut === true;
    case 'ai_active':
      return (
        !conv.aiOptOut &&
        !conv.aiAutoReplyPaused &&
        (conv.aiHandlingState === 'ai_handling' || conv.aiHandlingState === 'idle')
      );
    case 'overdue': {
      if (conv.followupOverdue) return true;
      if (conv.resolved) return false;
      const dueIso = conv.nextFollowupAt ?? conv.followUpAt;
      if (!dueIso) return false;
      const due = new Date(dueIso);
      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    }
    case 'assigned_to_me': {
      const myStaffId = options?.myStaffId?.trim();
      if (!myStaffId || !conv.assignedStaffId) return false;
      return conv.assignedStaffId === myStaffId;
    }
    case 'private': {
      if (group) return false;
      const chatType = inferConversationType(conv.chatId, conv);
      return chatType !== 'broadcast' && chatType !== 'system';
    }
    case 'resolved':
      return conv.resolved === true || conv.threadState === 'resolved';
    case 'my_work': {
      const myStaffId = options?.myStaffId?.trim();
      if (!myStaffId || conv.assignedStaffId !== myStaffId) return false;
      return conv.threadState !== 'resolved' && conv.threadState !== 'waiting_customer';
    }
    case 'hot_leads':
      return conv.threadState === 'hot_lead' || conv.hotLead === true;
    case 'waiting_payment':
      return conv.threadState === 'waiting_payment';
    case 'waiting_stock':
      return conv.threadState === 'waiting_stock';
    case 'followup_due':
      return (
        conv.threadState === 'followup_scheduled' ||
        conv.threadState === 'followup_overdue' ||
        conv.followupDue === true ||
        conv.followupOverdue === true
      );
    case 'unassigned':
      return !conv.assignedStaffId || conv.threadState === 'unassigned';
    case 'failed_sends':
      return conv.threadState === 'send_failed' || conv.threadState === 'queued_message_pending';
    default:
      return true;
  }
}

export function matchesConversationSearch(conv: Conversation, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const enriched = enrichConversationIdentity(conv);
  const title = getConversationTitle(conv, undefined).toLowerCase();
  const phone = resolveCustomerPhone(conv.chatId, enriched.customerPhone)?.toLowerCase() ?? '';
  return (
    title.includes(q) ||
    phone.includes(q) ||
    (conv.displayName?.toLowerCase().includes(q) ?? false) ||
    conv.chatId.toLowerCase().includes(q) ||
    (conv.sessionName?.toLowerCase().includes(q) ?? false) ||
    (conv.lastPreview?.toLowerCase().includes(q) ?? false) ||
    (enriched.customerName?.toLowerCase().includes(q) ?? false) ||
    (conv.linkedExternalId?.toLowerCase().includes(q) ?? false)
  );
}

export function buildUnifiedInboxQuery(params: {
  sessionId?: string;
  searchQuery: string;
  activeFilter: ConversationFilter;
  conversationSort: InboxConversationSort;
  leadSourceFilter?: string;
  activeChatTypeFilter?: import('../lib/conversation-types').ConversationTypeFilter;
  limit?: number;
  offset?: number;
  cursor?: string;
  includeCounts?: boolean;
  activeSinceDays?: number;
  excludeColdResolved?: boolean;
  coldResolvedDays?: number;
}): InboxConversationsQuery {
  const query: InboxConversationsQuery = {
    sessionId: params.sessionId,
    search: params.searchQuery.trim() || undefined,
    sort: params.conversationSort,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    cursor: params.cursor,
    includeCounts: params.includeCounts ?? false,
    activeSinceDays: params.activeSinceDays,
    excludeColdResolved: params.excludeColdResolved,
    coldResolvedDays: params.coldResolvedDays,
  };

  // Work-queue tabs are filtered client-side so the list stays visible when thread
  // state (e.g. disconnected session, group_lead_only) disagrees with SQL queue hints.

  if (params.leadSourceFilter?.trim()) {
    query.leadSource = params.leadSourceFilter.trim();
  }
  if (params.activeChatTypeFilter && params.activeChatTypeFilter !== 'all') {
    query.conversationType = params.activeChatTypeFilter;
  }

  switch (params.activeFilter) {
    case 'unread':
      query.unread = true;
      if (!params.activeChatTypeFilter || params.activeChatTypeFilter === 'all') {
        query.conversationType = 'direct_customer';
      }
      break;
    case 'open':
      query.status = 'open';
      break;
    case 'resolved':
      query.status = 'resolved';
      break;
    case 'overdue':
      query.overdueFollowup = true;
      break;
    case 'assigned_to_me':
      query.assignedToMe = true;
      break;
    case 'needs_human':
      query.aiStatus = 'waiting_human';
      break;
    default:
      break;
  }

  if (params.activeFilter === 'my_work' || params.activeFilter === 'assigned_to_me') {
    const staffId = getInboxStaffId();
    if (staffId) {
      query.assignedStaffId = staffId;
    }
  }

  return query;
}

export function filterConversations(
  conversations: Conversation[],
  searchQuery: string,
  filter: ConversationFilter,
  options?: { myStaffId?: string | null },
): Conversation[] {
  return conversations.filter(
    c =>
      matchesConversationSearch(c, searchQuery) &&
      matchesConversationFilter(c, filter, options),
  );
}

/** Next conversation matching a triage predicate (wraps list). */
export function findNextTriageConversation(
  conversations: Conversation[],
  current: { sessionId: string; chatId: string } | null,
  predicate: (conv: Conversation) => boolean,
): Conversation | null {
  if (conversations.length === 0) return null;
  const currentIdx = current
    ? conversations.findIndex(c => c.sessionId === current.sessionId && c.chatId === current.chatId)
    : -1;
  for (let step = 1; step <= conversations.length; step++) {
    const idx = currentIdx < 0 ? step - 1 : (currentIdx + step) % conversations.length;
    const conv = conversations[idx];
    if (conv && predicate(conv)) return conv;
  }
  return null;
}

export function scrollConversationIntoView(sessionId: string, chatId: string): void {
  const key = `${sessionId}:${chatId}`;
  window.requestAnimationFrame(() => {
    const el = document.querySelector(
      `[data-conversation-key="${CSS.escape(key)}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  });
}

/** Count conversations matching a filter (respects search query). */
export function countConversationsForFilter(
  conversations: Conversation[],
  searchQuery: string,
  filter: ConversationFilter,
  options?: { myStaffId?: string | null },
): number {
  return filterConversations(conversations, searchQuery, filter, options).length;
}

export type ConversationStatusChip =
  | 'needs_reply'
  | 'replied'
  | 'group'
  | 'resolved'
  | 'follow_up'
  | 'autopilot_paused';

export type ConversationListCrmBadge = {
  key: string;
  label: string;
  tone: 'stage' | 'assignee' | 'overdue' | 'priority';
};

export function formatPipelineStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function pipelineStageLabelShort(stage: string, t: TFunction): string {
  return t(`followups.stageLabelsShort.${stage}`, {
    defaultValue: t(`followups.stageLabels.${stage}`, {
      defaultValue: formatPipelineStageLabel(stage),
    }),
  });
}

export function pipelineStageLabelFull(stage: string, t: TFunction): string {
  return t(`followups.stageLabels.${stage}`, {
    defaultValue: formatPipelineStageLabel(stage),
  });
}

function isAutomatedStaffLabel(name: string): boolean {
  const norm = name.trim().toLowerCase();
  return /\b(api\s*)?key\b/.test(norm) || /^default\s+admin/.test(norm);
}

export function conversationListCrmBadges(
  conv: Conversation,
  t: TFunction,
  options?: { listRow?: boolean },
): ConversationListCrmBadge[] {
  const badges: ConversationListCrmBadge[] = [];
  const listRow = options?.listRow === true;

  if (conv.followupOverdue) {
    badges.push({ key: 'overdue', label: t('inbox.badgeOverdue'), tone: 'overdue' });
  }

  if (conv.aiHandlingState === 'waiting_human') {
    badges.push({ key: 'ai-escalated', label: t('inbox.badgeAiEscalated'), tone: 'overdue' });
  }

  if (!listRow) {
    if (conv.assignedStaffName && !isAutomatedStaffLabel(conv.assignedStaffName)) {
      badges.push({ key: 'assignee', label: conv.assignedStaffName, tone: 'assignee' });
    } else if (conv.assignedStaffId) {
      badges.push({ key: 'assignee', label: t('inbox.badgeAssigned'), tone: 'assignee' });
    }
    if (conv.priority && conv.priority !== 'normal') {
      badges.push({
        key: 'priority',
        label: formatPipelineStageLabel(conv.priority),
        tone: 'priority',
      });
    }
  }

  return badges;
}

const LIST_IMAGE_MESSAGE_TYPES = new Set(['image', 'sticker', 'imageMessage', 'stickerMessage']);

const GENERIC_MEDIA_PREVIEW_LABELS = new Set([
  '📷 Image',
  '🎭 Sticker',
  '🎬 Video',
  '🎤 Audio',
  '📎 Document',
  '📍 Location',
  '👤 Contact',
]);

const GENERIC_PREVIEW_TO_TYPE: Record<string, string> = {
  '📷 Image': 'image',
  '🎭 Sticker': 'sticker',
  '🎬 Video': 'video',
  '🎤 Audio': 'audio',
  '📎 Document': 'document',
  '📍 Location': 'location',
  '👤 Contact': 'contact',
  '[imageMessage]': 'image',
  '[videoMessage]': 'video',
  '[audioMessage]': 'audio',
  '[documentMessage]': 'document',
  '[stickerMessage]': 'sticker',
};

function inferTypeFromStoredPreview(raw: string): string | undefined {
  if (GENERIC_PREVIEW_TO_TYPE[raw]) return GENERIC_PREVIEW_TO_TYPE[raw];
  const bracket = /^\[(.+)\]$/.exec(raw);
  if (!bracket) return undefined;
  const normalized = normalizeMessageType(bracket[1]);
  return isMediaMessageType(normalized) ? normalized : undefined;
}

export type ConversationListPreviewIcon =
  | 'image'
  | 'sticker'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'contact';

export type ConversationListPreview =
  | { kind: 'text'; text: string }
  | { kind: 'media'; icon: ConversationListPreviewIcon; text: string };

function mediaIconForType(type: string): ConversationListPreviewIcon {
  switch (type) {
    case 'sticker':
      return 'sticker';
    case 'video':
      return 'video';
    case 'audio':
    case 'ptt':
      return 'audio';
    case 'document':
      return 'document';
    case 'location':
      return 'location';
    case 'vcard':
    case 'contact_card':
      return 'contact';
    default:
      return 'image';
  }
}

function defaultMediaPreviewLabel(type: string, t: TFunction): string {
  switch (type) {
    case 'sticker':
      return t('inbox.previewSticker', { defaultValue: 'Sticker' });
    case 'video':
      return t('inbox.previewVideo', { defaultValue: 'Video' });
    case 'audio':
    case 'ptt':
      return t('inbox.previewAudio', { defaultValue: 'Audio' });
    case 'document':
      return t('inbox.previewDocument', { defaultValue: 'Document' });
    case 'location':
      return t('inbox.previewLocation', { defaultValue: 'Location' });
    case 'vcard':
    case 'contact_card':
      return t('inbox.previewContact', { defaultValue: 'Contact' });
    default:
      return t('inbox.previewPhoto', { defaultValue: 'Photo' });
  }
}

/** WhatsApp-style list preview: icon + label/caption, no inline thumbnail fetch. */
export function getConversationListPreview(conv: Conversation, t: TFunction): ConversationListPreview {
  const raw = conv.lastPreview?.trim() ?? '';
  const inferredType =
    (conv.lastMessageType ? normalizeMessageType(conv.lastMessageType) : undefined) ??
    inferTypeFromStoredPreview(raw) ??
    (raw ? GENERIC_PREVIEW_TO_TYPE[raw] : undefined) ??
    'chat';

  const mediaTypes = new Set([
    'image',
    'sticker',
    'video',
    'audio',
    'ptt',
    'document',
    'location',
    'vcard',
    'contact_card',
  ]);

  const isGenericMediaLabel = GENERIC_MEDIA_PREVIEW_LABELS.has(raw) || Boolean(inferTypeFromStoredPreview(raw));

  if (mediaTypes.has(inferredType) || isGenericMediaLabel) {
    const icon = mediaIconForType(inferredType);
    const text =
      raw && !isGenericMediaLabel ? raw : defaultMediaPreviewLabel(inferredType, t);
    return { kind: 'media', icon, text };
  }

  return { kind: 'text', text: raw || t('inbox.noPreview') };
}

/** @deprecated Use getConversationListPreview — list rows no longer fetch media thumbnails. */
export function conversationListShowsMediaThumb(conv: Conversation): boolean {
  if (!conv.lastMessageId) return false;
  if (conv.lastMessageType && LIST_IMAGE_MESSAGE_TYPES.has(normalizeMessageType(conv.lastMessageType))) {
    return true;
  }
  const preview = conv.lastPreview?.trim() ?? '';
  return preview === '📷 Image' || preview === '🎭 Sticker' || inferTypeFromStoredPreview(preview) === 'image';
}

export function conversationStatusChips(conv: Conversation): ConversationStatusChip[] {
  const chips: ConversationStatusChip[] = [];
  if (isGroupChat(conv.chatId)) chips.push('group');
  if (conv.followupAutopilotPaused) chips.push('autopilot_paused');
  if (conv.hasFollowUp) chips.push('follow_up');
  if (conv.resolved) {
    chips.push('resolved');
    return chips;
  }
  if (conv.lastDirection === 'incoming') chips.push('needs_reply');
  else chips.push('replied');
  return chips;
}

/** Stitch list row pill: Awaiting for inbound waiting on agent; New for other unread. */
export function stitchListRowPill(conv: Conversation): 'new' | 'awaiting' | null {
  if (conv.resolved) return null;

  if (conv.lastDirection === 'incoming') {
    if (conv.needsHuman === false) {
      return conv.hasUnread || conv.unreadCount > 0 ? 'new' : null;
    }
    return 'awaiting';
  }

  if (conv.needsHuman === true) return 'awaiting';
  if (conv.aiHandlingState === 'waiting_human' || conv.aiHandlingState === 'human_handling') {
    return 'awaiting';
  }

  if (conv.hasUnread || conv.unreadCount > 0) return 'new';
  return null;
}

export function stitchListPreviewYouPrefix(conv: Conversation, t: TFunction): string | null {
  if (conv.lastDirection !== 'outgoing') return null;
  return t('inbox.stitch.previewYouPrefix', { defaultValue: 'You:' });
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

/** Interakt bubble footer: "07 Dec, 02:12 pm" */
export function formatInteraktBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const timePart = d
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/\s/g, ' ')
    .toLowerCase();
  return `${datePart}, ${timePart}`;
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}

export type InboxConversationSort = 'newest' | 'oldest';

export function sortConversationsByLastMessage<T extends { lastMessageAt: string }>(
  list: T[],
  order: InboxConversationSort,
): T[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.lastMessageAt).getTime() || 0;
    const tb = new Date(b.lastMessageAt).getTime() || 0;
    return order === 'newest' ? tb - ta : ta - tb;
  });
}

export function sortConversationsWithPinned<T extends { lastMessageAt: string; sessionId: string; chatId: string }>(
  list: T[],
  order: InboxConversationSort,
  isPinned: (item: T) => boolean,
): T[] {
  const sorted = sortConversationsByLastMessage(list, order);
  const pinned = sorted.filter(isPinned);
  const rest = sorted.filter(item => !isPinned(item));
  return [...pinned, ...rest];
}

/** Short timestamp for Interakt chat list rows (e.g. "2 min", "5/20/2026") */
export function formatConversationListTime(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return '';

  if (d.toDateString() === now.toDateString()) {
    const minutes = Math.floor(Math.max(0, now.getTime() - d.getTime()) / 60_000);
    if (minutes < 1) return t('inbox.interakt.timeListNow');
    if (minutes < 60) return t('inbox.interakt.timeListMinutes', { count: minutes });
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return t('inbox.dateYesterday');
  }

  return d.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatMessageStatus(status: string, t: TFunction): string {
  const translated = t(`inbox.messageStatus.${status}`, { defaultValue: '' });
  return translated || status;
}

export type InboxMessageListItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: InboxMessage; stackCompact?: boolean; stackContinues?: boolean }
  | { kind: 'album'; key: string; messages: InboxMessage[]; stackCompact?: boolean; stackContinues?: boolean }
  | { kind: 'thread_event'; key: string; event: InboxThreadEventRow };

const ALBUM_MAX_GAP_MS = 4000;
const ALBUM_MAX_IMAGES = 10;

function isAlbumImageMessage(message: InboxMessage): boolean {
  return (
    message.type === 'image' ||
    message.type === 'sticker' ||
    message.type === 'imageMessage' ||
    message.type === 'stickerMessage'
  );
}

function messageTimeMs(message: InboxMessage): number {
  if (message.timestamp != null) return message.timestamp * 1000;
  const parsed = Date.parse(message.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function canGroupInAlbum(previous: InboxMessage, next: InboxMessage): boolean {
  if (previous.direction !== next.direction) return false;
  if (previous.from !== next.from) return false;
  if (!isAlbumImageMessage(previous) || !isAlbumImageMessage(next)) return false;
  if (Math.abs(messageTimeMs(next) - messageTimeMs(previous)) > ALBUM_MAX_GAP_MS) {
    return false;
  }

  const prevBody = previous.body?.trim() ?? '';
  const nextBody = next.body?.trim() ?? '';

  // Real WhatsApp albums put the caption on the last image; earlier slots are usually blank.
  // Separate product posts sent seconds apart each carry their own caption — don't merge them.
  if (prevBody && nextBody && prevBody !== nextBody) {
    return false;
  }

  return true;
}

function canStackMessageCompact(previous: InboxMessage, next: InboxMessage): boolean {
  if (previous.direction !== next.direction) return false;
  if (next.direction === 'outgoing') return true;
  return previous.from === next.from;
}

function messageListItemLeadMessage(
  item: Extract<InboxMessageListItem, { kind: 'message' | 'album' }>,
): InboxMessage {
  return item.kind === 'message' ? item.message : item.messages[0];
}

function messageListItemTailMessage(
  item: Extract<InboxMessageListItem, { kind: 'message' | 'album' }>,
): InboxMessage {
  return item.kind === 'message' ? item.message : item.messages[item.messages.length - 1];
}

function nextMessageListItem(
  items: InboxMessageListItem[],
  startIndex: number,
): Extract<InboxMessageListItem, { kind: 'message' | 'album' }> | null {
  for (let i = startIndex; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === 'message' || item.kind === 'album') {
      return item;
    }
  }
  return null;
}

/** Mark middle bubbles in a sender group so timestamps and tail radii match WhatsApp. */
function applyMessageStackGroups(items: InboxMessageListItem[]): InboxMessageListItem[] {
  return items.map((item, index) => {
    if (item.kind !== 'message' && item.kind !== 'album') return item;
    const next = nextMessageListItem(items, index + 1);
    const stackContinues =
      next != null && canStackMessageCompact(messageListItemTailMessage(item), messageListItemLeadMessage(next));
    if (!stackContinues) return item;
    return { ...item, stackContinues: true };
  });
}

function lastMessageItem(
  items: InboxMessageListItem[],
): { kind: 'message'; message: InboxMessage } | { kind: 'album'; messages: InboxMessage[] } | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.kind === 'date' || item.kind === 'thread_event') continue;
    return item;
  }
  return null;
}

function stackCompareMessage(
  item: { kind: 'message'; message: InboxMessage } | { kind: 'album'; messages: InboxMessage[] },
): InboxMessage {
  return item.kind === 'message' ? item.message : item.messages[item.messages.length - 1];
}

function eventTimeMs(event: InboxThreadEventRow): number {
  const parsed = Date.parse(event.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function eventDateKey(iso: string): string {
  return messageDateKey(iso);
}

function pushDateSeparatorForTimestamp(
  items: InboxMessageListItem[],
  atIso: string,
  t: TFunction,
  lastDate: { value: string },
): void {
  const dk = eventDateKey(atIso);
  if (dk !== lastDate.value) {
    lastDate.value = dk;
    items.push({
      kind: 'date',
      key: `date-${dk}`,
      label: formatMessageDateLabel(atIso, t),
    });
  }
}

export function buildMessageListItems(
  messages: InboxMessage[],
  t: TFunction,
  threadEvents: InboxThreadEventRow[] = [],
): InboxMessageListItem[] {
  if (threadEvents.length === 0) {
    return applyMessageStackGroups(buildMessageListItemsFromMessages(messages, t));
  }

  type StreamEntry =
    | { kind: 'message'; at: number; message: InboxMessage }
    | { kind: 'event'; at: number; event: InboxThreadEventRow };

  const stream: StreamEntry[] = [
    ...messages.map(message => ({ kind: 'message' as const, at: messageTimeMs(message), message })),
    ...threadEvents.map(event => ({ kind: 'event' as const, at: eventTimeMs(event), event })),
  ].sort((a, b) => a.at - b.at);

  const items: InboxMessageListItem[] = [];
  const lastDate = { value: '' };
  let index = 0;

  while (index < stream.length) {
    const entry = stream[index];
    if (entry.kind === 'event') {
      pushDateSeparatorForTimestamp(items, entry.event.createdAt, t, lastDate);
      items.push({
        kind: 'thread_event',
        key: `event-${entry.event.id}`,
        event: entry.event,
      });
      index += 1;
      continue;
    }

    const msg = entry.message;
    pushDateSeparatorForTimestamp(items, msg.createdAt, t, lastDate);

    if (isAlbumImageMessage(msg)) {
      const group: InboxMessage[] = [msg];
      let nextIndex = index + 1;
      while (nextIndex < stream.length) {
        const next = stream[nextIndex];
        if (next.kind !== 'message') break;
        if (
          group.length >= ALBUM_MAX_IMAGES ||
          !canGroupInAlbum(group[group.length - 1], next.message)
        ) {
          break;
        }
        group.push(next.message);
        nextIndex += 1;
      }
      if (group.length > 1) {
        const prev = lastMessageItem(items);
        const stackCompact =
          prev != null && canStackMessageCompact(stackCompareMessage(prev), group[0]);
        items.push({
          kind: 'album',
          key: `album-${group.map(m => m.id).join('-')}`,
          messages: group,
          stackCompact: stackCompact || undefined,
        });
        index = nextIndex;
        continue;
      }
    }

    const prev = lastMessageItem(items);
    const stackCompact =
      prev != null && canStackMessageCompact(stackCompareMessage(prev), msg);
    items.push({
      kind: 'message',
      key: msg.id,
      message: msg,
      stackCompact: stackCompact || undefined,
    });
    index += 1;
  }

  return applyMessageStackGroups(items);
}

function buildMessageListItemsFromMessages(messages: InboxMessage[], t: TFunction): InboxMessageListItem[] {
  const items: InboxMessageListItem[] = [];
  let lastDate = '';
  let index = 0;

  while (index < messages.length) {
    const msg = messages[index];
    const dk = messageDateKey(msg.createdAt);
    if (dk !== lastDate) {
      lastDate = dk;
      items.push({
        kind: 'date',
        key: `date-${dk}`,
        label: formatMessageDateLabel(msg.createdAt, t),
      });
    }

    if (isAlbumImageMessage(msg)) {
      const group: InboxMessage[] = [msg];
      let nextIndex = index + 1;
      while (
        nextIndex < messages.length &&
        group.length < ALBUM_MAX_IMAGES &&
        canGroupInAlbum(group[group.length - 1], messages[nextIndex])
      ) {
        group.push(messages[nextIndex]);
        nextIndex += 1;
      }
      if (group.length > 1) {
        const prev = lastMessageItem(items);
        const stackCompact =
          prev != null && canStackMessageCompact(stackCompareMessage(prev), group[0]);
        items.push({
          kind: 'album',
          key: `album-${group.map((m) => m.id).join('-')}`,
          messages: group,
          stackCompact: stackCompact || undefined,
        });
        index = nextIndex;
        continue;
      }
    }

    const prev = lastMessageItem(items);
    const stackCompact =
      prev != null && canStackMessageCompact(stackCompareMessage(prev), msg);
    items.push({
      kind: 'message',
      key: msg.id,
      message: msg,
      stackCompact: stackCompact || undefined,
    });
    index += 1;
  }

  return items;
}

export function albumCaption(messages: InboxMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const body = messages[i].body?.trim();
    if (body) return body;
  }
  return '';
}

/** Chat-list preview line from a live WebSocket message payload. */
export function listPreviewFromWsPayload(payload: {
  body?: string;
  type?: string;
}): string {
  const body = payload.body?.trim();
  if (body) return body;
  const type = payload.type ?? 'chat';
  switch (type) {
    case 'image':
      return '📷 Image';
    case 'sticker':
      return '🎭 Sticker';
    case 'video':
      return '🎬 Video';
    case 'audio':
    case 'ptt':
      return '🎙️ Audio';
    case 'document':
      return '📄 Document';
    case 'location':
      return '📍 Location';
    case 'vcard':
    case 'contact_card':
      return '👤 Contact';
    default:
      return '';
  }
}

/** Build a display row from a WebSocket message.received / message.sent payload. */
export function inboxMessageFromWsPayload(
  sessionId: string,
  payload: {
    id?: string;
    chatId: string;
    from?: string;
    to?: string;
    body?: string;
    type?: string;
    fromMe?: boolean;
    timestamp?: number;
  },
): InboxMessage {
  const fromMe = payload.fromMe === true;
  return {
    id: payload.id ?? `ws-${Date.now()}`,
    sessionId,
    waMessageId: payload.id,
    chatId: payload.chatId,
    from: payload.from ?? (fromMe ? 'me' : payload.chatId),
    to: payload.to ?? payload.chatId,
    body: payload.body,
    type: payload.type ?? 'chat',
    direction: fromMe ? 'outgoing' : 'incoming',
    timestamp: payload.timestamp,
    status: fromMe ? 'sent' : 'received',
    createdAt: payload.timestamp
      ? new Date(payload.timestamp * 1000).toISOString()
      : new Date().toISOString(),
    metadata: { wsOptimistic: true },
  };
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
