import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useToast } from '../components/Toast';
import { queryKeys } from './queries';

export function useFollowupAlerts() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const invalidateTimerRef = useRef<number | null>(null);

  const scheduleDataRefresh = () => {
    if (invalidateTimerRef.current != null) return;
    invalidateTimerRef.current = window.setTimeout(() => {
      invalidateTimerRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ['followups'] });
      void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    }, 750);
  };

  useWebSocket({
    globalEvents: [
      'followup.warning',
      'followup.escalated',
      'followup.kpi_penalty',
      'followup.autopilot_paused',
      'followup.autopilot_updated',
    ],
    onGlobalEvent: (event, sessionId, data) => {
      scheduleDataRefresh();

      if (event === 'followup.autopilot_updated') {
        void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
        void queryClient.invalidateQueries({ queryKey: ['followup', 'autopilot'] });
        if (sessionId && sessionId !== '*') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversations(sessionId) });
        }
        const action = typeof data.action === 'string' ? data.action : '';
        if (action === 'created' && data.status === 'needs_approval') {
          toast.info(t('followups.autopilot.needsApprovalToast'));
        } else if (action === 'failed') {
          toast.warning(t('followups.autopilot.failedToast'));
        }
        return;
      }

      if (event === 'followup.autopilot_paused') {
        void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
        void queryClient.invalidateQueries({ queryKey: ['followup', 'autopilot'] });
        const chatId = typeof data.chatId === 'string' ? data.chatId : '';
        if (chatId && sessionId && sessionId !== '*') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversations(sessionId) });
          void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
        }
        if (data.paused === true) {
          toast.info(t('followups.autopilot.pausedToast'));
        } else if (data.paused === false) {
          toast.success(t('followups.autopilot.resumedToast'));
        }
        return;
      }

      const customer = typeof data.customerName === 'string' ? data.customerName : null;
      const account = typeof data.sessionName === 'string' ? data.sessionName : null;
      const detail =
        customer && account
          ? `${customer} — ${account}`
          : customer ?? (typeof data.message === 'string' ? data.message : undefined);

      if (event === 'followup.warning') {
        toast.warning(t('followups.alerts.warning'), detail);
      } else if (event === 'followup.escalated') {
        toast.error(t('followups.alerts.escalated'), detail);
      } else if (event === 'followup.kpi_penalty') {
        toast.warning(t('followups.alerts.kpiPenalty'), detail);
      }
    },
  });
}
