import { useTranslation } from 'react-i18next';
import { inboxDeepLink } from './customers/customer-utils';
import { MaterialSymbol } from './MaterialSymbol';
import { useToast } from './Toast';
import './inbox-crm/inbox-crm.css';

type Props = {
  sessionId: string;
  groupChatId: string;
  memberId: string;
  memberLabel: string;
  messageCount?: number;
  filterActive: boolean;
  onToggleFilter: () => void;
  onClear: () => void;
  onOpenPrivateChat?: () => void;
  variant?: 'default' | 'interakt' | 'tactical';
};

export function InboxGroupMemberContextStrip({
  sessionId,
  groupChatId,
  memberId,
  memberLabel,
  messageCount,
  filterActive,
  onToggleFilter,
  onClear,
  onOpenPrivateChat,
  variant = 'default',
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const copyShareLink = async () => {
    const url = `${window.location.origin}${inboxDeepLink(sessionId, groupChatId, memberId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('inbox.copied'));
    } catch {
      toast.error(t('common.errorGeneric'));
    }
  };

  return (
    <div
      className={[
        'inbox-group-member-context-strip',
        variant !== 'default' ? `inbox-group-member-context-strip--${variant}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      <div className="inbox-group-member-context-strip__main">
        <MaterialSymbol name="person" size={14} aria-hidden />
        <span className="inbox-group-member-context-strip__label">
          {t('inbox.groupCrm.personalActionsFor', { name: memberLabel })}
          {messageCount != null && (
            <span className="inbox-group-member-context-strip__count">
              {' · '}
              {t('inbox.groupCrm.messageCount', { count: messageCount })}
            </span>
          )}
        </span>
      </div>
      <div className="inbox-group-member-context-strip__actions">
        <label className="inbox-group-member-context-strip__filter">
          <input type="checkbox" checked={filterActive} onChange={onToggleFilter} />
          <span>{t('inbox.groupCrm.filterMemberMessages')}</span>
        </label>
        <button
          type="button"
          className="inbox-group-member-context-strip__btn"
          onClick={() => void copyShareLink()}
        >
          <MaterialSymbol name="link" size={14} />
          {t('inbox.groupCrm.copyMemberLink')}
        </button>
        {onOpenPrivateChat && (
          <button
            type="button"
            className="inbox-group-member-context-strip__btn"
            onClick={onOpenPrivateChat}
          >
            <MaterialSymbol name="chat" size={14} />
            {t('inbox.groupCrm.openPrivateChat')}
          </button>
        )}
        <button
          type="button"
          className="inbox-group-member-context-strip__btn inbox-group-member-context-strip__btn--back"
          onClick={onClear}
        >
          <MaterialSymbol name="arrow_back" size={14} />
          {t('inbox.groupCrm.backToGroup')}
        </button>
      </div>
    </div>
  );
}
