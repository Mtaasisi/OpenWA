import { useTranslation } from 'react-i18next';
import type { ConversationStage } from '../services/api';
import type { FollowupConversation } from '../services/api';
import { InboxLeadOutcomeActions } from './InboxLeadOutcomeActions';
import { LeadSourceSelect } from './LeadSourceSelect';
import { LeadSourceBadge } from './LeadSourceBadge';
import type { ConversationSource } from '../services/api';

const PIPELINE_STAGES: ConversationStage[] = [
  'new_lead',
  'contacted',
  'needs_identified',
  'product_suggested',
  'price_sent',
  'negotiating',
  'waiting_customer_reply',
  'followup_needed',
  'payment_pending',
  'won',
  'lost',
  'dead_no_response',
];

interface FollowupHistoryItem {
  id: string;
  mode: string;
  outcome?: string | null;
  createdAt?: string | null;
}

interface Props {
  followupConv: FollowupConversation | undefined;
  followupHistory: FollowupHistoryItem[];
  canWrite: boolean;
  canEditLeadSource: boolean;
  stagePending: boolean;
  leadSourcePending: boolean;
  onStageChange: (stage: ConversationStage) => void;
  onLeadSourceChange: (source: ConversationSource) => void;
  onFollowupUpdated: () => void;
  formatTime: (iso: string) => string;
  variant?: 'interakt' | 'classic' | 'tactical';
  showMarkAsLead?: boolean;
  stageSelectId?: string;
}

/** Shared follow-up lead source, stage, history, and outcome actions. */
export function InboxCrmLeadFields({
  followupConv,
  followupHistory,
  canWrite,
  canEditLeadSource,
  stagePending,
  leadSourcePending,
  onStageChange,
  onLeadSourceChange,
  onFollowupUpdated,
  formatTime,
  variant = 'classic',
  showMarkAsLead = false,
  stageSelectId = 'crm-followup-stage',
}: Props) {
  const { t } = useTranslation();

  if (!followupConv) {
    return (
      <p className={variant === 'tactical' ? 'tac-gear-hint' : 'inbox-crm-muted'}>
        {variant === 'interakt'
          ? t('inbox.interakt.leadAfterFirstMessage')
          : t('common.loading')}
      </p>
    );
  }

  const fieldClass = variant === 'tactical' ? 'tac-crm-field' : 'inbox-crm-field';
  const historyClass =
    variant === 'tactical'
      ? 'tac-followup-history'
      : variant === 'interakt'
        ? 'inbox-crm-followup-history'
        : 'inbox-crm-followup-history';

  return (
    <>
      <div className={fieldClass}>
        <label htmlFor={`${stageSelectId}-source`}>{t('leadSources.label')}</label>
        {canEditLeadSource && canWrite ? (
          <LeadSourceSelect
            value={followupConv.source as ConversationSource}
            disabled={leadSourcePending}
            onChange={onLeadSourceChange}
            className={variant === 'tactical' ? 'tac-input' : undefined}
          />
        ) : (
          <LeadSourceBadge source={followupConv.source} />
        )}
      </div>
      <div className={fieldClass}>
        <label htmlFor={stageSelectId}>{t('followups.stage')}</label>
        <select
          id={stageSelectId}
          className={variant === 'tactical' ? 'tac-input' : undefined}
          value={followupConv.stage}
          disabled={!canWrite || stagePending}
          onChange={e => onStageChange(e.target.value as ConversationStage)}
        >
          {PIPELINE_STAGES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {showMarkAsLead && (
        <button
          type="button"
          className="inbox-interakt-crm-quick-actions__btn inbox-interakt-crm-quick-actions__btn--outline"
          disabled={!canWrite || stagePending}
          onClick={() => onStageChange('new_lead')}
        >
          {t('inbox.interakt.markAsLead')}
        </button>
      )}
      {followupHistory.length > 0 && (
        <ul className={historyClass}>
          {followupHistory.slice(0, variant === 'interakt' ? 5 : 5).map(h => (
            <li key={h.id}>
              {variant === 'tactical' ? (
                <>
                  <span>{h.mode}</span>
                  {h.outcome && <span> · {h.outcome}</span>}
                  <time>{h.createdAt ? formatTime(h.createdAt) : ''}</time>
                </>
              ) : (
                <>
                  {h.mode}
                  {h.outcome ? ` · ${h.outcome}` : ''} — {h.createdAt ? formatTime(h.createdAt) : ''}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <InboxLeadOutcomeActions
        conversation={followupConv}
        canWrite={canWrite}
        onUpdated={onFollowupUpdated}
        className={fieldClass}
      />
    </>
  );
}
