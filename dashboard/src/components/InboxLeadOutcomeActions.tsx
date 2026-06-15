import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followupApi, type FollowupConversation } from '../services/api';
import { useToast } from './Toast';

const LOST_REASONS = [
  'price_too_high', 'customer_comparing', 'out_of_stock', 'needs_installment',
  'customer_will_return', 'stopped_replying', 'bought_elsewhere', 'wrong_product_match',
  'no_budget', 'delivery_issue', 'staff_failed_followup', 'followup_failed', 'other',
] as const;

interface Props {
  conversation: FollowupConversation;
  canWrite: boolean;
  onUpdated?: () => void;
  className?: string;
}

export function InboxLeadOutcomeActions({ conversation, canWrite, onUpdated, className }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showLost, setShowLost] = useState(false);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [lostNotes, setLostNotes] = useState('');
  const [alternativeOffered, setAlternativeOffered] = useState(false);
  const [customerRefusedFollowup, setCustomerRefusedFollowup] = useState(false);
  const [saleId, setSaleId] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['followups'] });
    void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    onUpdated?.();
  };

  const closeLost = useMutation({
    mutationFn: () =>
      followupApi.closeLost(conversation.id, {
        lostReason,
        lostNotes,
        alternativeOffered,
        customerRefusedFollowup,
      }),
    onSuccess: () => {
      setShowLost(false);
      toast.success(t('pipeline.closedLost'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('pipeline.closeLostFailed'), err.message),
  });

  const markWon = useMutation({
    mutationFn: () => followupApi.markWon(conversation.id, saleId.trim() || undefined),
    onSuccess: () => {
      toast.success(t('pipeline.markedWon'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const linkSale = useMutation({
    mutationFn: () => followupApi.linkSale(conversation.id, { saleId: saleId.trim() }),
    onSuccess: () => {
      toast.success(t('pipeline.saleLinked'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  if (!canWrite) return null;

  return (
    <div className={className}>
      <div className="inbox-lead-outcome__actions">
        <button type="button" className="inbox-crm-action-btn" onClick={() => markWon.mutate()} disabled={markWon.isPending}>
          {t('pipeline.markWon')}
        </button>
        <button type="button" className="inbox-crm-action-btn inbox-crm-action-btn--ghost" onClick={() => setShowLost(v => !v)}>
          {t('pipeline.closeLost')}
        </button>
      </div>
      <label className="inbox-crm-field">
        {t('pipeline.linkSaleId')}
        <div className="inbox-lead-outcome__link">
          <input value={saleId} onChange={e => setSaleId(e.target.value)} placeholder="SALE-123" />
          <button type="button" className="inbox-crm-action-btn" disabled={!saleId.trim() || linkSale.isPending} onClick={() => linkSale.mutate()}>
            {t('pipeline.linkSale')}
          </button>
        </div>
      </label>
      {showLost && (
        <div className="inbox-lead-outcome__lost">
          <label>
            {t('pipeline.lostReason')}
            <select value={lostReason} onChange={e => setLostReason(e.target.value)}>
              {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>
            {t('pipeline.notes')}
            <textarea rows={2} value={lostNotes} onChange={e => setLostNotes(e.target.value)} required />
          </label>
          <label className="inbox-lead-outcome__check">
            <input type="checkbox" checked={alternativeOffered} onChange={e => setAlternativeOffered(e.target.checked)} />
            {t('pipeline.alternativeOffered')}
          </label>
          <label className="inbox-lead-outcome__check">
            <input type="checkbox" checked={customerRefusedFollowup} onChange={e => setCustomerRefusedFollowup(e.target.checked)} />
            {t('pipeline.customerRefusedFollowup')}
          </label>
          <button type="button" className="inbox-crm-action-btn" disabled={!lostNotes.trim() || closeLost.isPending} onClick={() => closeLost.mutate()}>
            {t('pipeline.confirmCloseLost')}
          </button>
        </div>
      )}
    </div>
  );
}
