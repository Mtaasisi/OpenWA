import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type Props = {
  groupTitle: string;
  messageCount?: number;
  onClear: () => void;
  onOpenPrivateChat?: () => void;
};

export function GroupMemberCrmHeader({
  groupTitle,
  messageCount,
  onClear,
  onOpenPrivateChat,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="inbox-group-member-crm-header">
      <div className="inbox-group-member-crm-header__actions">
        <button type="button" className="inbox-group-member-crm-header__back" onClick={onClear}>
          <MaterialSymbol name="arrow_back" size={16} />
          {t('inbox.groupCrm.backToGroup')}
        </button>
        {onOpenPrivateChat && (
          <button
            type="button"
            className="inbox-group-member-crm-header__open-dm"
            onClick={onOpenPrivateChat}
          >
            <MaterialSymbol name="chat" size={14} />
            {t('inbox.groupCrm.openPrivateChat')}
          </button>
        )}
      </div>
      <p className="inbox-group-member-crm-header__subtitle">
        {t('inbox.groupCrm.memberFromGroup', { group: groupTitle })}
        {messageCount != null && (
          <>
            {' · '}
            {t('inbox.groupCrm.messageCount', { count: messageCount })}
          </>
        )}
      </p>
    </div>
  );
}
