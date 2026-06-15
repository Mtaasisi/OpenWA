import { useTranslation } from 'react-i18next';
import { InboxContactAvatar } from '../InboxContactAvatar';
import { getChatKind } from '../../pages/inbox-helpers';
import type { PipelineCard } from '../../services/api';
import { customerInitials, displayName } from './customer-utils';

type Props = {
  card: PipelineCard;
  sessionStatus?: string;
  variant?: 'table' | 'card';
};

export function CustomerRowAvatar({ card, sessionStatus, variant = 'table' }: Props) {
  const { t } = useTranslation();
  const title = displayName(card, t('pipeline.unnamed'), t);
  const isManual = card.isManual || card.sessionId === 'manual' || !card.chatId?.trim();

  if (isManual) {
    return (
      <div className={variant === 'table' ? 'fu-table__avatar' : 'pipeline-card__avatar fu-table__avatar'}>
        {customerInitials(card, t)}
      </div>
    );
  }

  const avatarClass =
    variant === 'table'
      ? 'fu-table__avatar inbox-avatar inbox-avatar--private customer-row-avatar'
      : 'pipeline-card__avatar fu-table__avatar inbox-avatar inbox-avatar--private customer-row-avatar';

  return (
    <InboxContactAvatar
      sessionId={card.sessionId}
      chatId={card.chatId}
      chatKind={getChatKind(card.chatId)}
      title={title}
      sessionStatus={sessionStatus}
      className={avatarClass}
      fetchWhenVisible={variant === 'table'}
      preferProxy={variant === 'table'}
    />
  );
}
