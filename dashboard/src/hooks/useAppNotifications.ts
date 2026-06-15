import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useRole } from './useRole';
import { loadUserPreferences } from '../lib/user-preferences';
import type { NotificationPrefs } from '../lib/notification-catalog';
import {
  customerLabel,
  dispatchNotification,
  isGroupChat,
  resolveNotificationChatId,
  sessionLabel,
} from '../lib/notification-dispatcher';
import { inboxDeepLink } from '../lib/inbox-chat-nav';
import { isDesktopApp } from '../lib/desktop-shell';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';
import { appStatusApi } from '../services/api';
import { NOTIFICATION_CATALOG } from '../lib/notification-catalog';

const WS_EVENTS = [
  'message.received',
  'followup.warning',
  'followup.escalated',
  'followup.kpi_penalty',
  'followup.autopilot_paused',
  'followup.autopilot_updated',
  'ai.escalated',
  'ai.opt_out',
  'ai.learning.pending',
  'ai.learning.repeated',
  'product.demand.spike',
  'knowledge.needs_review',
  'session.status',
  'session.qr',
  'inbox.chat_assigned',
  'sms.status_changed',
  'storage.warning',
  'sync.failed',
] as const;

function isAdminOnlyKind(kind: string): boolean {
  return NOTIFICATION_CATALOG.some(e => e.id === kind && e.adminOnly);
}

