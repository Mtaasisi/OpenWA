import { useTranslation } from 'react-i18next';
import type { Conversation } from '../services/api';
import { conversationListCrmBadges } from '../pages/inbox-helpers';

interface Props {
  conv: Conversation;
  className?: string;
  /** Render badge spans only (for embedding inside an existing chips row). */
  inline?: boolean;
  /** Slim badges for conversation list rows (hide assignee / priority noise). */
  listRow?: boolean;
}

function CrmBadgeSpans({ badges }: { badges: ReturnType<typeof conversationListCrmBadges> }) {
  return (
    <>
      {badges.map(badge => (
        <span
          key={badge.key}
          className={`inbox-list-badge inbox-list-badge--${badge.tone}`}
          title={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </>
  );
}

export function InboxConversationCrmBadges({
  conv,
  className = 'inbox-conversation-chips',
  inline = false,
  listRow = false,
}: Props) {
  const { t } = useTranslation();
  const badges = conversationListCrmBadges(conv, t, { listRow });
  if (badges.length === 0) return null;
  if (inline) return <CrmBadgeSpans badges={badges} />;

  return (
    <div className={className}>
      <CrmBadgeSpans badges={badges} />
    </div>
  );
}
