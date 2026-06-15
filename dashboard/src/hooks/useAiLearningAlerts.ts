import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useToast } from '../components/Toast';
import { queryKeys } from './queries';

export function useAiLearningAlerts(enabled = true) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  useWebSocket({
    subscribeAllSessions: enabled,
    globalEvents: enabled
      ? [
      'ai.learning.pending',
      'ai.learning.repeated',
      'product.demand.spike',
      'knowledge.needs_review',
        ]
      : [],
    onGlobalEvent: (event, _sessionId, data) => {
      if (!enabled) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiLearningAlerts });
      void queryClient.invalidateQueries({ queryKey: ['ai-learning'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-training'] });
      void queryClient.invalidateQueries({ queryKey: ['product-demand'] });

      if (event === 'ai.learning.pending') {
        const q = typeof data.question === 'string' ? data.question.slice(0, 60) : '';
        toast.info(
          t('ai.learning.toast.pending', {
            defaultValue: 'New question for AI Training Center',
          }),
          q
            ? `${q}… — open AI → Training to review`
            : 'Open AI → Training to review',
        );
      } else if (event === 'ai.learning.repeated') {
        toast.warning(
          t('ai.learning.toast.repeated', {
            defaultValue: 'Repeated unknown question — teach AI',
          }),
        );
      } else if (event === 'product.demand.spike') {
        toast.info(
          t('ai.learning.toast.demandSpike', {
            defaultValue: 'High product demand detected',
          }),
        );
      }
    },
  });
}
