const STORAGE_KEY = 'openwa_settings_return_to';

export function isSettingsPath(path: string): boolean {
  return path === '/settings' || path.startsWith('/settings/');
}

/** Remember where to return when leaving Settings (non-settings routes only). */
export function rememberSettingsReturnTo(path: string): void {
  if (!path || isSettingsPath(path)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    /* ignore */
  }
}

export function getSettingsReturnTo(fallback = '/inbox'): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && !isSettingsPath(stored)) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function clearSettingsReturnTo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
