import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, MessageSquare } from 'lucide-react';
import {
  followupApi,
  type PipelineCard,
  type ConversationStage,
} from '../services/api';
import { useToast } from './Toast';
import { InboxLeadOutcomeActions } from './InboxLeadOutcomeActions';
import { LeadSourceBadge } from './LeadSourceBadge';
import { LeadSourceSelect } from './LeadSourceSelect';
import { useFollowupPermissions } from '../hooks/useFollowupPermissions';
import { CustomerCrmExtras } from './CustomerCrmExtras';
import { CustomerHistoryPanel } from './CustomerHistoryPanel';
import { CustomerProfilePanel } from './CustomerProfilePanel';
import { ModalOverlay } from './ModalOverlay';
import { SendSmsModal } from './SendSmsModal';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import type { ConversationSource } from '../services/api';
import { isAiEscalationPipelineCard, isGroupLeadPipelineCard, inboxLink } from './customers/customer-utils';
import { pipelineStageLabelFull } from '../pages/inbox-helpers';

const STAGES: ConversationStage[] = [
  'new_lead', 'contacted', 'needs_identified', 'product_suggested', 'price_sent',
  'negotiating', 'waiting_customer_reply', 'followup_needed', 'payment_pending',
  'won', 'lost', 'dead_no_response',
];

interface Props {
  card: PipelineCard;
  canWrite: boolean;
  onClose: () => void;
  /** Show inbox CRM + INAUZWA linking (Customers page). */
  showCustomerExtras?: boolean;
  onSelectConversation?: (card: PipelineCard) => void;
}

export function PipelineLeadDetail({
  card,
  canWrite,
  onClose,
  showCustomerExtras = false,
  onSelectConversation,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAiEscalation = isAiEscalationPipelineCard(card);
  const isGroupLead = isGroupLeadPipelineCard(card);
  const chatLink = inboxLink(card);

  const { data: conversation, isLoading, refetch } = useQuery({
    queryKey: ['followups', 'conversation', card.id],
    queryFn: () => followupApi.getConversationById(card.id),
    enabled: !isAiEscalation,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
  });

  const { canEditLeadSource } = useFollowupPermissions();
  const { isSmsReady } = useLinkedChannels();
  const [smsOpen, setSmsOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    void queryClient.invalidateQueries({ queryKey: ['followups'] });
    void queryClient.invalidateQueries({ queryKey: ['customers'] });
    void refetch();
  };

  const setStage = useMutation({
    mutationFn: (stage: ConversationStage) =>
      followupApi.setStage(card.id, stage, card.sessionId, card.chatId),
    onSuccess: () => {
      toast.success(t('pipeline.stageUpdated'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const assign = useMutation({
    mutationFn: (staffId: string | null) => followupApi.assignConversation(card.id, staffId),
    onSuccess: (_data, staffId) => {
      toast.success(staffId ? t('pipeline.assigned') : t('pipeline.unassignedDone'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const setSource = useMutation({
    mutationFn: (source: ConversationSource) => followupApi.setLeadSource(card.id, source),
    onSuccess: () => {
      toast.success(t('leadSources.updated'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  return (
    <ModalOverlay onClose={onClose} className="pipeline-modal-overlay">
      <div className="pipeline-modal pipeline-detail" onClick={e => e.stopPropagation()}>
        <header className="pipeline-detail__header">
          <h3>{card.customerName || card.customerHandle || card.customerPhone || t('pipeline.unnamed')}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>

        {isAiEscalation ? (
          <>
            <div className="pipeline-detail__meta">
              <span className="pipeline-detail__ai-escalation">
                {pipelineStageLabelFull(card.stage, t)}
              </span>
              {card.productInterest && !isGroupLead && <span>{card.productInterest}</span>}
            </div>
            {isGroupLead && card.nextAction ? (
              <p className="pipeline-detail__hint pipeline-detail__group-lead-msg">
                {card.nextAction}
              </p>
            ) : (
              <p className="pipeline-detail__hint">{t('inbox.aiEscalatedHint')}</p>
            )}
            {chatLink && (
              <Link to={chatLink} className="fu-btn fu-btn--primary pipeline-detail__open-chat">
                <MessageSquare size={14} /> {t('followups.openInbox')}
              </Link>
            )}
          </>
        ) : isLoading || !conversation ? (
          <div className="pipeline-loading"><Loader2 className="animate-spin" size={24} /></div>
        ) : (
          <>
            <div className="pipeline-detail__meta">
              <LeadSourceBadge source={conversation.source} />
              <span>{pipelineStageLabelFull(conversation.stage, t)}</span>
              {card.productInterest && <span>{card.productInterest}</span>}
            </div>

            {conversation.linkedSaleId && (
              <div className="pipeline-detail__sale">
                <strong>{t('pipeline.linkedSale')}</strong>
                <span className="pipeline-detail__sale-id">{conversation.linkedSaleId}</span>
                <LeadSourceBadge source={conversation.source} />
              </div>
            )}

            {canWrite && canEditLeadSource && (
              <label className="pipeline-detail__field">
                {t('leadSources.label')}
                <LeadSourceSelect
                  value={conversation.source as ConversationSource}
                  disabled={setSource.isPending}
                  onChange={src => setSource.mutate(src)}
                />
              </label>
            )}

            {canWrite && (
              <>
                <label className="pipeline-detail__field">
                  {t('followups.stage')}
                  <select
                    value={conversation.stage}
                    disabled={setStage.isPending}
                    onChange={e => setStage.mutate(e.target.value as ConversationStage)}
                  >
                    {STAGES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="pipeline-detail__field">
                  {t('pipeline.assignStaff')}
                  <select
                    value={conversation.assignedStaffId ?? ''}
                    disabled={assign.isPending}
                    onChange={e => assign.mutate(e.target.value || null)}
                  >
                    <option value="">{t('pipeline.unassigned')}</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {showCustomerExtras && (
              <>
                <CustomerProfilePanel
                  card={card}
                  onOpenConversation={onSelectConversation}
                />
                <CustomerCrmExtras card={card} canWrite={canWrite} onUpdated={invalidate} />
                <CustomerHistoryPanel card={card} />
              </>
            )}

            <InboxLeadOutcomeActions
              conversation={conversation}
              canWrite={canWrite}
              onUpdated={invalidate}
            />

            {canWrite && isSmsReady && conversation.customerPhone && (
              <button
                type="button"
                className="fu-btn fu-btn--secondary pipeline-detail__sms"
                onClick={() => setSmsOpen(true)}
              >
                <MessageSquare size={14} /> {t('sms.send')}
              </button>
            )}
          </>
        )}
      </div>
      <SendSmsModal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        defaultPhone={conversation?.customerPhone ?? card.customerPhone ?? ''}
        customerId={conversation?.customerId ?? card.customerId ?? undefined}
        conversationId={conversation?.id ?? card.id}
        relatedType="customer"
        relatedId={conversation?.id}
      />
    </ModalOverlay>
  );
}
