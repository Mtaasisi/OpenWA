import { useTranslation } from 'react-i18next';
import { getConversationTypeLabel, inferConversationType, type ConversationType } from '../../lib/conversation-types';
import type { Conversation } from '../../services/api';
import './inbox-crm.css';

type Props = {
  chatId: string;
  conversation?: Conversation;
  className?: string;
};

export function ConversationTypeBadge({ chatId, conversation, className = '' }: Props) {
  const { t } = useTranslation();
  const type = inferConversationType(chatId, conversation);
  if (type === 'direct_customer' || type === 'group') return null;

  return (
    <span
      className={`inbox-crm-type-badge inbox-crm-type-badge--${type} ${className}`.trim()}
      title={getConversationTypeLabel(type, t)}
    >
      {getConversationTypeLabel(type, t)}
    </span>
  );
}

export function ConversationTypeBadgeExplicit({
  type,
  className = '',
}: {
  type: ConversationType;
  className?: string;
}) {
  const { t } = useTranslation();
  if (type === 'direct_customer') return null;
  return (
    <span className={`inbox-crm-type-badge inbox-crm-type-badge--${type} ${className}`.trim()}>
      {getConversationTypeLabel(type, t)}
    </span>
  );
}
