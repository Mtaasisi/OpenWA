import { useTranslation } from 'react-i18next';
import { InboxContactAvatar } from './InboxContactAvatar';

type Props = {
  sessionId: string;
  sessionStatus?: string;
  memberId: string;
  memberLabel: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  avatarClassName?: string;
  fetchWhenVisible?: boolean;
};

export function InboxGroupMemberAvatar({
  sessionId,
  sessionStatus,
  memberId,
  memberLabel,
  selected = false,
  onClick,
  className = '',
  avatarClassName = 'inbox-interakt-bubble-avatar inbox-avatar inbox-avatar--private',
  fetchWhenVisible = true,
}: Props) {
  const { t } = useTranslation();

  const avatar = (
    <InboxContactAvatar
      sessionId={sessionId}
      chatId={memberId}
      chatKind="private"
      title={memberLabel}
      sessionStatus={sessionStatus}
      className={avatarClassName}
      preferProxy
      fetchWhenVisible={fetchWhenVisible}
    />
  );

  if (!onClick) {
    return <span className={['inbox-group-member-avatar', className].filter(Boolean).join(' ')}>{avatar}</span>;
  }

  return (
    <button
      type="button"
      className={[
        'inbox-group-member-avatar-btn',
        selected ? 'inbox-group-member-avatar-btn--selected' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={t('inbox.groupCrm.viewMember360', { name: memberLabel })}
      title={memberLabel}
    >
      {avatar}
    </button>
  );
}
