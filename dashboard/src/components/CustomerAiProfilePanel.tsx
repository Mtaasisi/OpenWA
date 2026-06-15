import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { customerProfileApi } from '../services/api';
import { useToast } from './Toast';

interface Props {
  sessionId: string;
  chatId: string;
}

export function CustomerAiProfilePanel({ sessionId, chatId }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-profile', sessionId, chatId],
    queryFn: () => customerProfileApi.getEnrichment(sessionId, chatId),
    enabled: Boolean(sessionId && chatId),
  });

  const approveName = useMutation({
    mutationFn: () =>
      customerProfileApi.patchEnrichment(data!.id, { nameNeedsReview: false }),
    onSuccess: () => {
      toast.success(t('customers.aiProfile.approved', { defaultValue: 'Name approved' }));
      void qc.invalidateQueries({ queryKey: ['customer-profile', sessionId, chatId] });
    },
  });

  if (isLoading) {
    return (
      <div className="customer-ai-profile customer-ai-profile--loading">
        <Loader2 className="animate-spin" size={16} />
      </div>
    );
  }

  if (!data) return null;

  const displayName = data.preferredName ?? data.crm?.customerName ?? '—';

  return (
    <section className="customer-ai-profile">
      <h4>{t('customers.aiProfile.title', { defaultValue: 'AI Profile Learning' })}</h4>
      <dl className="customer-ai-profile__grid">
        <div>
          <dt>{t('customers.aiProfile.name', { defaultValue: 'Name' })}</dt>
          <dd>{displayName}</dd>
        </div>
        <div>
          <dt>{t('customers.aiProfile.confidence', { defaultValue: 'Confidence' })}</dt>
          <dd>
            {data.nameConfidenceScore != null
              ? `${Math.round(data.nameConfidenceScore * 100)}%`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('customers.aiProfile.completeness', { defaultValue: 'Completeness' })}</dt>
          <dd>{data.profileCompleteness ?? 0}%</dd>
        </div>
        <div>
          <dt>{t('customers.aiProfile.city', { defaultValue: 'City' })}</dt>
          <dd>{data.crm?.confirmedCity ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('customers.aiProfile.wantedProduct', { defaultValue: 'Wanted product' })}</dt>
          <dd>{data.wantedProduct ?? data.crm?.lastProductInterest ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('customers.aiProfile.delivery', { defaultValue: 'Delivery' })}</dt>
          <dd>{data.deliveryPreference ?? '—'}</dd>
        </div>
      </dl>
      {data.nameNeedsReview && (
        <div className="customer-ai-profile__review">
          <span>{t('customers.aiProfile.needsReview', { defaultValue: 'Name needs review' })}</span>
          <button type="button" className="fu-btn fu-btn--ghost" onClick={() => approveName.mutate()}>
            {t('customers.aiProfile.approve', { defaultValue: 'Approve' })}
          </button>
        </div>
      )}
      <div className="customer-ai-profile__actions">
        <Link
          className="fu-btn fu-btn--ghost"
          to={`/inbox?session=${sessionId}&chat=${encodeURIComponent(chatId)}`}
        >
          {t('customers.aiProfile.openChat', { defaultValue: 'Open source chat' })}
        </Link>
      </div>
    </section>
  );
}
