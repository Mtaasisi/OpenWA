import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { sessionApi, type InboxMessage } from '../services/api';
import {
  extractGroupParticipantsFromMessages,
  mergeGroupParticipants,
} from '../lib/group-participants';

export function useGroupParticipants(
  sessionId: string | undefined,
  groupId: string | undefined,
  recentMessages: InboxMessage[],
  sessionStatus?: string,
  enabled = true,
) {
  const { t } = useTranslation();

  const fromMessages = useMemo(
    () => extractGroupParticipantsFromMessages(recentMessages, t),
    [recentMessages, t],
  );

  const canFetch = enabled && !!sessionId && !!groupId && sessionStatus === 'ready';

  const { data: groupInfo, isLoading, isError } = useQuery({
    queryKey: ['groups', 'info', sessionId, groupId],
    queryFn: () => sessionApi.getGroupInfo(sessionId!, groupId!),
    enabled: canFetch,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const participants = useMemo(
    () => mergeGroupParticipants(fromMessages, groupInfo?.participants ?? [], t),
    [fromMessages, groupInfo?.participants, t],
  );

  return {
    participants,
    fromMessages,
    groupInfo,
    isLoading: canFetch && isLoading,
    rosterLoaded: Boolean(groupInfo?.participants?.length),
    rosterError: isError,
  };
}
