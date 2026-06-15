import type { TFunction } from 'i18next';
import type { ChannelId } from '../lib/channels';
import type { InboxConversationSort } from './inbox-helpers';
import type { ConversationFilter } from './inbox-helpers';
import { getInboxFilterLabel } from './inbox-features';

/**
 * Status filters in the tune menu — work-queue order (most actionable first).
 * Chat type (people/groups) uses segment toggles in the same menu.
 */
export const INBOX_INTERAKT_MENU_STATUS_FILTERS: ConversationFilter[] = [
  'needs_reply',
  'unread',
  'needs_human',
  'assigned_to_me',
  'overdue',
  'all',
  'ai_active',
  'resolved',
  'ai_opt_out',
];

/**
 * Swipeable inbox chips — same priority as the menu:
 * 1) queues that need action  2) full list  3) chat type  4) monitoring / archive
 */
export type InboxSwipeFilterKey = ConversationFilter | 'people';

export const INBOX_INTERAKT_SWIPE_FILTERS: InboxSwipeFilterKey[] = [
  'needs_reply',
  'unread',
  'needs_human',
  'assigned_to_me',
  'overdue',
  'all',
  'people',
  'groups',
  'ai_active',
  'resolved',
  'ai_opt_out',
];

export function isInboxSwipeFilterActive(
  key: InboxSwipeFilterKey,
  activeFilter: ConversationFilter,
  hideGroups: boolean,
): boolean {
  /* People chip only when "people only" is the main distinction (not stacked on a status filter). */
  if (key === 'people') return hideGroups && activeFilter !== 'groups' && activeFilter === 'all';
  if (key === 'groups') return activeFilter === 'groups';
  if (activeFilter === 'groups') return false;
  return activeFilter === key;
}

export type InboxFilterChipState = {
  activeFilter: ConversationFilter;
  hideGroups: boolean;
  leadSourceFilter: string;
  conversationSort: InboxConversationSort;
};

export function normalizeInboxFilterSelection(filter: ConversationFilter): {
  activeFilter: ConversationFilter;
  hideGroups: boolean;
} {
  if (filter === 'private') {
    return { activeFilter: 'all', hideGroups: true };
  }
  if (filter === 'groups') {
    return { activeFilter: 'groups', hideGroups: false };
  }
  return { activeFilter: filter, hideGroups: false };
}

export function buildInboxFilterChipLabel(state: InboxFilterChipState, t: TFunction): string {
  const { activeFilter, hideGroups, leadSourceFilter, conversationSort } = state;

  if (activeFilter === 'groups') {
    return t('inbox.filter.groups');
  }

  const segments: string[] = [];

  if (activeFilter === 'assigned_to_me') {
    segments.push(t('inbox.filter.assigned_to_me'));
  } else if (activeFilter !== 'all') {
    segments.push(getInboxFilterLabel(activeFilter, t));
  } else if (hideGroups) {
    segments.push(t('inbox.interakt.filterChipPeople'));
  } else {
    segments.push(t('inbox.interakt.filterChipAll'));
  }

  if (hideGroups && activeFilter !== 'all') {
    segments.push(t('inbox.interakt.filterChipPeople'));
  }

  if (leadSourceFilter) {
    segments.push(t('inbox.interakt.filterChipSource'));
  }

  if (conversationSort === 'oldest') {
    segments.push(t('inbox.interakt.listOldest'));
  }

  if (segments.length <= 2) {
    return segments.join(' · ');
  }
  return `${segments[0]} · ${segments[1]}+`;
}

export function inboxFilterChipIsActive(state: InboxFilterChipState): boolean {
  return (
    state.activeFilter !== 'all' ||
    state.hideGroups ||
    Boolean(state.leadSourceFilter) ||
    state.conversationSort !== 'newest'
  );
}

export function inboxExtraFiltersActive(state: InboxFilterChipState): boolean {
  return state.hideGroups || Boolean(state.leadSourceFilter) || state.conversationSort !== 'newest';
}

/** Material Symbol name per inbox status filter (unified filter menu). */
export const INBOX_FILTER_ICONS: Partial<Record<ConversationFilter, string>> = {
  all: 'inbox',
  unread: 'mark_unread_chat_alt',
  needs_reply: 'chat_bubble',
  needs_human: 'support_agent',
  ai_opt_out: 'do_not_disturb_on',
  resolved: 'check_circle',
  overdue: 'schedule',
  ai_active: 'smart_toy',
  assigned_to_me: 'person_pin',
  groups: 'groups',
  private: 'person',
};

export type InboxFilterIconTone = 'default' | 'primary' | 'warning' | 'danger' | 'ai' | 'muted';

export function getInboxFilterIconTone(key: ConversationFilter): InboxFilterIconTone {
  if (key === 'needs_reply' || key === 'overdue') return 'warning';
  if (key === 'needs_human') return 'danger';
  if (key === 'ai_active' || key === 'ai_opt_out') return 'ai';
  if (key === 'resolved') return 'primary';
  if (key === 'unread') return 'primary';
  return 'default';
}

export function channelFilterLabel(channel: ChannelId | 'all', t: TFunction): string {
  if (channel === 'all') return t('inbox.allChannels');
  if (channel === 'whatsapp') return t('channels.whatsapp');
  if (channel === 'sms') return t('channels.sms');
  return channel;
}
