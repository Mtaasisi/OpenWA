import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useToast } from '../components/Toast';
import { queryKeys } from './queries';

export function useInboxAiAlerts() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  useWebSocket({
    subscribeAllSessions: true,
    globalEvents: ['ai.escalated', 'ai.opt_out'],
    onGlobalEvent: (event, sessionId, data) => {
      if (event !== 'ai.escalated' && event !== 'ai.opt_out') return;
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
      if (sessionId && sessionId !== '*') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversations(sessionId) });
      }
      const chatId = typeof data.chatId === 'string' ? data.chatId : '';
      if (chatId && sessionId) {
        void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      }
      if (event === 'ai.opt_out') {
        toast.info(t('inbox.aiOptOutToast'), chatId || undefined);
      } else {
        toast.warning(t('inbox.aiEscalatedToast'), chatId || undefined);
      }
    },
  });
}
