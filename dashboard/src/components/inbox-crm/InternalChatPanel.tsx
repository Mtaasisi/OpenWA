import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { EmptyState } from '../workspace';
import { ConversationTypeBadgeExplicit } from './ConversationTypeBadge';
import './inbox-crm.css';

export function InternalChatPanel() {
  const { t } = useTranslation();
  return (
    <div className="inbox-crm-panel">
      <div className="inbox-crm-panel__body">
        <div className="inbox-typed-crm">
          <div className="inbox-typed-crm__head">
            <h3 className="inbox-typed-crm__title">{t('inbox.internalCrm.title')}</h3>
            <ConversationTypeBadgeExplicit type="internal" />
          </div>
          <p className="inbox-typed-crm__hint">{t('inbox.internalCrm.description')}</p>
        </div>
        <EmptyState
          icon={<Link2 size={32} />}
          title={t('inbox.internalCrm.title')}
          description={t('inbox.internalCrm.description')}
        />
      </div>
    </div>
  );
}
