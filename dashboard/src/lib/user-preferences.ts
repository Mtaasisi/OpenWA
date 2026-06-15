import type { InboxChatRef } from './inbox-chat-nav';
import {
  parseInboxChatHexColor,
  parseInboxChatWallpaper,
  DEFAULT_INBOX_CHAT_BG,
  DEFAULT_INBOX_CHAT_OUTGOING,
  type InboxChatWallpaperId,
} from './inbox-chat-appearance';

export const USER_PREFS_STORAGE_KEY = 'openwa_user_preferences';

export type InboxDefaultView = 'all' | 'one';

import {
  DEFAULT_NOTIFICATION_PREFS,
  migrateLegacyNotificationPrefs,
  type LegacyDesktopNotificationPrefs,
  type NotificationPrefs,
} from './notification-catalog';

/** @deprecated Use NotificationPrefs from notification-catalog */
export type DesktopNotificationPrefs = LegacyDesktopNotificationPrefs;

/** @deprecated Use DEFAULT_NOTIFICATION_PREFS */
export const DEFAULT_DESKTOP_NOTIFICATIONS: DesktopNotificationPrefs = {
  enabled: true,
  messages: true,
  followups: true,
  ai: true,
  learning: false,
  system: true,
  includeGroups: false,
};

export type { NotificationPrefs };
export { DEFAULT_NOTIFICATION_PREFS };

export type InteraktSidebarMode = 'expanded' | 'collapsed' | 'closed';

import type { ConversationTypeFilter } from './conversation-types';

export type InboxConversationFilterPref =
  | 'all'
  | 'my_work'
  | 'unread'
  | 'needs_reply'
  | 'needs_human'
  | 'hot_leads'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'followup_due'
  | 'unassigned'
  | 'ai_opt_out'
  | 'private'
  | 'groups'
  | 'resolved'
  | 'overdue'
  | 'failed_sends'
  | 'ai_active'
  | 'assigned_to_me';

export interface UserPreferences {
  inboxDefaultView: InboxDefaultView;
  productInStockOnly: boolean;
  productIncludeDevices: boolean;
  productIncludeImage: boolean;
  /** null = follow server / INAUZWA default */
  productRefreshBeforeSend: boolean | null;
  /** Preferred session when inbox is in single-account mode (null = auto). */
  inboxDefaultSessionId: string | null;
  /** Show customer / CRM panel and open button in inbox */
  inboxShowCustomerPanel: boolean;
  /** Show conversation list column in inbox */
  inboxShowChatList: boolean;
  /** Default conversation filter chip in inbox */
  inboxConversationFilter: InboxConversationFilterPref;
  /** Interakt theme app sidebar: expanded (300px), collapsed (64px), or hidden */
  interaktSidebarMode: InteraktSidebarMode;
  /** Staff/API key id used for the inbox "Me" filter chip */
  inboxMyStaffId: string | null;
  /** @deprecated Migrated into notifications.enabled — kept for legacy reads */
  inboxBrowserNotifications: boolean;
  /** @deprecated Migrated into notifications — kept for legacy reads */
  desktopNotifications: DesktopNotificationPrefs;
  /** Unified OS notification preferences (web + desktop) */
  notifications: NotificationPrefs;
  /** Chat-type filter (customers, groups, etc.) */
  inboxChatTypeFilter: ConversationTypeFilter;
  /** Hide WhatsApp group chats in inbox list (combinable with status filters). */
  inboxHideGroups: boolean;
  /** Default conversation sort in inbox list. */
  inboxConversationSort: 'newest' | 'oldest';
  /** Recently opened inbox threads (most recent first) */
  inboxRecentChats: InboxChatRef[];
  /** Pinned inbox threads (legacy local storage; migrated to server) */
  inboxPinnedChats: InboxChatRef[];
  /** Local inbox pins were merged into server-side pins */
  inboxPinsServerSynced?: boolean;
  /** Inbox conversation list column width (px). */
  inboxListWidthPx?: number;
  /** Inbox inline CRM column width (px). */
  inboxCrmWidthPx?: number;
  /** Chat thread wallpaper pattern in inbox. */
  inboxChatWallpaper: InboxChatWallpaperId;
  /** Chat thread background color (hex). */
  inboxChatBackgroundColor: string;
  /** Outgoing message bubble color (hex). */
  inboxChatOutgoingColor: string;
}

