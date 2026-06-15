import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  productDemandApi,
  whatsAppSafetyApi,
  type CampaignSafetyPreflightResult,
  type ProductDemandCampaign,
} from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useToast } from './Toast';
import { ModalOverlay } from './ModalOverlay';

export function ProductDemandCampaignPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDemandCampaign | null>(null);
  const [preflight, setPreflight] = useState<CampaignSafetyPreflightResult | null>(null);
  const [preflightTarget, setPreflightTarget] = useState<ProductDemandCampaign | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightMode, setPreflightMode] = useState<'approve' | 'send'>('send');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['product-demand', 'campaigns'],
    queryFn: () => productDemandApi.listCampaigns(),
  });

  const { data: sessions = [] } = useSessionsQuery();

  const { data: approvalTemplates = [] } = useQuery({
    queryKey: ['whatsapp-safety', 'approval-templates'],
    queryFn: () => whatsAppSafetyApi.listApprovalTemplates(),
    enabled: Boolean(preflightTarget),
  });

  const approvedTemplates = approvalTemplates.filter(
    tpl => tpl.whatsappTemplateStatus === 'approved' && tpl.isActive,
  );

  useEffect(() => {
    if (!activeId) {
      setDraft(null);
      return;
    }
    const row = campaigns.find(c => c.id === activeId) ?? null;
    setDraft(row ? { ...row } : null);
  }, [activeId, campaigns]);

  const save = useMutation({
    mutationFn: (row: ProductDemandCampaign) =>
      productDemandApi.updateCampaign(row.id, {
        title: row.title,
        message: row.message,
        channel: row.channel,
        sessionId: row.sessionId ?? undefined,
      }),
    onSuccess: () => {
      toast.success(t('demandCampaign.saved'));
      void qc.invalidateQueries({ queryKey: ['product-demand', 'campaigns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveLaunch = useMutation({
    mutationFn: (row: ProductDemandCampaign) => productDemandApi.approveCampaignLaunch(row.id),
    onSuccess: () => {
      toast.success(t('demandCampaign.approved'));
      void qc.invalidateQueries({ queryKey: ['product-demand', 'campaigns'] });
      setPreflight(null);
      setPreflightTarget(null);
      setSelectedTemplateId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: (params: { row: ProductDemandCampaign; templateId?: string }) =>
      productDemandApi.sendCampaign(params.row.id, {
        channel: params.row.channel,
        sessionId: params.row.sessionId ?? undefined,
        templateId: params.templateId || undefined,
      }),
    onSuccess: res => {
      toast.success(t('demandCampaign.sent', { count: res.sentCount }));
      void qc.invalidateQueries({ queryKey: ['product-demand', 'campaigns'] });
      setActiveId(null);
      setPreflight(null);
      setPreflightTarget(null);
      setSelectedTemplateId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runPreflight = async (row: ProductDemandCampaign, templateId?: string) => {
    const result = await productDemandApi.safetyPreflight(row.id, {
      sessionId: row.sessionId ?? undefined,
      templateId: templateId || undefined,
    });
    setPreflight(result);
    return result;
  };

  const openPreflight = async (row: ProductDemandCampaign, mode: 'approve' | 'send') => {
    if (!row.sessionId) {
      toast.error(t('demandCampaign.preflight.sessionRequired'));
      return;
    }

    setPreflightMode(mode);
    setPreflightLoading(true);
    setPreflightTarget(row);
    setSelectedTemplateId('');
    try {
      await runPreflight(row);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setPreflightTarget(null);
    } finally {
      setPreflightLoading(false);
    }
  };

  const handleSendClick = async (row: ProductDemandCampaign) => {
    if (row.channel !== 'whatsapp') {
      send.mutate({ row });
      return;
    }
    await openPreflight(row, 'send');
  };

  const handleApproveClick = async (row: ProductDemandCampaign) => {
    await openPreflight(row, 'approve');
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!preflightTarget) return;
    setPreflightLoading(true);
    try {
      await runPreflight(preflightTarget, templateId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPreflightLoading(false);
    }
  };

  const closePreflight = () => {
    setPreflight(null);
    setPreflightTarget(null);
    setSelectedTemplateId('');
  };

  const confirmSend = () => {
    if (!preflightTarget) return;
    send.mutate({ row: preflightTarget, templateId: selectedTemplateId || undefined });
  };

  const confirmApprove = () => {
    if (!preflightTarget) return;
    approveLaunch.mutate(preflightTarget);
  };

  const needsTemplate =
    (preflight?.templateRequiredCount ?? 0) > 0 ||
    preflight?.requiredFixes.some(fix => /template/i.test(fix));

  if (isLoading) return <Loader2 className="spin" size={24} />;

  return (
    <>
      <section className="sms-campaign fu-glass-card demand-campaign-panel">
        <h3>{t('demandCampaign.title')}</h3>
        <p className="sms-campaign__hint">{t('demandCampaign.hint')}</p>

        {campaigns.length === 0 ? (
          <p className="sms-campaign__hint">{t('demandCampaign.empty')}</p>
        ) : (
          <ul className="sms-campaign__list">
            {campaigns.map(row => (
              <li key={row.id}>
                <button
                  type="button"
                  className="demand-campaign-panel__row"
                  onClick={() => setActiveId(row.id === activeId ? null : row.id)}
                >
                  <strong>{row.title}</strong>
                  <span>
                    {t(`demandCampaign.status.${row.status}`, { defaultValue: row.status })}
                    {' · '}
                    {t('demandCampaign.recipients', { count: row.recipientCount })}
                    {' · '}
                    {row.channel.toUpperCase()}
                  </span>
                </button>
                {activeId === row.id && draft && (
                  <div className="demand-campaign-panel__editor">
                    <label>
                      <span>{t('sms.message')}</span>
                      <textarea
                        rows={4}
                        value={draft.message}
                        disabled={draft.status === 'sent'}
                        onChange={e => setDraft({ ...draft, message: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>{t('demandCampaign.channel')}</span>
                      <select
                        value={draft.channel}
                        disabled={draft.status === 'sent'}
                        onChange={e => setDraft({ ...draft, channel: e.target.value })}
                      >
                        <option value="sms">{t('demandCampaign.channelSms')}</option>
                        <option value="whatsapp">{t('demandCampaign.channelWhatsapp')}</option>
                      </select>
                    </label>
                    {draft.channel === 'whatsapp' && draft.status === 'draft' && (
                      <p className="demand-campaign-panel__hint">
                        {t('demandCampaign.approveBeforeSendHint')}
                      </p>
                    )}
                    {draft.channel === 'whatsapp' && (
                      <label>
                        <span>{t('demandCampaign.session')}</span>
                        <select
                          value={draft.sessionId ?? ''}
                          disabled={draft.status === 'sent'}
                          onChange={e =>
                            setDraft({ ...draft, sessionId: e.target.value || null })
                          }
                        >
                          <option value="">—</option>
                          {sessions.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.id} ({s.status})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {draft.status !== 'sent' && (
                      <div className="demand-campaign-panel__actions">
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost fu-btn--sm"
                          disabled={save.isPending}
                          onClick={() => save.mutate(draft)}
                        >
                          {t('common.save', 'Save')}
                        </button>
                        {draft.channel === 'whatsapp' && draft.status === 'draft' && (
                          <button
                            type="button"
                            className="fu-btn fu-btn--ghost fu-btn--sm"
                            disabled={
                              approveLaunch.isPending || preflightLoading || !draft.message.trim()
                            }
                            onClick={() => void handleApproveClick(draft)}
                          >
                            {preflightLoading && preflightMode === 'approve' ? (
                              <Loader2 className="spin" size={16} />
                            ) : (
                              t('demandCampaign.approveLaunch')
                            )}
                          </button>
                        )}
                        {(draft.channel !== 'whatsapp' || draft.status === 'approved') && (
                          <button
                            type="button"
                            className="fu-btn fu-btn--primary fu-btn--sm"
                            disabled={send.isPending || preflightLoading || !draft.message.trim()}
                            onClick={() => void handleSendClick(draft)}
                          >
                            {preflightLoading && preflightMode === 'send' ? (
                              <Loader2 className="spin" size={16} />
                            ) : (
                              t('demandCampaign.send')
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {preflight && preflightTarget && (
        <ModalOverlay onClose={closePreflight}>
          <div
            className="demand-campaign-preflight-modal fu-glass-card"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="demand-campaign-preflight-title"
          >
            <h3 id="demand-campaign-preflight-title">{t('demandCampaign.preflight.title')}</h3>
            <p className="demand-campaign-preflight-modal__subtitle">{preflightTarget.title}</p>

            <div className="demand-campaign-preflight-modal__metrics">
              <div>
                <span>{t('demandCampaign.preflight.riskScore')}</span>
                <strong>{preflight.riskScore}/100</strong>
              </div>
              <div>
                <span>{t('demandCampaign.preflight.optedIn')}</span>
                <strong>
                  {preflight.optedInRecipients}/{preflight.totalRecipients}
                </strong>
              </div>
              <div>
                <span>{t('demandCampaign.preflight.estimatedMinutes')}</span>
                <strong>{preflight.estimatedSendMinutes}</strong>
              </div>
            </div>

            {needsTemplate && (
              <label className="demand-campaign-preflight-modal__template">
                <span>{t('demandCampaign.preflight.template')}</span>
                <select
                  value={selectedTemplateId}
                  disabled={preflightLoading}
                  onChange={e => void handleTemplateChange(e.target.value)}
                >
                  <option value="">{t('demandCampaign.preflight.selectTemplate')}</option>
                  {approvedTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.whatsappTemplateName ? ` (${tpl.whatsappTemplateName})` : ''}
                    </option>
                  ))}
                </select>
                {approvedTemplates.length === 0 && (
                  <small>{t('demandCampaign.preflight.noApprovedTemplates')}</small>
                )}
              </label>
            )}

            {preflight.requiredFixes.length > 0 && (
              <div className="demand-campaign-preflight-modal__fixes">
                <h4>{t('demandCampaign.preflight.requiredFixes')}</h4>
                <ul>
                  {preflight.requiredFixes.map(fix => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}

            <p
              className={
                preflight.launchAllowed
                  ? 'demand-campaign-preflight-modal__status demand-campaign-preflight-modal__status--ok'
                  : 'demand-campaign-preflight-modal__status demand-campaign-preflight-modal__status--blocked'
              }
            >
              {preflight.launchAllowed
                ? t('demandCampaign.preflight.launchAllowed')
                : t('demandCampaign.preflight.launchBlocked')}
            </p>

            <div className="demand-campaign-preflight-modal__actions">
              <button type="button" className="fu-btn fu-btn--ghost fu-btn--sm" onClick={closePreflight}>
                {t('common.cancel', 'Cancel')}
              </button>
              {preflightMode === 'approve' ? (
                <button
                  type="button"
                  className="fu-btn fu-btn--primary fu-btn--sm"
                  disabled={!preflight.launchAllowed || approveLaunch.isPending || preflightLoading}
                  onClick={confirmApprove}
                >
                  {t('demandCampaign.preflight.confirmApprove')}
                </button>
              ) : (
                <button
                  type="button"
                  className="fu-btn fu-btn--primary fu-btn--sm"
                  disabled={!preflight.launchAllowed || send.isPending || preflightLoading}
                  onClick={confirmSend}
                >
                  {t('demandCampaign.preflight.confirmSend')}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
