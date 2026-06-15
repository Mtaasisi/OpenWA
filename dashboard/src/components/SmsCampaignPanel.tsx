import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { followupApi, productDemandApi, smsApi, type PipelineCard } from '../services/api';
import { useToast } from './Toast';
import { calculateSmsSegmentsClient } from '../lib/sms-segments-client';

type CampaignPrefill = {
  title?: string;
  message: string;
  productNames?: string[];
};

export function SmsCampaignPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: customersResponse, isLoading } = useQuery({
    queryKey: ['customers', 'sms-campaign'],
    queryFn: () => followupApi.listCustomers({ limit: 200 }),
  });

  const customers = customersResponse?.data ?? [];

  useEffect(() => {
    const state = location.state as {
      smsCampaignPrefill?: CampaignPrefill;
      demandCampaignId?: string;
    } | null;
    if (state?.smsCampaignPrefill?.message) {
      setMessage(state.smsCampaignPrefill.message);
    }
  }, [location.state]);

  const demandCampaignId = (location.state as { demandCampaignId?: string } | null)
    ?.demandCampaignId;

  const withPhone = useMemo(
    () => customers.filter((c: PipelineCard) => c.customerPhone?.trim()),
    [customers],
  );

  const { data: demandCampaign } = useQuery({
    queryKey: ['product-demand', 'campaign', demandCampaignId],
    queryFn: () => productDemandApi.getCampaign(demandCampaignId!),
    enabled: Boolean(demandCampaignId),
  });

  useEffect(() => {
    if (!demandCampaign?.recipients?.length || !withPhone.length) return;
    const phones = new Set(
      demandCampaign.recipients.map(r => r.phone?.replace(/\D/g, '')).filter(Boolean),
    );
    const matched = withPhone.filter((c: PipelineCard) =>
      phones.has(c.customerPhone?.replace(/\D/g, '') ?? ''),
    );
    if (matched.length) {
      setSelected(new Set(matched.map((c: PipelineCard) => c.id)));
    }
  }, [demandCampaign, withPhone]);

  const segmentInfo = useMemo(
    () => calculateSmsSegmentsClient(message),
    [message],
  );

  const estimatedTotal =
    selected.size * Math.max(segmentInfo.smsCount, message.trim() ? 1 : 0);

  const sendMutation = useMutation({
    mutationFn: () =>
      smsApi.bulkSend({
        message,
        recipients: withPhone
          .filter((c: PipelineCard) => selected.has(c.id))
          .map((c: PipelineCard) => ({
            phone: c.customerPhone!,
            customerId: c.customerId ?? undefined,
            customerName: c.customerName ?? undefined,
          })),
      }),
    onSuccess: res => {
      toast.success(
        t('sms.campaignEstimate', { total: res.totalSmsCount }) +
          ` (${res.recipientCount} recipients)`,
      );
      setMessage('');
      setSelected(new Set());
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(withPhone.map((c: PipelineCard) => c.id)));
  };

  return (
    <section className="sms-campaign fu-glass-card">
      <h3>{t('sms.campaignTitle')}</h3>
      <p className="sms-campaign__hint">{t('channels.smsSetupDesc')}</p>

      {isLoading ? (
        <Loader2 className="spin" size={24} />
      ) : (
        <>
          <div className="sms-campaign__toolbar">
            <span>{t('sms.campaignRecipients')}: {selected.size}</span>
            <button type="button" className="fu-btn fu-btn--ghost fu-btn--sm" onClick={selectAll}>
              Select all
            </button>
          </div>

          <ul className="sms-campaign__list">
            {withPhone.map((c: PipelineCard) => (
              <li key={c.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  {c.customerName || c.customerPhone} — {c.customerPhone}
                </label>
              </li>
            ))}
          </ul>

          <label className="sms-campaign__message">
            <span>{t('sms.message')}</span>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </label>

          {message.trim() && (
            <p className="sms-campaign__estimate">
              {t('sms.segmentCount', { count: segmentInfo.smsCount })}
              {' · '}
              {t('sms.campaignEstimate', { total: estimatedTotal })}
            </p>
          )}

          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={
              !message.trim() || selected.size === 0 || sendMutation.isPending
            }
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="spin" size={16} />
            ) : (
              t('sms.campaignSend')
            )}
          </button>
        </>
      )}
    </section>
  );
}