const INBOX_FILTER_PREFS: InboxConversationFilterPref[] = [
  'all',
  'my_work',
  'unread',
  'needs_reply',
  'needs_human',
  'hot_leads',
  'waiting_payment',
  'waiting_stock',
  'followup_due',
  'unassigned',
  'ai_opt_out',
  'private',
  'groups',
  'resolved',
  'overdue',
  'failed_sends',
  'ai_active',
  'assigned_to_me',
];

export function parseInboxConversationFilter(value: unknown): InboxConversationFilterPref {
  if (value === 'open') return 'all';
  if (typeof value === 'string' && INBOX_FILTER_PREFS.includes(value as InboxConversationFilterPref)) {
    return value as InboxConversationFilterPref;
  }
  return 'all';
}

const DEFAULTS: UserPreferences = {
  inboxDefaultView: 'all',
  productInStockOnly: true,
  productIncludeDevices: false,
  productIncludeImage: true,
  productRefreshBeforeSend: null,
  inboxShowCustomerPanel: true,
  inboxDefaultSessionId: null,
  inboxShowChatList: true,
  inboxConversationFilter: 'needs_reply',
  interaktSidebarMode: 'expanded',
  inboxMyStaffId: null,
  inboxBrowserNotifications: false,
  desktopNotifications: { ...DEFAULT_DESKTOP_NOTIFICATIONS },
  notifications: { ...DEFAULT_NOTIFICATION_PREFS, kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds } },
  inboxChatTypeFilter: 'direct_customer',
  inboxHideGroups: true,
  inboxConversationSort: 'newest',
  inboxRecentChats: [],
  inboxPinnedChats: [],
  inboxChatWallpaper: 'default',
  inboxChatBackgroundColor: DEFAULT_INBOX_CHAT_BG,
  inboxChatOutgoingColor: DEFAULT_INBOX_CHAT_OUTGOING,
};

const CHAT_TYPE_FILTER_PREFS: ConversationTypeFilter[] = [
  'all',
  'direct_customer',
  'group',
  'broadcast',
  'internal',
  'system',
  'spam',
];

export function parseInboxChatTypeFilter(value: unknown): ConversationTypeFilter {
  if (typeof value === 'string' && CHAT_TYPE_FILTER_PREFS.includes(value as ConversationTypeFilter)) {
    return value as ConversationTypeFilter;
  }
  return 'all';
}

const INTERAKT_SIDEBAR_MODES: InteraktSidebarMode[] = ['expanded', 'collapsed', 'closed'];

function parseDesktopNotifications(value: unknown): DesktopNotificationPrefs {
  if (!value || typeof value !== 'object') return { ...DEFAULT_DESKTOP_NOTIFICATIONS };
  const parsed = value as Partial<DesktopNotificationPrefs>;
  return {
    enabled: parsed.enabled ?? DEFAULT_DESKTOP_NOTIFICATIONS.enabled,
    messages: parsed.messages ?? DEFAULT_DESKTOP_NOTIFICATIONS.messages,
    followups: parsed.followups ?? DEFAULT_DESKTOP_NOTIFICATIONS.followups,
    ai: parsed.ai ?? DEFAULT_DESKTOP_NOTIFICATIONS.ai,
    learning: parsed.learning ?? DEFAULT_DESKTOP_NOTIFICATIONS.learning,
    system: parsed.system ?? DEFAULT_DESKTOP_NOTIFICATIONS.system,
    includeGroups: parsed.includeGroups === true,
  };
}

function parseNotifications(
  parsed: Partial<UserPreferences> & {
    notifications?: Partial<NotificationPrefs>;
    desktopNotifications?: Partial<DesktopNotificationPrefs>;
  },
): NotificationPrefs {
  return migrateLegacyNotificationPrefs({
    inboxBrowserNotifications: parsed.inboxBrowserNotifications,
    desktopNotifications: parsed.desktopNotifications,
    notifications: parsed.notifications,
  });
}

