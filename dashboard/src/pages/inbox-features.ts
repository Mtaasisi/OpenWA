import type { TFunction } from 'i18next';
import {
  INBOX_CONVERSATION_FILTERS,
  type ConversationFilter,
  countConversationsForFilter,
} from './inbox-helpers';

/** @deprecated Use inbox-filter-ui.ts INBOX_INTERAKT_MENU_STATUS_FILTERS */
export const INBOX_INTERAKT_DROPDOWN_STATUS_FILTERS: ConversationFilter[] = [
  'all',
  'unread',
  'needs_reply',
  'needs_human',
  'ai_opt_out',
  'resolved',
  'overdue',
  'ai_active',
  'assigned_to_me',
];

/** @deprecated Groups/people use combinable toggles in the unified filter menu. */
export const INBOX_INTERAKT_DROPDOWN_CHAT_FILTERS: ConversationFilter[] = ['private', 'groups'];

export const INBOX_INTERAKT_DROPDOWN_FILTERS: ConversationFilter[] = [
  ...INBOX_INTERAKT_DROPDOWN_STATUS_FILTERS,
  ...INBOX_INTERAKT_DROPDOWN_CHAT_FILTERS,
];

/** All inbox list filters. */
export const INBOX_ALL_FILTERS: ConversationFilter[] = [...INBOX_CONVERSATION_FILTERS];

export type InboxThemeVariant = 'classic' | 'interakt' | 'tactical';

export function getInboxFilterLabel(key: ConversationFilter, t: TFunction): string {
  return t(`inbox.filter.${key}`);
}

/** Filters that show badge counts in the list UI. */
export function getInboxFilterBadgeCount(
  key: ConversationFilter,
  conversations: import('../services/api').Conversation[],
  searchQuery: string,
  options?: { myStaffId?: string | null },
): number {
  if (key === 'needs_human') return countConversationsForFilter(conversations, searchQuery, 'needs_human', options);
  if (key === 'needs_reply') return countConversationsForFilter(conversations, searchQuery, 'needs_reply', options);
  if (key === 'unread') return countConversationsForFilter(conversations, searchQuery, 'unread', options);
  if (key === 'private') return countConversationsForFilter(conversations, searchQuery, 'private', options);
  if (key === 'groups') return countConversationsForFilter(conversations, searchQuery, 'groups', options);
  if (key === 'ai_opt_out') return countConversationsForFilter(conversations, searchQuery, 'ai_opt_out', options);
  if (key === 'resolved') return countConversationsForFilter(conversations, searchQuery, 'resolved', options);
  if (key === 'overdue') return countConversationsForFilter(conversations, searchQuery, 'overdue', options);
  if (key === 'ai_active') return countConversationsForFilter(conversations, searchQuery, 'ai_active', options);
  if (key === 'assigned_to_me') return countConversationsForFilter(conversations, searchQuery, 'assigned_to_me', options);
  return 0;
}

/** Ensure saved filter is valid for full filter UI (Interakt used to expose only 4). */
export function normalizeInboxFilter(filter: ConversationFilter): ConversationFilter {
  if (filter === 'open') return 'all';
  if (INBOX_ALL_FILTERS.includes(filter)) return filter;
  return 'all';
}

export const INBOX_FILTER_SHORTCUT_COUNT = INBOX_CONVERSATION_FILTERS.length;
