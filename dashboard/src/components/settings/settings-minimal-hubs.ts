import type { SettingsCategoryId } from './settings-types';

/** Curated hub rows per category — everything else stays in header search. */
export const SETTINGS_HUB_VISIBLE_ITEMS: Partial<
  Record<SettingsCategoryId, readonly string[]>
> = {
  profile: ['account-preferences'],
  ai: ['ai-auto-reply', 'ai-knowledge', 'ai-provider', 'ai-usage'],
  chats: ['whatsapp-accounts', 'inbox-preferences', 'quick-replies'],
  business: ['products', 'lead-sources', 'followup-templates'],
  safety: ['whatsapp-safety', 'notifications'],
  system: ['users', 'storage-backup', 'logs'],
  help: ['help-center', 'contact-support'],
};

export function isHubVisibleItem(categoryId: SettingsCategoryId, itemId: string): boolean {
  const allowlist = SETTINGS_HUB_VISIBLE_ITEMS[categoryId];
  if (!allowlist) return true;
  return allowlist.includes(itemId);
}

export function hubItemSortIndex(categoryId: SettingsCategoryId, itemId: string): number {
  const allowlist = SETTINGS_HUB_VISIBLE_ITEMS[categoryId];
  if (!allowlist) return 0;
  const index = allowlist.indexOf(itemId);
  return index === -1 ? 99 : index;
}