export function parseInteraktSidebarMode(value: unknown): InteraktSidebarMode {
  if (typeof value === 'string' && INTERAKT_SIDEBAR_MODES.includes(value as InteraktSidebarMode)) {
    return value as InteraktSidebarMode;
  }
  return 'expanded';
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      inboxDefaultView: parsed.inboxDefaultView === 'one' ? 'one' : 'all',
      productInStockOnly: parsed.productInStockOnly ?? DEFAULTS.productInStockOnly,
      productIncludeDevices: parsed.productIncludeDevices ?? DEFAULTS.productIncludeDevices,
      productIncludeImage: parsed.productIncludeImage ?? DEFAULTS.productIncludeImage,
      productRefreshBeforeSend:
        parsed.productRefreshBeforeSend === null || typeof parsed.productRefreshBeforeSend === 'boolean'
          ? parsed.productRefreshBeforeSend
          : DEFAULTS.productRefreshBeforeSend,
      inboxShowCustomerPanel: parsed.inboxShowCustomerPanel ?? DEFAULTS.inboxShowCustomerPanel,
      inboxDefaultSessionId:
        typeof parsed.inboxDefaultSessionId === 'string' && parsed.inboxDefaultSessionId.trim()
          ? parsed.inboxDefaultSessionId.trim()
          : null,
      inboxShowChatList: parsed.inboxShowChatList ?? DEFAULTS.inboxShowChatList,
      inboxConversationFilter: parseInboxConversationFilter(parsed.inboxConversationFilter),
      interaktSidebarMode: parseInteraktSidebarMode(parsed.interaktSidebarMode),
      inboxMyStaffId:
        typeof parsed.inboxMyStaffId === 'string' && parsed.inboxMyStaffId.trim()
          ? parsed.inboxMyStaffId.trim()
          : null,
      inboxBrowserNotifications: parsed.inboxBrowserNotifications ?? DEFAULTS.inboxBrowserNotifications,
      desktopNotifications: parseDesktopNotifications(parsed.desktopNotifications),
      notifications: parseNotifications(parsed),
      inboxChatTypeFilter: parseInboxChatTypeFilter(parsed.inboxChatTypeFilter),
      inboxHideGroups: parsed.inboxHideGroups === true,
      inboxConversationSort: parsed.inboxConversationSort === 'oldest' ? 'oldest' : 'newest',
      inboxRecentChats: Array.isArray(parsed.inboxRecentChats)
        ? parsed.inboxRecentChats.filter(
            (c): c is InboxChatRef =>
              !!c &&
              typeof c === 'object' &&
              typeof (c as InboxChatRef).sessionId === 'string' &&
              typeof (c as InboxChatRef).chatId === 'string',
          )
        : DEFAULTS.inboxRecentChats,
      inboxPinnedChats: Array.isArray(parsed.inboxPinnedChats)
        ? parsed.inboxPinnedChats.filter(
            (c): c is InboxChatRef =>
              !!c &&
              typeof c === 'object' &&
              typeof (c as InboxChatRef).sessionId === 'string' &&
              typeof (c as InboxChatRef).chatId === 'string',
          )
        : DEFAULTS.inboxPinnedChats,
      inboxPinsServerSynced: parsed.inboxPinsServerSynced === true,
      inboxListWidthPx:
        typeof parsed.inboxListWidthPx === 'number' && Number.isFinite(parsed.inboxListWidthPx)
          ? parsed.inboxListWidthPx
          : undefined,
      inboxCrmWidthPx:
        typeof parsed.inboxCrmWidthPx === 'number' && Number.isFinite(parsed.inboxCrmWidthPx)
          ? parsed.inboxCrmWidthPx
          : undefined,
      inboxChatWallpaper: parseInboxChatWallpaper(parsed.inboxChatWallpaper),
      inboxChatBackgroundColor: parseInboxChatHexColor(
        parsed.inboxChatBackgroundColor,
        DEFAULT_INBOX_CHAT_BG,
      ),
      inboxChatOutgoingColor: parseInboxChatHexColor(
        parsed.inboxChatOutgoingColor,
        DEFAULT_INBOX_CHAT_OUTGOING,
      ),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const next = { ...loadUserPreferences(), ...patch };
  localStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('openwa-prefs-updated', { detail: next }));
  return next;
}

export function clearUserPreferences(): void {
  localStorage.removeItem(USER_PREFS_STORAGE_KEY);
}
