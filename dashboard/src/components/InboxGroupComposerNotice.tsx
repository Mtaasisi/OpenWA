import { useTranslation } from 'react-i18next';
import { formatChatIdLabelI18n } from '../pages/inbox-helpers';
import { MaterialSymbol } from './MaterialSymbol';
import '../components/inbox-crm/inbox-crm.css';

type Props = {
  selectedGroupMember?: string | null;
  selectedGroupMemberLabel?: string | null;
  variant?: 'default' | 'interakt';
};

export function InboxGroupComposerNotice({
  selectedGroupMember,
  selectedGroupMemberLabel,
  variant = 'default',
}: Props) {
  const { t } = useTranslation();

  const memberLabel =
    selectedGroupMemberLabel?.trim() ||
    (selectedGroupMember ? formatChatIdLabelI18n(selectedGroupMember, t) : '');

  if (variant === 'interakt') {
    if (selectedGroupMember) {
      return (
        <div
          className="inbox-group-composer-notice inbox-group-composer-notice--interakt inbox-group-composer-notice--member"
          role="status"
        >
          <MaterialSymbol name="person" size={14} aria-hidden />
          <span>{t('inbox.groupCrm.personalActionsFor', { name: memberLabel })}</span>
        </div>
      );
    }

    return (
      <p className="inbox-group-composer-notice inbox-group-composer-notice--interakt" role="note">
        <MaterialSymbol name="info" size={14} aria-hidden />
        <span>{t('inbox.groupComposer.noticeComposer')}</span>
      </p>
    );
  }

  return (
    <div className="inbox-group-composer-notice" role="note">
      {t('inbox.groupComposer.notice')}
      {selectedGroupMember ? (
        <span>
          {' '}
          {t('inbox.groupCrm.personalActionsFor', { name: memberLabel })}
        </span>
      ) : (
        <span> {t('inbox.groupComposer.personalDisabled')}</span>
      )}
    </div>
  );
}
