import { app, Notification } from 'electron';
import type { WindowManager } from './window-manager';

export type DesktopNotificationPayload = {
  title: string;
  body?: string;
  tag?: string;
  deepLink?: string;
  silent?: boolean;
};

export type NotificationKindId = string;

export type NotificationPrefs = {
  enabled: boolean;
  showPreview: boolean;
  onlyWhenBackground: boolean;
  kinds: Partial<Record<NotificationKindId, boolean>>;
};

/** @deprecated Legacy desktop prefs shape */
export type DesktopNotificationPrefs = {
  enabled: boolean;
  messages: boolean;
  followups: boolean;
  ai: boolean;
  learning: boolean;
  system: boolean;
  includeGroups: boolean;
};

const DEFAULT_KINDS: Record<string, boolean> = {
  'message.direct': true,
  'message.group': false,
  'followup.due': true,
  'followup.escalated': true,
  'followup.kpi': true,
  'followup.autopilotApproval': true,
  'followup.autopilotPaused': true,
  'followup.autopilotFailed': true,
  'ai.escalated': true,
  'ai.optOut': true,
  'learning.pending': false,
  'learning.repeated': false,
  'learning.demandSpike': false,
  'learning.knowledgeReview': false,
  'session.qr': true,
  'session.disconnected': true,
  'system.serverDown': true,
  'system.databaseOffline': true,
  'system.whatsappDisconnected': true,
  'system.queueFailed': true,
  'system.syncFailed': true,
  'system.storageWarning': true,
  'crm.chatAssigned': true,
  'crm.quoteUpdate': false,
  'sms.failed': true,
  'sms.lowBalance': true,
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  showPreview: true,
  onlyWhenBackground: true,
  kinds: { ...DEFAULT_KINDS },
};

const SYSTEM_KINDS = [
  'system.serverDown',
  'system.databaseOffline',
  'system.whatsappDisconnected',
  'system.queueFailed',
  'system.syncFailed',
  'system.storageWarning',
] as const;

const APP_SUBTITLE = 'Inauzwa CRM';
const recentTags = new Map<string, number>();
const DEDUPE_MS = 8_000;

function isLegacyPrefs(value: unknown): value is DesktopNotificationPrefs {
  return !!value && typeof value === 'object' && 'messages' in value;
}

function migrateLegacyPrefs(legacy: DesktopNotificationPrefs): NotificationPrefs {
  const kinds = { ...DEFAULT_KINDS };
  const msgOn = legacy.messages !== false;
  kinds['message.direct'] = msgOn;
  kinds['message.group'] = msgOn && legacy.includeGroups === true;
  if (legacy.followups === false) {
    for (const id of Object.keys(kinds).filter(k => k.startsWith('followup.'))) kinds[id] = false;
  }
  if (legacy.ai === false) {
    kinds['ai.escalated'] = false;
    kinds['ai.optOut'] = false;
  }
  if (legacy.learning === false) {
    for (const id of Object.keys(kinds).filter(k => k.startsWith('learning.'))) kinds[id] = false;
  }
  if (legacy.system === false) {
    for (const id of SYSTEM_KINDS) kinds[id] = false;
    kinds['session.qr'] = false;
    kinds['session.disconnected'] = false;
  }
  return {
    enabled: legacy.enabled !== false,
    showPreview: true,
    onlyWhenBackground: true,
    kinds,
  };
}

function normalizePrefs(patch: Partial<NotificationPrefs> | DesktopNotificationPrefs): NotificationPrefs {
  if (isLegacyPrefs(patch)) {
    return migrateLegacyPrefs(patch);
  }
  const p = patch as Partial<NotificationPrefs>;
  return {
    enabled: p.enabled ?? DEFAULT_PREFS.enabled,
    showPreview: p.showPreview ?? DEFAULT_PREFS.showPreview,
    onlyWhenBackground: p.onlyWhenBackground ?? DEFAULT_PREFS.onlyWhenBackground,
    kinds: { ...DEFAULT_KINDS, ...(p.kinds ?? {}) },
  };
}

export class NotificationManager {
  private prefs: NotificationPrefs = { ...DEFAULT_PREFS, kinds: { ...DEFAULT_KINDS } };

  constructor(private readonly windowManager: WindowManager) {}

  setPrefs(patch: Partial<NotificationPrefs> | DesktopNotificationPrefs): void {
    this.prefs = normalizePrefs(patch);
  }

  getPrefs(): NotificationPrefs {
    return {
      ...this.prefs,
      kinds: { ...this.prefs.kinds },
    };
  }

  isKindEnabled(kind: NotificationKindId): boolean {
    if (!this.prefs.enabled) return false;
    const value = this.prefs.kinds[kind];
    if (value === undefined) return DEFAULT_KINDS[kind] ?? false;
    return value !== false;
  }

  isAppInBackground(): boolean {
    const win = this.windowManager.getMainWindow();
    if (!win) return true;
    if (!win.isVisible()) return true;
    if (win.isMinimized()) return true;
    if (!win.isFocused()) return true;
    return false;
  }

  getNotificationPermission(): 'granted' | 'denied' | 'default' {
    if (!Notification.isSupported()) return 'denied';
    return 'granted';
  }

  async requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
    if (!Notification.isSupported()) return 'denied';
    return 'granted';
  }

  show(payload: DesktopNotificationPayload, options?: { force?: boolean }): boolean {
    if (!options?.force && this.prefs.onlyWhenBackground && !this.isAppInBackground()) return false;
    if (!this.prefs.enabled) return false;
    if (!Notification.isSupported()) return false;

    const tag = payload.tag?.trim() || payload.title;
    const now = Date.now();
    const last = recentTags.get(tag);
    if (last != null && now - last < DEDUPE_MS) return false;
    recentTags.set(tag, now);

    const body = this.prefs.showPreview === false ? undefined : payload.body;

    try {
      const notification = new Notification({
        title: payload.title,
        body,
        subtitle: APP_SUBTITLE,
        silent: payload.silent === true,
      });

      notification.on('click', () => {
        this.windowManager.navigateTo(payload.deepLink || '/');
      });

      notification.show();
      return true;
    } catch (err) {
      console.error('[notification]', err instanceof Error ? err.message : err);
      return false;
    }
  }

  showForKind(kind: NotificationKindId, payload: DesktopNotificationPayload): boolean {
    if (!this.isKindEnabled(kind)) return false;
    return this.show(payload);
  }

  showSystem(payload: DesktopNotificationPayload): boolean {
    if (!SYSTEM_KINDS.some(k => this.isKindEnabled(k))) return false;
    return this.show(payload);
  }

  setDockBadge(count: string): void {
    if (process.platform !== 'darwin' || !app.dock) return;
    if (!this.isAppInBackground()) {
      app.dock.setBadge('');
      return;
    }
    app.dock.setBadge(count);
  }

  clearDockBadge(): void {
    if (process.platform !== 'darwin' || !app.dock) return;
    app.dock.setBadge('');
  }
}
