export const USER_PREFS_STORAGE_KEY = 'openwa_user_preferences';

export type InboxDefaultView = 'all' | 'one';

export type InboxConversationFilterPref =
  | 'all'
  | 'unread'
  | 'needs_reply'
  | 'private'
  | 'groups'
  | 'resolved';

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
}

const INBOX_FILTER_PREFS: InboxConversationFilterPref[] = [
  'all',
  'unread',
  'needs_reply',
  'private',
  'groups',
  'resolved',
];

export function parseInboxConversationFilter(value: unknown): InboxConversationFilterPref {
  if (typeof value === 'string' && INBOX_FILTER_PREFS.includes(value as InboxConversationFilterPref)) {
    return value as InboxConversationFilterPref;
  }
  return 'private';
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
  inboxConversationFilter: 'private',
};

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