export function useAppNotifications(unreadCount = 0) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadUserPreferences().notifications);
  const queueFailedRef = useRef(0);
  const syncFailedRef = useRef(false);
  const desktop = isDesktopApp() ? window.desktop : null;

  useEffect(() => {
    const sync = () => setPrefs(loadUserPreferences().notifications);
    window.addEventListener('openwa-prefs-updated', sync);
    return () => window.removeEventListener('openwa-prefs-updated', sync);
  }, []);

  useEffect(() => {
    if (!desktop?.syncNotificationPrefs) return;
    void desktop.syncNotificationPrefs(prefs as unknown as Record<string, unknown>);
  }, [desktop, prefs]);

  useEffect(() => {
    if (!desktop?.onNavigate) return;
    return desktop.onNavigate(path => navigate(path));
  }, [desktop, navigate]);

  useEffect(() => {
    if (!desktop?.setDockBadge) return;
    const syncBadge = () => {
      const badge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : '';
      void desktop.setDockBadge?.(badge);
    };
    syncBadge();
    window.addEventListener('focus', syncBadge);
    document.addEventListener('visibilitychange', syncBadge);
    return () => {
      window.removeEventListener('focus', syncBadge);
      document.removeEventListener('visibilitychange', syncBadge);
    };
  }, [desktop, unreadCount]);

  const { data: appStatus } = useQuery({
    queryKey: ['app', 'status', 'notifications'],
    queryFn: () => appStatusApi.get(),
    enabled: prefs.enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!prefs.enabled) return;
    const failed = appStatus?.queue?.failed ?? 0;
    const prev = queueFailedRef.current;
    queueFailedRef.current = failed;
    if (prev === 0 && failed > 0) {
      void dispatchNotification(
        prefs,
        {
          kind: 'system.queueFailed',
          title: t('settings.notifications.kinds.systemQueueFailed', {
            defaultValue: 'Send queue failures',
          }),
          body: t('desktop.notifications.queueFailedBody', {
            count: failed,
            defaultValue: `${failed} message(s) failed to send.`,
          }),
          tag: 'system:queue-failed',
          deepLink: '/automations',
        },
        { isAdmin, navigate },
      );
    }

    const syncErr = Boolean(appStatus?.sync?.failed);
    if (!syncFailedRef.current && syncErr) {
      void dispatchNotification(
        prefs,
        {
          kind: 'system.syncFailed',
          title: t('settings.notifications.kinds.systemSyncFailed', { defaultValue: 'Product sync failed' }),
          body: appStatus?.warnings?.find(w => w.id === 'sync-error')?.message,
          tag: 'system:sync-failed',
          deepLink: settingsPanelHref('products'),
        },
        { isAdmin, navigate },
      );
    }
    syncFailedRef.current = syncErr;
  }, [appStatus, isAdmin, navigate, prefs, t]);

  const notifyOpts = { isAdmin, navigate };

  useWebSocket({
    subscribeAllSessions: true,
    globalEvents: prefs.enabled ? [...WS_EVENTS] : [],
    onGlobalEvent: (event, sessionId, data) => {
      if (!prefs.enabled) return;

      const payload = (data ?? {}) as Record<string, unknown>;
      const customer = customerLabel(payload, t);
      const account = sessionLabel(payload);
      const chatId = resolveNotificationChatId(payload);
      const followupSessionId =
        typeof payload.sessionId === 'string' && payload.sessionId.trim()
          ? payload.sessionId.trim()
          : sessionId;
      const followupChatId =
        typeof payload.chatId === 'string' && payload.chatId.trim() ? payload.chatId.trim() : chatId;
      const inboxLink =
        followupSessionId && followupChatId
          ? inboxDeepLink(followupSessionId, followupChatId)
          : '/inbox';

      const guardAdmin = (kind: string) => {
        if (isAdminOnlyKind(kind) && !isAdmin) return false;
        return true;
      };

      if (event === 'message.received') {
        if (payload.fromMe === true) return;
        const kind = isGroupChat(chatId) ? 'message.group' : 'message.direct';
        if (!guardAdmin(kind)) return;
        const preview =
          typeof payload.messagePreview === 'string'
            ? payload.messagePreview
            : typeof payload.body === 'string'
              ? payload.body.slice(0, 120)
              : undefined;
        void dispatchNotification(
          prefs,
          {
            kind,
            title: t('inbox.notifications.newMessage', {
              customer,
              account,
              defaultValue: `New message from ${customer} — ${account}`,
            }),
            body: preview,
            tag: `msg:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'followup.warning') {
        if (!guardAdmin('followup.due')) return;
        const stage = typeof payload.stage === 'string' ? payload.stage.replace(/_/g, ' ') : undefined;
        void dispatchNotification(
          prefs,
          {
            kind: 'followup.due',
            title: t('followups.alerts.warning', { defaultValue: 'Follow-up due' }),
            body: stage ?? `${customer} — ${account}`,
            tag: `followup:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'followup.escalated') {
        if (!guardAdmin('followup.escalated')) return;
        const stage = typeof payload.stage === 'string' ? payload.stage.replace(/_/g, ' ') : undefined;
        void dispatchNotification(
          prefs,
          {
            kind: 'followup.escalated',
            title: t('followups.alerts.escalated', { defaultValue: 'Follow-up escalated' }),
            body: stage ?? `${customer} — ${account}`,
            tag: `followup:esc:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'followup.kpi_penalty') {
        if (!guardAdmin('followup.kpi')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'followup.kpi',
            title: t('followups.alerts.kpiPenalty', { defaultValue: 'Follow-up KPI penalty' }),
            body: `${customer} — ${account}`,
            tag: `followup:kpi:${followupSessionId}`,
            deepLink: '/followups',
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'followup.autopilot_paused' && payload.paused === true) {
        if (!guardAdmin('followup.autopilotPaused')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'followup.autopilotPaused',
            title: t('followups.autopilot.pausedToast', { defaultValue: 'Follow-up autopilot paused' }),
            body: customer,
            tag: `followup:autopilot-paused:${followupSessionId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'followup.autopilot_updated') {
        const action = typeof payload.action === 'string' ? payload.action : '';
        if (action === 'created' && payload.status === 'needs_approval') {
          if (!guardAdmin('followup.autopilotApproval')) return;
          void dispatchNotification(
            prefs,
            {
              kind: 'followup.autopilotApproval',
              title: t('followups.autopilot.needsApprovalToast', {
                defaultValue: 'Autopilot draft needs approval',
              }),
              body: customer,
              tag: `followup:approval:${followupSessionId}:${followupChatId}`,
              deepLink: '/followups',
            },
            notifyOpts,
          );
        } else if (action === 'failed') {
          if (!guardAdmin('followup.autopilotFailed')) return;
          void dispatchNotification(
            prefs,
            {
              kind: 'followup.autopilotFailed',
              title: t('followups.autopilot.failedToast', { defaultValue: 'Autopilot follow-up failed' }),
              body: customer,
              tag: `followup:failed:${followupSessionId}`,
              deepLink: '/followups',
            },
            notifyOpts,
          );
        }
        return;
      }

      if (event === 'ai.escalated') {
        if (!guardAdmin('ai.escalated')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'ai.escalated',
            title: t('inbox.aiEscalatedToast', { defaultValue: 'AI needs human help' }),
            body: customer,
            tag: `ai:escalated:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'ai.opt_out') {
        if (!guardAdmin('ai.optOut')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'ai.optOut',
            title: t('inbox.aiOptOutToast', { defaultValue: 'Customer opted out of AI' }),
            body: customer,
            tag: `ai:opt-out:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'ai.learning.pending') {
        if (!guardAdmin('learning.pending')) return;
        const q = typeof payload.question === 'string' ? payload.question.slice(0, 80) : '';
        void dispatchNotification(
          prefs,
          {
            kind: 'learning.pending',
            title: t('ai.learning.toast.pending', { defaultValue: 'New unknown question for AI learning' }),
            body: q,
            tag: 'learning:pending',
            deepLink: settingsPanelHref('ai-learning'),
            silent: true,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'ai.learning.repeated') {
        if (!guardAdmin('learning.repeated')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'learning.repeated',
            title: t('ai.learning.toast.repeated', { defaultValue: 'Repeated unknown question — teach AI' }),
            tag: 'learning:repeated',
            deepLink: settingsPanelHref('ai-learning'),
            silent: true,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'product.demand.spike') {
        if (!guardAdmin('learning.demandSpike')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'learning.demandSpike',
            title: t('ai.learning.toast.demandSpike', { defaultValue: 'High product demand detected' }),
            tag: 'learning:demand-spike',
            deepLink: '/campaigns',
            silent: true,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'knowledge.needs_review') {
        if (!guardAdmin('learning.knowledgeReview')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'learning.knowledgeReview',
            title: t('desktop.notifications.knowledgeReview', { defaultValue: 'Knowledge needs review' }),
            tag: 'learning:knowledge-review',
            deepLink: settingsPanelHref('ai-knowledge'),
            silent: true,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'session.qr') {
        if (!guardAdmin('session.qr')) return;
        const name = typeof payload.name === 'string' ? payload.name : account;
        void dispatchNotification(
          prefs,
          {
            kind: 'session.qr',
            title: t('desktop.notifications.scanQr', { defaultValue: 'Scan WhatsApp QR code' }),
            body: name,
            tag: `session:qr:${sessionId}`,
            deepLink: '/channels',
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'session.status') {
        const status = typeof payload.status === 'string' ? payload.status : '';
        if (status !== 'disconnected' && status !== 'qr_ready' && status !== 'failed') return;
        if (!guardAdmin('session.disconnected')) return;
        const name = typeof payload.name === 'string' ? payload.name : account;
        void dispatchNotification(
          prefs,
          {
            kind: 'session.disconnected',
            title: t('desktop.notifications.sessionDisconnected', {
              defaultValue: 'WhatsApp session disconnected',
            }),
            body: name,
            tag: `session:status:${sessionId}:${status}`,
            deepLink: '/channels',
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'inbox.chat_assigned') {
        if (!guardAdmin('crm.chatAssigned')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'crm.chatAssigned',
            title: t('settings.notifications.kinds.crmChatAssigned', { defaultValue: 'Chat assigned to you' }),
            body: customer,
            tag: `crm:assigned:${followupSessionId}:${followupChatId}`,
            deepLink: inboxLink,
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'sms.status_changed') {
        const smsStatus = typeof payload.status === 'string' ? payload.status : '';
        if (smsStatus === 'failed') {
          if (!guardAdmin('sms.failed')) return;
          void dispatchNotification(
            prefs,
            {
              kind: 'sms.failed',
              title: t('systemStatus.sms.failed', { defaultValue: 'SMS provider failed' }),
              body: typeof payload.error === 'string' ? payload.error : undefined,
              tag: 'sms:failed',
              deepLink: settingsPanelHref('whatsapp-safety'),
            },
            notifyOpts,
          );
        } else if (smsStatus === 'low_balance') {
          if (!guardAdmin('sms.lowBalance')) return;
          void dispatchNotification(
            prefs,
            {
              kind: 'sms.lowBalance',
              title: t('systemStatus.sms.lowBalance', { defaultValue: 'SMS balance is low' }),
              tag: 'sms:low-balance',
              deepLink: '/channels',
            },
            notifyOpts,
          );
        }
        return;
      }

      if (event === 'storage.warning') {
        if (!guardAdmin('system.storageWarning')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'system.storageWarning',
            title: t('settings.notifications.kinds.systemStorageWarning', { defaultValue: 'Storage warning' }),
            body: typeof payload.message === 'string' ? payload.message : undefined,
            tag: 'system:storage',
            deepLink: settingsPanelHref('storage-backup'),
          },
          notifyOpts,
        );
        return;
      }

      if (event === 'sync.failed') {
        if (!guardAdmin('system.syncFailed')) return;
        void dispatchNotification(
          prefs,
          {
            kind: 'system.syncFailed',
            title: t('settings.notifications.kinds.systemSyncFailed', { defaultValue: 'Product sync failed' }),
            body: typeof payload.error === 'string' ? payload.error : undefined,
            tag: 'system:sync-failed',
            deepLink: settingsPanelHref('products'),
          },
          notifyOpts,
        );
      }
    },
  });
}
