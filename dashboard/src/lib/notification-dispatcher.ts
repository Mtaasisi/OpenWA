import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import {
  isKindEnabled,
  NOTIFICATION_CATALOG,
  type NotificationKindId,
  type NotificationPrefs,
} from './notification-catalog';
import { isDesktopApp } from './desktop-shell';
import { inboxDeepLink, recordInboxRecentChat } from './inbox-chat-nav';
import { formatCustomerLabel, resolveThreadIdentity, sanitizeCustomerPhone } from './inbox-customer-display';

export type NotificationPayload = {
  kind: NotificationKindId;
  title: string;
  body?: string;
  tag?: string;
  deepLink?: string;
  silent?: boolean;
};

const recentTags = new Map<string, number>();
const DEDUPE_MS = 8_000;

function isGroupChat(chatId: string): boolean {
  return chatId.endsWith('@g.us');
}

export function shouldNotify(
  prefs: NotificationPrefs,
  kind: NotificationKindId,
  options?: { isAdmin?: boolean },
): boolean {
  if (!isKindEnabled(prefs, kind)) return false;
  const entry = NOTIFICATION_CATALOG.find(e => e.id === kind);
  if (entry?.adminOnly && !options?.isAdmin) return false;
  return true;
}

export async function isAppInBackground(): Promise<boolean> {
  if (isDesktopApp() && window.desktop?.isAppInBackground) {
    return window.desktop.isAppInBackground();
  }
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

export async function dispatchNotification(
  prefs: NotificationPrefs,
  payload: NotificationPayload,
  options?: {
    isAdmin?: boolean;
    navigate?: NavigateFunction;
    force?: boolean;
  },
): Promise<boolean> {
  if (!shouldNotify(prefs, payload.kind, options)) return false;

  if (!options?.force && prefs.onlyWhenBackground) {
    const bg = await isAppInBackground();
    if (!bg) return false;
  }

  const tag = payload.tag?.trim() || payload.title;
  const now = Date.now();
  const last = recentTags.get(tag);
  if (last != null && now - last < DEDUPE_MS) return false;
  recentTags.set(tag, now);

  const body = prefs.showPreview === false ? undefined : payload.body;
  const notifyPayload = {
    title: payload.title,
    body,
    tag,
    deepLink: payload.deepLink,
    silent: payload.silent,
  };

  if (isDesktopApp() && window.desktop?.showNotification) {
    return window.desktop.showNotification(notifyPayload);
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(payload.title, {
      body,
      tag,
      silent: payload.silent === true,
    });
    if (payload.deepLink && options?.navigate) {
      const deepLink = payload.deepLink;
      const navigate = options.navigate;
      notification.onclick = () => {
        window.focus();
        navigate(deepLink);
        notification.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveNotificationChatId(data: Record<string, unknown>): string {
  if (typeof data.chatId === 'string' && data.chatId.trim()) return data.chatId;
  if (typeof data.from === 'string' && data.from.trim()) return data.from;
  return '';
}

export function customerLabel(data: Record<string, unknown>, t: TFunction): string {
  const chatId = resolveNotificationChatId(data);
  const customerName = typeof data.customerName === 'string' ? data.customerName : null;
  const customerPhone = typeof data.customerPhone === 'string' ? data.customerPhone : null;
  const notifyName = typeof data.notifyName === 'string' ? data.notifyName : null;

  if (chatId) {
    const identity = resolveThreadIdentity({
      chatId,
      customerName,
      customerPhone,
      displayName: notifyName,
    });
    return formatCustomerLabel(
      {
        chatId,
        customerName: identity.customerName,
        customerPhone: identity.customerPhone,
        displayName: notifyName,
      },
      t,
    );
  }
  if (customerName?.trim()) return customerName.trim();
  const sanitized = customerPhone ? sanitizeCustomerPhone('', customerPhone) : null;
  if (sanitized) return sanitized;
  return t('inbox.notifications.unknownCustomer', { defaultValue: 'Customer' });
}

export function sessionLabel(data: Record<string, unknown>): string {
  if (typeof data.sessionName === 'string' && data.sessionName.trim()) return data.sessionName;
  return 'WhatsApp';
}

export function buildInboxDeepLink(
  sessionId: string,
  chatId: string,
  customer: string,
  navigate?: NavigateFunction,
): { deepLink: string; onNavigate?: () => void } {
  const deepLink = inboxDeepLink(sessionId, chatId);
  if (!navigate) return { deepLink };
  return {
    deepLink,
    onNavigate: () => {
      recordInboxRecentChat({ sessionId, chatId, label: customer });
      navigate(deepLink);
    },
  };
}

export { isGroupChat };
