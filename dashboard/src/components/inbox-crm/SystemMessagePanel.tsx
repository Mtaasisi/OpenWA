import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { StatusBadge } from '../workspace';
import { ConversationTypeBadgeExplicit } from './ConversationTypeBadge';
import { formatChatIdLabelI18n } from '../../pages/inbox-helpers';
import './inbox-crm.css';

export function SystemMessagePanel({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  return (
    <div className="inbox-crm-panel">
      <div className="inbox-crm-panel__body">
        <div className="inbox-typed-crm">
          <div className="inbox-typed-crm__head">
            <h3 className="inbox-typed-crm__title">{t('inbox.systemCrm.title')}</h3>
            <ConversationTypeBadgeExplicit type="system" />
          </div>
          <StatusBadge variant="neutral">{formatChatIdLabelI18n(chatId, t)}</StatusBadge>
          <p className="inbox-typed-crm__hint">
            {t('inbox.systemCrm.description', { chatId: formatChatIdLabelI18n(chatId, t) })}
          </p>
        </div>
        <div className="inbox-typed-crm__readonly" aria-hidden>
          <Settings size={28} />
        </div>
      </div>
    </div>
  );
}
