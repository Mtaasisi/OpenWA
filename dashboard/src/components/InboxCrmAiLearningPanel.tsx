import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Loader2 } from 'lucide-react';
import { inboxApi, type InboxThreadCrm } from '../services/api';
import { useToast } from './Toast';

interface InboxCrmAiLearningPanelProps {
  crm: InboxThreadCrm | null | undefined;
  sessionId: string;
  chatId: string;
  canWrite: boolean;
}

export function InboxCrmAiLearningPanel({
  crm,
  sessionId,
  chatId,
  canWrite,
}: InboxCrmAiLearningPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [city, setCity] = useState(crm?.confirmedCity ?? '');
  const [branchId, setBranchId] = useState(crm?.preferredBranchId ?? '');
  const [buyingPreferences, setBuyingPreferences] = useState(crm?.buyingPreferences ?? '');

  useEffect(() => {
    setCity(crm?.confirmedCity ?? '');
    setBranchId(crm?.preferredBranchId ?? '');
    setBuyingPreferences(crm?.buyingPreferences ?? '');
  }, [crm?.confirmedCity, crm?.preferredBranchId, crm?.buyingPreferences]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof inboxApi.updateThreadCrm>[0]) =>
      inboxApi.updateThreadCrm(payload),
    onSuccess: () => {
      toast.success(t('inbox.aiLearning.saved'));
      void qc.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!crm) return null;

  return (
    <section className="inbox-crm-section inbox-crm-ai-learning">
      <h4 className="inbox-crm-section__title">
        <Brain size={16} aria-hidden />
        {t('inbox.aiLearning.title')}
      </h4>
      <dl className="inbox-crm-ai-learning__grid">
        <div>
          <dt>{t('inbox.aiLearning.confirmedCity')}</dt>
          <dd>
            {canWrite ? (
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Dar / Arusha"
              />
            ) : (
              crm.confirmedCity ?? '—'
            )}
          </dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.branchId')}</dt>
          <dd>
            {canWrite ? (
              <input value={branchId} onChange={e => setBranchId(e.target.value)} />
            ) : (
              crm.preferredBranchId ?? '—'
            )}
          </dd>
        </div>
        <div className="inbox-crm-ai-learning__full">
          <dt>{t('inbox.aiLearning.buyingPreferences')}</dt>
          <dd>
            {canWrite ? (
              <textarea
                className="inbox-crm-ai-learning__textarea"
                rows={2}
                value={buyingPreferences}
                onChange={e => setBuyingPreferences(e.target.value)}
                placeholder={t('inbox.aiLearning.buyingPreferencesPlaceholder')}
              />
            ) : (
              crm.buyingPreferences ?? '—'
            )}
          </dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.lastInterest')}</dt>
          <dd>{crm.lastProductInterest ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.lastIntent')}</dt>
          <dd>{crm.lastIntent ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.discountCount')}</dt>
          <dd>{crm.discountRequestCount ?? 0}</dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.discountNegotiator')}</dt>
          <dd>
            {crm.discountNegotiationMarked
              ? t('inbox.aiLearning.discountNegotiatorHint')
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.paymentReadiness')}</dt>
          <dd>{crm.paymentReadiness ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('inbox.aiLearning.autopilot')}</dt>
          <dd>
            {crm.aiAutoReplyPaused
              ? crm.autopilotPauseReason ?? t('inbox.aiLearning.paused')
              : t('inbox.aiLearning.active')}
          </dd>
        </div>
      </dl>
      {canWrite && (
        <div className="inbox-crm-ai-learning__actions">
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                sessionId,
                chatId,
                confirmedCity: city.trim() || null,
                preferredBranchId: branchId.trim() || null,
                buyingPreferences: buyingPreferences.trim() || null,
              })
            }
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
            {t('inbox.aiLearning.saveLocation')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                sessionId,
                chatId,
                buyingPreferences: buyingPreferences.trim() || null,
              })
            }
          >
            {t('inbox.aiLearning.savePreferences')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                sessionId,
                chatId,
                discountNegotiationMarked: !crm.discountNegotiationMarked,
              })
            }
          >
            {crm.discountNegotiationMarked
              ? t('inbox.aiLearning.clearDiscountNegotiator')
              : t('inbox.aiLearning.markDiscountNegotiator')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({ sessionId, chatId, paymentReadiness: 'ready' })
            }
          >
            {t('inbox.aiLearning.markPaymentReady')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ sessionId, chatId, clearAiMemory: true })}
          >
            {t('inbox.aiLearning.clearMemory')}
          </button>
        </div>
      )}
      <p className="settings-hint" style={{ marginTop: '0.5rem' }}>
        {t('inbox.aiLearning.locationHint')}
      </p>
    </section>
  );
}
