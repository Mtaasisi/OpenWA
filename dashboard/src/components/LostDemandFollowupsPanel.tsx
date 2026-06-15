import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { customerProfileApi } from '../services/api';
import { useToast } from './Toast';

export function LostDemandFollowupsPanel({ variant = 'classic' }: { variant?: 'classic' | 'stitch' }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['lost-demand-followups'],
    queryFn: () => customerProfileApi.listLostDemand('open'),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => customerProfileApi.closeLostDemand(id),
    onSuccess: () => {
      toast.success(t('followups.lostDemand.closed', { defaultValue: 'Closed' }));
      void qc.invalidateQueries({ queryKey: ['lost-demand-followups'] });
    },
  });

  if (isLoading && variant === 'stitch') {
    return null;
  }

  if (!isLoading && data.length === 0 && variant === 'stitch') {
    return null;
  }

  if (isLoading) {
    return (
      <div className={['lost-demand-panel', variant === 'stitch' ? 'lost-demand-panel--stitch' : '', 'lost-demand-panel--loading'].filter(Boolean).join(' ')}>
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  return (
    <section className={['lost-demand-panel', variant === 'stitch' ? 'lost-demand-panel--stitch' : ''].filter(Boolean).join(' ')}>
      <h3>{t('followups.lostDemand.title', { defaultValue: 'Waiting stock / lost demand' })}</h3>
      {data.length === 0 ? (
        <p className="settings-hint settings-hint--muted">
          {t('followups.lostDemand.empty', { defaultValue: 'No open lost-demand follow-ups.' })}
        </p>
      ) : (
        <ul className="lost-demand-panel__list">
          {data.map(row => (
            <li key={row.id} className="lost-demand-panel__row">
              <div>
                <strong>{row.wantedProduct}</strong>
                {row.wantedVariant && <span> — {row.wantedVariant}</span>}
                <p className="settings-hint settings-hint--muted">
                  {row.customerNameAtTime ?? row.chatId}
                  {row.notifyWhenAvailable ? ' · notify when available' : ''}
                </p>
              </div>
              <button
                type="button"
                className={variant === 'stitch' ? 'lost-demand-panel__close-btn' : 'fu-btn fu-btn--ghost'}
                onClick={() => closeMutation.mutate(row.id)}
              >
                {t('followups.lostDemand.close', { defaultValue: 'Close' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
