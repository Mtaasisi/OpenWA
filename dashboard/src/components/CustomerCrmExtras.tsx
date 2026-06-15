import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Link2, Search } from 'lucide-react';
import {
  followupApi,
  inboxApi,
  quoteApi,
  type PipelineCard,
} from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useToast } from './Toast';

interface Props {
  card: PipelineCard;
  canWrite: boolean;
  onUpdated: () => void;
}

export function CustomerCrmExtras({ card, canWrite, onUpdated }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const hasThread = !card.isManual && card.sessionId !== 'manual';

  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [inauzwaSearch, setInauzwaSearch] = useState('');
  const debouncedInauzwa = useDebouncedValue(inauzwaSearch.trim(), 300);

  const { data: threadCrm, isLoading: crmLoading } = useQuery({
    queryKey: ['inbox', 'crm', card.sessionId, card.chatId],
    queryFn: () => inboxApi.getThreadCrm(card.sessionId, card.chatId),
    enabled: hasThread,
  });

  const { data: inauzwaMatches = [], isLoading: inauzwaLoading } = useQuery({
    queryKey: ['inauzwa', 'customers', debouncedInauzwa],
    queryFn: () => quoteApi.searchInauzwaCustomers(debouncedInauzwa),
    enabled: debouncedInauzwa.length >= 2,
  });

  const displayNote = noteDraft ?? card.crmInternalNote ?? threadCrm?.internalNote ?? '';
  const resolved = threadCrm?.resolved ?? card.crmResolved ?? false;
  const linkedId = card.inauzwaCustomerId ?? threadCrm?.linkedExternalId ?? card.customerId ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['customers'] });
    void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', card.sessionId, card.chatId] });
    onUpdated();
  };

  const saveCrm = useMutation({
    mutationFn: async (patch: {
      resolved?: boolean;
      internalNote?: string | null;
      linkedExternalId?: string | null;
      customerName?: string | null;
      customerPhone?: string | null;
    }) => {
      if (hasThread) {
        await inboxApi.updateThreadCrm({
          sessionId: card.sessionId,
          chatId: card.chatId,
          ...patch,
        });
      }
      if (patch.internalNote !== undefined) {
        await followupApi.updateConversation(card.id, { internalNote: patch.internalNote });
      }
    },
    onSuccess: () => {
      toast.success(t('customers.crmSaved'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const linkInauzwa = useMutation({
    mutationFn: async (customer: { id: string; name: string; phone: string | null }) => {
      await followupApi.updateConversation(card.id, {
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
      });
      if (hasThread) {
        await inboxApi.updateThreadCrm({
          sessionId: card.sessionId,
          chatId: card.chatId,
          linkedExternalId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
        });
      }
    },
    onSuccess: () => {
      toast.success(t('customers.inauzwaLinked'));
      setInauzwaSearch('');
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const clearInauzwaLink = useMutation({
    mutationFn: async () => {
      await followupApi.updateConversation(card.id, { customerId: null });
      if (hasThread) {
        await inboxApi.updateThreadCrm({
          sessionId: card.sessionId,
          chatId: card.chatId,
          linkedExternalId: null,
        });
      }
    },
    onSuccess: () => {
      toast.success(t('customers.inauzwaUnlinked'));
      invalidate();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  if (crmLoading && hasThread) {
    return (
      <div className="customer-crm-extras customer-crm-extras--loading">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  return (
    <div className="customer-crm-extras">
      <section className="customer-crm-extras__section">
        <h4>{t('customers.crmSection')}</h4>
        {hasThread ? (
          <label className="customer-crm-extras__check">
            <input
              type="checkbox"
              checked={resolved}
              disabled={!canWrite || saveCrm.isPending}
              onChange={e => saveCrm.mutate({ resolved: e.target.checked })}
            />
            {t('inbox.chipResolved')}
          </label>
        ) : (
          <p className="customer-crm-extras__muted">{t('customers.manualLeadCrmHint')}</p>
        )}
        <label className="pipeline-detail__field">
          {t('customers.internalNote')}
          <textarea
            rows={3}
            value={displayNote}
            disabled={!canWrite}
            onChange={e => setNoteDraft(e.target.value)}
            onBlur={() => {
              if (!canWrite) return;
              const trimmed = displayNote.trim();
              const saved = (card.crmInternalNote ?? threadCrm?.internalNote ?? '').trim();
              if (trimmed !== saved) {
                saveCrm.mutate({ internalNote: trimmed || null });
                setNoteDraft(null);
              }
            }}
          />
        </label>
        {card.crmFollowUpAt && (
          <p className="customer-crm-extras__muted">
            {t('customers.followUpAt')}: {new Date(card.crmFollowUpAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="customer-crm-extras__section">
        <h4>
          <Link2 size={14} /> {t('customers.inauzwaSection')}
        </h4>
        {linkedId ? (
          <div className="customer-crm-extras__linked">
            <span className="customer-crm-extras__linked-id">{linkedId}</span>
            {canWrite && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={clearInauzwaLink.isPending}
                onClick={() => clearInauzwaLink.mutate()}
              >
                {t('customers.unlinkInauzwa')}
              </button>
            )}
          </div>
        ) : (
          <p className="customer-crm-extras__muted">{t('customers.inauzwaNotLinked')}</p>
        )}
        {canWrite && (
          <>
            <label className="pipeline-detail__field customer-crm-extras__search">
              <Search size={14} />
              <input
                type="search"
                value={inauzwaSearch}
                onChange={e => setInauzwaSearch(e.target.value)}
                placeholder={t('customers.inauzwaSearchPlaceholder')}
              />
            </label>
            {inauzwaLoading && debouncedInauzwa.length >= 2 ? (
              <Loader2 className="animate-spin" size={16} />
            ) : null}
            {debouncedInauzwa.length >= 2 && inauzwaMatches.length > 0 && (
              <ul className="customer-crm-extras__matches">
                {inauzwaMatches.map((c: { id: string; name: string; phone: string | null }) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="customer-crm-extras__match"
                      disabled={linkInauzwa.isPending}
                      onClick={() => linkInauzwa.mutate(c)}
                    >
                      <strong>{c.name}</strong>
                      {c.phone ? <span>{c.phone}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {debouncedInauzwa.length >= 2 && !inauzwaLoading && inauzwaMatches.length === 0 && (
              <p className="customer-crm-extras__muted">{t('customers.inauzwaNoResults')}</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
