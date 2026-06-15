import { useQuery } from '@tanstack/react-query';
import { followupApi } from '../services/api';

export function useFollowupHistory(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['followups', 'history', conversationId],
    queryFn: () => followupApi.getHistory(conversationId!),
    enabled: !!conversationId,
  });
}
