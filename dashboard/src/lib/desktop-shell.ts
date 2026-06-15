import type { NotificationPrefs } from './notification-catalog';

export type DesktopNotificationPayload = {
  title: string;
  body?: string;
  tag?: string;
  deepLink?: string;
  silent?: boolean;
};

export type DesktopBridge = {
  isDesktopApp?: boolean;
  platform?: string;
  openExternal?: (url: string) => void;
  openFolder?: (name: string) => Promise<void>;
  getMaskedConfig?: () => Promise<Record<string, unknown>>;
  getConfig?: () => Promise<{ databaseUrl?: string; databaseMode?: string }>;
  ensureDatabaseReady?: () => Promise<{ ok: boolean; message: string }>;
  getHealth?: () => Promise<{
    serverStatus: string;
    databaseConnected: boolean;
    whatsappConnected: number;
    whatsappSessionCount: number;
    raw?: Record<string, unknown>;
  }>;
  restartBackend?: () => Promise<void>;
  testDatabase?: (url: string) => Promise<{
    ok: boolean;
    message: string;
    pgvectorInstalled?: boolean;
    pgvectorWarning?: string;
  }>;
  exportDiagnostics?: () => Promise<string>;
  checkForUpdates?: () => Promise<{ status: string; message: string }>;
  saveConfig?: (u: Record<string, unknown>) => Promise<unknown>;
  resetConfig?: () => Promise<unknown>;
  openDashboard?: () => Promise<void>;
  getAppVersion?: () => Promise<string>;
  showNotification?: (payload: DesktopNotificationPayload) => Promise<boolean>;
  isAppInBackground?: () => Promise<boolean>;
  getNotificationPermission?: () => Promise<'granted' | 'denied' | 'default'>;
  requestNotificationPermission?: () => Promise<'granted' | 'denied' | 'default'>;
  syncNotificationPrefs?: (prefs: NotificationPrefs | Record<string, unknown>) => Promise<NotificationPrefs>;
  setDockBadge?: (count: string) => Promise<void>;
  onNavigate?: (callback: (path: string) => void) => () => void;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

function desktopBridge(): DesktopBridge | undefined {
  return window.desktop;
}

export function isDesktopApp(): boolean {
  return Boolean(desktopBridge()?.isDesktopApp);
}

export function isDesktopDarwin(): boolean {
  const platform = desktopBridge()?.platform;
  if (platform) return platform === 'darwin';
  return isDesktopApp() && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function openDesktopExternal(url: string): void {
  const bridge = desktopBridge();
  if (bridge?.openExternal) {
    bridge.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openDesktopFolder(name: string): void {
  void desktopBridge()?.openFolder?.(name);
}

export function desktopNotificationsActive(): boolean {
  if (!isDesktopApp()) return false;
  try {
    const raw = localStorage.getItem('openwa_user_preferences');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as {
      notifications?: { enabled?: boolean };
      desktopNotifications?: { enabled?: boolean };
    };
    if (parsed.notifications) return parsed.notifications.enabled !== false;
    return parsed.desktopNotifications?.enabled !== false;
  } catch {
    return true;
  }
}
