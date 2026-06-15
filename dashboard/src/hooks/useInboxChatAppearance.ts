import { useEffect } from 'react';
import { applyInboxChatAppearance } from '../lib/inbox-chat-appearance';
import { loadUserPreferences, USER_PREFS_STORAGE_KEY } from '../lib/user-preferences';

/** Keeps inbox chat wallpaper and bubble colors in sync with saved user preferences. */
export function useInboxChatAppearance(): void {
  useEffect(() => {
    const sync = () => applyInboxChatAppearance(loadUserPreferences());
    sync();

    const onPrefs = () => sync();
    window.addEventListener('openwa-prefs-updated', onPrefs);
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_PREFS_STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('openwa-prefs-updated', onPrefs);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
