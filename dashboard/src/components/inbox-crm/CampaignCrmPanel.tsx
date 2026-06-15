import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import type { Conversation } from '../../services/api';
import { EmptyState } from '../workspace';
import { ConversationTypeBadgeExplicit } from './ConversationTypeBadge';
import { formatChatIdLabelI18n } from '../../pages/inbox-helpers';
import './inbox-crm.css';

export function CampaignCrmPanel({
  chatId,
  conversation,
}: {
  chatId: string;
  conversation?: Conversation;
}) {
  const { t } = useTranslation();
  const label = formatChatIdLabelI18n(chatId, t);
  const isBroadcastList = conversation?.lastInboundBroadcast === true;
  return (
    <div className="inbox-crm-panel">
      <div className="inbox-crm-panel__body">
        <div className="inbox-typed-crm">
          <div className="inbox-typed-crm__head">
            <h3 className="inbox-typed-crm__title">{t('inbox.campaignCrm.title')}</h3>
            <ConversationTypeBadgeExplicit type="broadcast" />
          </div>
          <p className="inbox-typed-crm__hint">
            {isBroadcastList
              ? t('inbox.campaignCrm.broadcastListHint', { chatId: label })
              : label}
          </p>
        </div>
        <EmptyState
          icon={<Megaphone size={32} />}
          title={t('inbox.campaignCrm.title')}
          description={
            isBroadcastList
              ? t('inbox.campaignCrm.broadcastListDescription', { chatId: label })
              : t('inbox.campaignCrm.description', { chatId: label })
          }
        />
      </div>
    </div>
  );
}
