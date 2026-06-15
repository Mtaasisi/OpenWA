import { saveUserPreferences, loadUserPreferences } from './user-preferences';
import { INBOX_TABS_UPDATED_EVENT } from './inbox-events';

export type InboxChatRef = {
  sessionId: string;
  chatId: string;
  label?: string;
};

const MAX_RECENT = 10;
const MAX_PINNED = 24;
const MAX_OPEN_TABS = 8;
const OPEN_TABS_STORAGE_KEY = 'openwa_inbox_open_tabs';

function readOpenTabsRaw(): InboxChatRef[] {
  try {
    const raw = sessionStorage.getItem(OPEN_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is InboxChatRef =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as InboxChatRef).sessionId === 'string' &&
        typeof (c as InboxChatRef).chatId === 'string',
    );
  } catch {
    return [];
  }
}

function writeOpenTabs(tabs: InboxChatRef[]): InboxChatRef[] {
  sessionStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(tabs));
  window.dispatchEvent(new CustomEvent(INBOX_TABS_UPDATED_EVENT));
  return tabs;
}

export function getInboxOpenTabs(): InboxChatRef[] {
  return readOpenTabsRaw();
}

export function addInboxOpenTab(ref: InboxChatRef): InboxChatRef[] {
  const key = chatRefKey(ref);
  const prev = readOpenTabsRaw().filter(c => chatRefKey(c) !== key);
  return writeOpenTabs([{ ...ref }, ...prev].slice(0, MAX_OPEN_TABS));
}

export function removeInboxOpenTab(sessionId: string, chatId: string): InboxChatRef[] {
  const key = `${sessionId}:${chatId}`;
  return writeOpenTabs(readOpenTabsRaw().filter(c => chatRefKey(c) !== key));
}

export function reorderInboxOpenTab(sessionId: string, chatId: string): InboxChatRef[] {
  const key = `${sessionId}:${chatId}`;
  const tabs = readOpenTabsRaw();
  const match = tabs.find(c => chatRefKey(c) === key);
  if (!match) return tabs;
  return addInboxOpenTab(match);
}

export function inboxDeepLink(sessionId: string, chatId: string, member?: string | null): string {
  const params = new URLSearchParams({ session: sessionId, chat: chatId });
  if (member?.trim()) params.set('member', member.trim());
  return `/inbox?${params.toString()}`;
}

export function chatRefKey(ref: InboxChatRef): string {
  return `${ref.sessionId}:${ref.chatId}`;
}

export function getInboxRecentChats(): InboxChatRef[] {
  return loadUserPreferences().inboxRecentChats ?? [];
}

export function getInboxPinnedChats(): InboxChatRef[] {
  return loadUserPreferences().inboxPinnedChats ?? [];
}

export function recordInboxRecentChat(ref: InboxChatRef): InboxChatRef[] {
  const key = chatRefKey(ref);
  const prev = getInboxRecentChats().filter(c => chatRefKey(c) !== key);
  const next = [{ ...ref }, ...prev].slice(0, MAX_RECENT);
  saveUserPreferences({ inboxRecentChats: next });
  return next;
}

export function toggleInboxPinnedChat(ref: InboxChatRef): { pinned: boolean; list: InboxChatRef[] } {
  const key = chatRefKey(ref);
  const current = getInboxPinnedChats();
  const exists = current.some(c => chatRefKey(c) === key);
  const list = exists
    ? current.filter(c => chatRefKey(c) !== key)
    : [{ ...ref }, ...current].slice(0, MAX_PINNED);
  saveUserPreferences({ inboxPinnedChats: list });
  return { pinned: !exists, list };
}

export function isInboxChatPinned(ref: InboxChatRef): boolean {
  const key = chatRefKey(ref);
  return getInboxPinnedChats().some(c => chatRefKey(c) === key);
}
