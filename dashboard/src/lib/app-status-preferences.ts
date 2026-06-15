import {
  DEFAULT_STATUS_BAR_PREFERENCES,
  STATUS_BAR_PREFS_KEY,
  STATUS_BAR_PREFS_VERSION,
  STATUS_BAR_REFRESH_INTERVALS_MS,
  type StatusBarPreferences,
} from '../types/appStatusTypes';

type StoredStatusBarPreferences = Partial<StatusBarPreferences> & { version?: number };

function parseStatusBarPreferences(parsed: StoredStatusBarPreferences): StatusBarPreferences {
  const version = parsed.version ?? 1;
  let refreshInterval = (STATUS_BAR_REFRESH_INTERVALS_MS as readonly number[]).includes(
    parsed.refreshInterval as number,
  )
    ? (parsed.refreshInterval as number)
    : DEFAULT_STATUS_BAR_PREFERENCES.refreshInterval;

  if (version < STATUS_BAR_PREFS_VERSION && refreshInterval === 30_000) {
    refreshInterval = DEFAULT_STATUS_BAR_PREFERENCES.refreshInterval;
  }

  return {
    showStatusBar: parsed.showStatusBar ?? DEFAULT_STATUS_BAR_PREFERENCES.showStatusBar,
    refreshInterval,
    showWorkSummary: parsed.showWorkSummary ?? DEFAULT_STATUS_BAR_PREFERENCES.showWorkSummary,
    showBranch: parsed.showBranch ?? DEFAULT_STATUS_BAR_PREFERENCES.showBranch,
    compactMode:
      parsed.compactMode === 'always' || parsed.compactMode === 'never' || parsed.compactMode === 'auto'
        ? parsed.compactMode
        : DEFAULT_STATUS_BAR_PREFERENCES.compactMode,
    showAdvancedHealth: parsed.showAdvancedHealth ?? DEFAULT_STATUS_BAR_PREFERENCES.showAdvancedHealth,
  };
}

export function loadStatusBarPreferences(): StatusBarPreferences {
  try {
    const raw = localStorage.getItem(STATUS_BAR_PREFS_KEY);
    if (!raw) return { ...DEFAULT_STATUS_BAR_PREFERENCES };
    const parsed = JSON.parse(raw) as StoredStatusBarPreferences;
    const next = parseStatusBarPreferences(parsed);
    if ((parsed.version ?? 1) < STATUS_BAR_PREFS_VERSION) {
      localStorage.setItem(
        STATUS_BAR_PREFS_KEY,
        JSON.stringify({ ...next, version: STATUS_BAR_PREFS_VERSION }),
      );
    }
    return next;
  } catch {
    return { ...DEFAULT_STATUS_BAR_PREFERENCES };
  }
}

export function saveStatusBarPreferences(patch: Partial<StatusBarPreferences>): StatusBarPreferences {
  const next = { ...loadStatusBarPreferences(), ...patch };
  localStorage.setItem(
    STATUS_BAR_PREFS_KEY,
    JSON.stringify({ ...next, version: STATUS_BAR_PREFS_VERSION }),
  );
  window.dispatchEvent(new CustomEvent('openwa-status-bar-prefs-updated', { detail: next }));
  return next;
}
