import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { aiApi, type AiConfigView } from '../../services/api';
import { useToast } from '../Toast';
import { settingsPanelHref } from './settings-nav-registry';
import { InteraktCheckOption } from './SettingsInteraktPrimitives';

type Props = {
  config: AiConfigView | undefined;
  showModelRouting?: boolean;
  showCostSafety?: boolean;
  showContextControl?: boolean;
  showDedupe?: boolean;
};

export function AiCostSettingsSection({
  config,
  showModelRouting = true,
  showCostSafety = true,
  showContextControl = true,
  showDedupe = true,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const modelTiers = [
    { value: 'cheap_fast', label: t('ai.usage.tierCheapFast') },
    { value: 'balanced', label: t('ai.usage.tierBalanced') },
    { value: 'premium', label: t('ai.usage.tierPremium') },
  ];

  const [autoReplyModelTier, setAutoReplyModelTier] = useState('cheap_fast');
  const [inboxAssistantModelTier, setInboxAssistantModelTier] = useState('cheap_fast');
  const [trainingModelTier, setTrainingModelTier] = useState('balanced');
  const [adminAssistantModelTier, setAdminAssistantModelTier] = useState('balanced');
  const [allowPremiumModelForAutoReply, setAllowPremiumModelForAutoReply] = useState(false);
  const [aiDailyBudgetUsd, setAiDailyBudgetUsd] = useState('1');
  const [aiMonthlyBudgetUsd, setAiMonthlyBudgetUsd] = useState('20');
  const [autoReplyDailyBudgetUsd, setAutoReplyDailyBudgetUsd] = useState('0.5');
  const [stopAutoReplyWhenBudgetExceeded, setStopAutoReplyWhenBudgetExceeded] = useState(true);
  const [notifyAdminWhenBudgetAtPercent, setNotifyAdminWhenBudgetAtPercent] = useState('80');
  const [allowAdminOverrideBudget, setAllowAdminOverrideBudget] = useState(true);
  const [autoReplyContextMessagesMax, setAutoReplyContextMessagesMax] = useState('12');
  const [includeCrmWhenNeeded, setIncludeCrmWhenNeeded] = useState(true);
  const [includeKnowledgeWhenNeeded, setIncludeKnowledgeWhenNeeded] = useState(true);
  const [includeCatalogWhenNeeded, setIncludeCatalogWhenNeeded] = useState(true);
  const [includeMemoryWhenNeeded, setIncludeMemoryWhenNeeded] = useState(true);
  const [autoReplyCooldownSeconds, setAutoReplyCooldownSeconds] = useState('60');
  const [maxCustomerToolIterations, setMaxCustomerToolIterations] = useState('2');
  const [maxAdminToolIterations, setMaxAdminToolIterations] = useState('5');
  const [maxAiCallsPerInboundMessage, setMaxAiCallsPerInboundMessage] = useState('2');
  const [ignoreDuplicateMessageIds, setIgnoreDuplicateMessageIds] = useState(true);
  const [ignorePromotionalMessages, setIgnorePromotionalMessages] = useState(true);

  useEffect(() => {
    if (!config) return;
    setAutoReplyModelTier(config.autoReplyModelTier ?? 'cheap_fast');
    setInboxAssistantModelTier(config.inboxAssistantModelTier ?? 'cheap_fast');
    setTrainingModelTier(config.trainingModelTier ?? 'balanced');
    setAdminAssistantModelTier(config.adminAssistantModelTier ?? 'balanced');
    setAllowPremiumModelForAutoReply(config.allowPremiumModelForAutoReply === true);
    setAiDailyBudgetUsd(String(config.aiDailyBudgetUsd ?? 1));
    setAiMonthlyBudgetUsd(String(config.aiMonthlyBudgetUsd ?? 20));
    setAutoReplyDailyBudgetUsd(String(config.autoReplyDailyBudgetUsd ?? 0.5));
    setStopAutoReplyWhenBudgetExceeded(config.stopAutoReplyWhenBudgetExceeded !== false);
    setNotifyAdminWhenBudgetAtPercent(String(config.notifyAdminWhenBudgetAtPercent ?? 80));
    setAllowAdminOverrideBudget(config.allowAdminOverrideBudget !== false);
    setAutoReplyContextMessagesMax(String(config.autoReplyContextMessagesMax ?? 12));
    setIncludeCrmWhenNeeded(config.includeCrmWhenNeeded !== false);
    setIncludeKnowledgeWhenNeeded(config.includeKnowledgeWhenNeeded !== false);
    setIncludeCatalogWhenNeeded(config.includeCatalogWhenNeeded !== false);
    setIncludeMemoryWhenNeeded(config.includeMemoryWhenNeeded !== false);
    setAutoReplyCooldownSeconds(String(config.autoReplyCooldownSeconds ?? 60));
    setMaxCustomerToolIterations(String(config.maxCustomerToolIterations ?? 2));
    setMaxAdminToolIterations(String(config.maxAdminToolIterations ?? 5));
    setMaxAiCallsPerInboundMessage(String(config.maxAiCallsPerInboundMessage ?? 2));
    setIgnoreDuplicateMessageIds(config.ignoreDuplicateMessageIds !== false);
    setIgnorePromotionalMessages(config.ignorePromotionalMessages !== false);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      aiApi.saveConfig({
        provider: config!.provider,
        model: config!.model,
        autoReplyModelTier,
        inboxAssistantModelTier,
        trainingModelTier,
        adminAssistantModelTier,
        allowPremiumModelForAutoReply,
        aiDailyBudgetUsd: Number(aiDailyBudgetUsd),
        aiMonthlyBudgetUsd: Number(aiMonthlyBudgetUsd),
        autoReplyDailyBudgetUsd: Number(autoReplyDailyBudgetUsd),
        stopAutoReplyWhenBudgetExceeded,
        notifyAdminWhenBudgetAtPercent: Number(notifyAdminWhenBudgetAtPercent),
        allowAdminOverrideBudget,
        autoReplyContextMessagesMax: Number(autoReplyContextMessagesMax),
        includeCrmWhenNeeded,
        includeKnowledgeWhenNeeded,
        includeCatalogWhenNeeded,
        includeMemoryWhenNeeded,
        autoReplyCooldownSeconds: Number(autoReplyCooldownSeconds),
        maxCustomerToolIterations: Number(maxCustomerToolIterations),
        maxAdminToolIterations: Number(maxAdminToolIterations),
        maxAiCallsPerInboundMessage: Number(maxAiCallsPerInboundMessage),
        ignoreDuplicateMessageIds,
        ignorePromotionalMessages,
      }),
    onSuccess: () => {
      toast.success(t('ai.usage.costSettingsSaved'));
      qc.invalidateQueries({ queryKey: ['ai-config'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!config) return null;

  const tierRows = [
    { label: t('ai.usage.autoReplyTier'), value: autoReplyModelTier, set: setAutoReplyModelTier },
    { label: t('ai.usage.inboxAssistantTier'), value: inboxAssistantModelTier, set: setInboxAssistantModelTier },
    { label: t('ai.usage.trainingTier'), value: trainingModelTier, set: setTrainingModelTier },
    { label: t('ai.usage.adminAssistantTier'), value: adminAssistantModelTier, set: setAdminAssistantModelTier },
  ];

  return (
    <div className="ai-cost-settings">
      <p className="ai-settings-card__hint" style={{ marginBottom: 16 }}>
        <Link to={settingsPanelHref('ai-usage')}>{t('ai.usage.openDashboard')}</Link>{' '}
        {t('ai.usage.openDashboardHint')}
      </p>

      {showModelRouting && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.modelRouting')}</h3>
          <div className="ai-settings-grid">
            {tierRows.map(row => (
              <label key={row.label} className="ai-settings-label">
                {row.label}
                <select
                  className="ai-settings-input"
                  value={row.value}
                  onChange={e => row.set(e.target.value)}
                >
                  {modelTiers.map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <InteraktCheckOption
            checked={allowPremiumModelForAutoReply}
            onChange={setAllowPremiumModelForAutoReply}
            title={t('ai.usage.allowPremiumAutoReply')}
            hint={t('ai.usage.allowPremiumAutoReplyHint')}
          />
        </section>
      )}

      {showCostSafety && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.costSafety')}</h3>
          <div className="ai-settings-grid">
            <label className="ai-settings-label">
              {t('ai.usage.dailyBudget')}
              <input className="ai-settings-input" type="number" step="0.01" value={aiDailyBudgetUsd} onChange={e => setAiDailyBudgetUsd(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.monthlyBudget')}
              <input className="ai-settings-input" type="number" step="0.01" value={aiMonthlyBudgetUsd} onChange={e => setAiMonthlyBudgetUsd(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.autoReplyDailyBudget')}
              <input className="ai-settings-input" type="number" step="0.01" value={autoReplyDailyBudgetUsd} onChange={e => setAutoReplyDailyBudgetUsd(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.alertAtPercent')}
              <input className="ai-settings-input" type="number" min={1} max={100} value={notifyAdminWhenBudgetAtPercent} onChange={e => setNotifyAdminWhenBudgetAtPercent(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.maxCustomerTools')}
              <input className="ai-settings-input" type="number" min={1} max={5} value={maxCustomerToolIterations} onChange={e => setMaxCustomerToolIterations(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.maxAdminTools')}
              <input className="ai-settings-input" type="number" min={1} max={8} value={maxAdminToolIterations} onChange={e => setMaxAdminToolIterations(e.target.value)} />
            </label>
          </div>
          <InteraktCheckOption
            checked={stopAutoReplyWhenBudgetExceeded}
            onChange={setStopAutoReplyWhenBudgetExceeded}
            title={t('ai.usage.stopWhenBudgetExceeded')}
          />
          <InteraktCheckOption
            checked={allowAdminOverrideBudget}
            onChange={setAllowAdminOverrideBudget}
            title={t('ai.usage.allowAdminOverride')}
          />
          {(config.aiBudgetPaused || config.autoReplyPaused) && (
            <p className="settings-notice settings-notice--warn" style={{ marginTop: 12 }}>
              {t('ai.usage.budgetPausedNotice')}
            </p>
          )}
        </section>
      )}

      {showContextControl && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.contextControl')}</h3>
          <label className="ai-settings-label">
            {t('ai.usage.maxContextMessages')}
            <input className="ai-settings-input" type="number" min={4} max={12} value={autoReplyContextMessagesMax} onChange={e => setAutoReplyContextMessagesMax(e.target.value)} />
          </label>
          <InteraktCheckOption checked={includeCrmWhenNeeded} onChange={setIncludeCrmWhenNeeded} title={t('ai.usage.includeCrmWhenNeeded')} />
          <InteraktCheckOption checked={includeKnowledgeWhenNeeded} onChange={setIncludeKnowledgeWhenNeeded} title={t('ai.usage.includeKnowledgeWhenNeeded')} />
          <InteraktCheckOption checked={includeCatalogWhenNeeded} onChange={setIncludeCatalogWhenNeeded} title={t('ai.usage.includeCatalogWhenNeeded')} />
          <InteraktCheckOption checked={includeMemoryWhenNeeded} onChange={setIncludeMemoryWhenNeeded} title={t('ai.usage.includeMemoryWhenNeeded')} />
        </section>
      )}

      {showDedupe && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.dedupeCooldown')}</h3>
          <label className="ai-settings-label">
            {t('ai.usage.cooldownSeconds')}
            <input className="ai-settings-input" type="number" min={0} max={86400} value={autoReplyCooldownSeconds} onChange={e => setAutoReplyCooldownSeconds(e.target.value)} />
          </label>
          <label className="ai-settings-label">
            {t('ai.usage.maxAiCallsPerMessage')}
            <input className="ai-settings-input" type="number" min={1} max={3} value={maxAiCallsPerInboundMessage} onChange={e => setMaxAiCallsPerInboundMessage(e.target.value)} />
          </label>
          <InteraktCheckOption checked={ignoreDuplicateMessageIds} onChange={setIgnoreDuplicateMessageIds} title={t('ai.usage.skipDuplicateIds')} />
          <InteraktCheckOption checked={ignorePromotionalMessages} onChange={setIgnorePromotionalMessages} title={t('ai.usage.ignorePromotional')} />
        </section>
      )}

      <button
        type="button"
        className="settings-wa__btn-primary"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
        {t('ai.usage.saveCostSettings')}
      </button>
    </div>
  );
}
