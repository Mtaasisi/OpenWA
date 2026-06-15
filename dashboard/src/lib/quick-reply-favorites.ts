import { getClientUserKey } from './auth-storage';

const STORAGE_KEY = 'openwa_quick_reply_favorites';

function staffScope(): string {
  return getClientUserKey();
}

function readAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, string[]>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function loadQuickReplyFavorites(): string[] {
  const all = readAll();
  return all[staffScope()] ?? [];
}

export function saveQuickReplyFavorites(ids: string[]): void {
  const all = readAll();
  all[staffScope()] = ids;
  writeAll(all);
}

export function toggleQuickReplyFavorite(id: string): string[] {
  const current = loadQuickReplyFavorites();
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
  saveQuickReplyFavorites(next);
  return next;
}

export function isQuickReplyFavorite(id: string, favorites?: string[]): boolean {
  const list = favorites ?? loadQuickReplyFavorites();
  return list.includes(id);
}
