import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { EmptyState, StatusBadge } from '../workspace';
import { ConversationTypeBadgeExplicit } from './ConversationTypeBadge';
import { getConversationTitle } from '../../pages/inbox-helpers';
import type { Conversation } from '../../services/api';
import './inbox-crm.css';

type Props = {
  chatId: string;
  conversation?: Conversation;
};

export function SpamPanel({ chatId, conversation }: Props) {
  const { t } = useTranslation();
  const title = conversation ? getConversationTitle(conversation) : chatId;
  const isMarkedSpam =
    conversation?.outcome === 'spam' || conversation?.stage === 'spam';

  return (
    <div className="inbox-crm-panel">
      <div className="inbox-crm-panel__body">
        <div className="inbox-typed-crm">
          <div className="inbox-typed-crm__head">
            <h3 className="inbox-typed-crm__title">{title}</h3>
            <ConversationTypeBadgeExplicit type="spam" />
          </div>
          {isMarkedSpam && (
            <StatusBadge variant="error">{t('inbox.spamCrm.markedAsSpam')}</StatusBadge>
          )}
          {(conversation?.stage || conversation?.outcome) && (
            <dl className="inbox-typed-crm__meta">
              {conversation.stage && (
                <>
                  <dt>{t('inbox.spamCrm.stageLabel')}</dt>
                  <dd>{conversation.stage}</dd>
                </>
              )}
              {conversation.outcome && (
                <>
                  <dt>{t('inbox.spamCrm.outcomeLabel')}</dt>
                  <dd>{conversation.outcome}</dd>
                </>
              )}
            </dl>
          )}
          <p className="inbox-typed-crm__hint">{t('inbox.spamCrm.reviewHint')}</p>
        </div>
        <EmptyState
          icon={<ShieldAlert size={32} />}
          title={t('inbox.spamCrm.title')}
          description={t('inbox.spamCrm.description')}
        />
      </div>
    </div>
  );
}
