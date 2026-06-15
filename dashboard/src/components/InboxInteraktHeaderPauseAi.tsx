import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi } from '../services/api';
import { useRole } from '../hooks/useRole';
import { isGroupChat } from '../pages/inbox-helpers';

interface Props {
  sessionId: string;
  chatId: string;
  className?: string;
  iconName?: string;
  iconWeight?: number;
  appearance?: 'button' | 'menuItem';
  onMenuSelect?: () => void;
}

export function InboxInteraktHeaderPauseAi({
  sessionId,
  chatId,
  className,
  iconName,
  iconWeight = 400,
  appearance = 'button',
  onMenuSelect,
}: Props) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const qc = useQueryClient();

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', sessionId, chatId],
    queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
  });

  const mutation = useMutation({
    mutationFn: (paused: boolean) =>
      inboxApi.updateThreadCrm({ sessionId, chatId, aiAutoReplyPaused: paused }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
    },
  });

  if (isGroupChat(chatId)) return null;

  const paused = crm?.aiAutoReplyPaused ?? false;
  const label = iconName
    ? paused
      ? t('inbox.stitch.resume')
      : t('inbox.stitch.pause')
    : paused
      ? t('inbox.interakt.resumeAi')
      : t('inbox.interakt.pauseAi');

  const handleClick = () => {
    mutation.mutate(!paused);
    onMenuSelect?.();
  };

  if (appearance === 'menuItem') {
    return (
      <button
        type="button"
        role="menuitem"
        className="inbox-stitch-chat-header__mobile-item"
        disabled={!canWrite || mutation.isPending}
        onClick={handleClick}
      >
        {mutation.isPending ? (
          <MaterialSymbol name="sync" size={18} spin weight={iconWeight} />
        ) : (
          <MaterialSymbol
            name={paused ? 'play_circle' : (iconName ?? 'pause_circle')}
            size={18}
            weight={iconWeight}
          />
        )}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inbox-interakt-header-action inbox-interakt-header-action--ai-outline${className ? ` ${className}` : ''}`}
      disabled={!canWrite || mutation.isPending}
      onClick={handleClick}
    >
      {mutation.isPending ? (
        <MaterialSymbol name="sync" size={14} spin weight={iconWeight} />
      ) : iconName ? (
        <MaterialSymbol name={paused ? 'play_circle' : iconName} size={18} weight={iconWeight} />
      ) : null}
      {label}
    </button>
  );
}
