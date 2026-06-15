import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { contactApi } from '../services/api';

interface Props {
  sessionId: string;
  chatId: string;
  sessionStatus?: string;
  className?: string;
}

export function InboxContactPresenceDot({
  sessionId,
  chatId,
  sessionStatus,
  className = 'inbox-interakt-crm-profile-hero__status',
}: Props) {
  const { t } = useTranslation();
  const sessionReady = sessionStatus === 'ready';

  const { data: presence, isError, error } = useQuery({
    queryKey: ['inbox', 'contact-presence', sessionId, chatId],
    queryFn: () => contactApi.getContactPresence(sessionId, chatId),
    enabled: sessionReady && Boolean(sessionId && chatId),
    staleTime: 15_000,
    refetchInterval: sessionReady ? 30_000 : false,
    retry: false,
  });

  const isOnline = presence?.state === 'online';
  const label = isError
    ? t('inbox.contactPresenceFetchFailed')
    : presence?.state === 'online'
      ? t('inbox.contactOnline')
      : presence?.state === 'offline'
        ? t('inbox.contactOffline')
        : t('inbox.contactPresenceUnknown');

  return (
    <span
      className={`${className}${isOnline ? ' is-online' : ''}`}
      title={isError && error instanceof Error ? `${label}: ${error.message}` : label}
      aria-label={label}
    />
  );
}
