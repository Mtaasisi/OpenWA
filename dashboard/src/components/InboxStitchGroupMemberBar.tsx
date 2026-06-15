import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';

type Props = {
  groupTitle: string;
  messageCount?: number;
  onBack: () => void;
  onOpenPrivateChat?: () => void;
};

export function InboxStitchGroupMemberBar({
  groupTitle,
  messageCount,
  onBack,
  onOpenPrivateChat,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="inbox-stitch-group-member-bar">
      <button type="button" className="inbox-stitch-group-member-bar__back" onClick={onBack}>
        <MaterialSymbol name="arrow_back" size={16} />
        <span className="inbox-stitch-group-member-bar__back-label">{groupTitle}</span>
      </button>
      <div className="inbox-stitch-group-member-bar__meta">
        {messageCount != null ? (
          <span className="inbox-stitch-group-member-bar__count">
            {t('inbox.groupCrm.messageCount', { count: messageCount })}
          </span>
        ) : null}
        {onOpenPrivateChat ? (
          <button type="button" className="inbox-stitch-group-member-bar__dm" onClick={onOpenPrivateChat}>
            {t('inbox.groupCrm.openPrivateChat')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
