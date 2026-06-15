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
  showMessageBuffer?: boolean;
  showLearningCache?: boolean;
};

export function AiCostSettingsSection({
  config,
  showModelRouting = true,
  showCostSafety = true,
  showContextControl = true,
  showDedupe = true,
  showMessageBuffer = true,
  showLearningCache = true,
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
  const [autoReplyContextMessagesMax, setAutoReplyContextMessagesMax] = useState('5');
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
  const [messageBufferEnabled, setMessageBufferEnabled] = useState(true);
  const [messageBufferDebounceSeconds, setMessageBufferDebounceSeconds] = useState('10');
  const [messageBufferMaxWaitSeconds, setMessageBufferMaxWaitSeconds] = useState('30');
  const [messageBufferMaxMessages, setMessageBufferMaxMessages] = useState('10');
  const [messageBufferMaxCharacters, setMessageBufferMaxCharacters] = useState('4000');
  const [oneReplyPerMessageBurst, setOneReplyPerMessageBurst] = useState(true);
  const [learnedReplyCacheEnabled, setLearnedReplyCacheEnabled] = useState(true);
  const [autoLearnSafeIntents, setAutoLearnSafeIntents] = useState(true);
  const [autoApproveConfidenceThreshold, setAutoApproveConfidenceThreshold] = useState('90');
  const [pendingReviewThreshold, setPendingReviewThreshold] = useState('60');
  const [disableLearningForSensitive, setDisableLearningForSensitive] = useState(true);
  const [replyVariationRotation, setReplyVariationRotation] = useState(true);

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
    setAutoReplyContextMessagesMax(String(config.autoReplyContextMessagesMax ?? 5));
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
    setMessageBufferEnabled(config.messageBufferEnabled !== false);
    setMessageBufferDebounceSeconds(String(config.messageBufferDebounceSeconds ?? 10));
    setMessageBufferMaxWaitSeconds(String(config.messageBufferMaxWaitSeconds ?? 30));
    setMessageBufferMaxMessages(String(config.messageBufferMaxMessages ?? 10));
    setMessageBufferMaxCharacters(String(config.messageBufferMaxCharacters ?? 4000));
    setOneReplyPerMessageBurst(config.oneReplyPerMessageBurst !== false);
    setLearnedReplyCacheEnabled(config.learnedReplyCacheEnabled !== false);
    setAutoLearnSafeIntents(config.autoLearnSafeIntents !== false);
    setAutoApproveConfidenceThreshold(String(config.autoApproveConfidenceThreshold ?? 90));
    setPendingReviewThreshold(String(config.pendingReviewThreshold ?? 60));
    setDisableLearningForSensitive(config.disableLearningForSensitive !== false);
    setReplyVariationRotation(config.replyVariationRotation !== false);
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
        messageBufferEnabled,
        messageBufferDebounceSeconds: Number(messageBufferDebounceSeconds),
        messageBufferMaxWaitSeconds: Number(messageBufferMaxWaitSeconds),
        messageBufferMaxMessages: Number(messageBufferMaxMessages),
        messageBufferMaxCharacters: Number(messageBufferMaxCharacters),
        oneReplyPerMessageBurst,
        learnedReplyCacheEnabled,
        autoLearnSafeIntents,
        autoApproveConfidenceThreshold: Number(autoApproveConfidenceThreshold),
        pendingReviewThreshold: Number(pendingReviewThreshold),
        disableLearningForSensitive,
        replyVariationRotation,
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
        {t('ai.usage.openDashboardHint')}{' '}
        <Link to={settingsPanelHref('ai-learning-cache')}>{t('ai.learningCache.openPanel')}</Link>
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
            <input className="ai-settings-input" type="number" min={3} max={5} value={autoReplyContextMessagesMax} onChange={e => setAutoReplyContextMessagesMax(e.target.value)} />
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

      {showMessageBuffer && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.messageBuffer')}</h3>
          <InteraktCheckOption
            checked={messageBufferEnabled}
            onChange={setMessageBufferEnabled}
            title={t('ai.usage.messageBufferEnabled')}
            hint={t('ai.usage.messageBufferEnabledHint')}
          />
          <div className="ai-settings-grid">
            <label className="ai-settings-label">
              {t('ai.usage.messageBufferDebounce')}
              <input className="ai-settings-input" type="number" min={1} max={120} value={messageBufferDebounceSeconds} onChange={e => setMessageBufferDebounceSeconds(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.messageBufferMaxWait')}
              <input className="ai-settings-input" type="number" min={5} max={300} value={messageBufferMaxWaitSeconds} onChange={e => setMessageBufferMaxWaitSeconds(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.messageBufferMaxMessages')}
              <input className="ai-settings-input" type="number" min={1} max={50} value={messageBufferMaxMessages} onChange={e => setMessageBufferMaxMessages(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.messageBufferMaxChars')}
              <input className="ai-settings-input" type="number" min={500} max={20000} value={messageBufferMaxCharacters} onChange={e => setMessageBufferMaxCharacters(e.target.value)} />
            </label>
          </div>
          <InteraktCheckOption
            checked={oneReplyPerMessageBurst}
            onChange={setOneReplyPerMessageBurst}
            title={t('ai.usage.oneReplyPerBurst')}
          />
        </section>
      )}

      {showLearningCache && (
        <section className="ai-settings-card ai-settings-card--elevated" style={{ marginBottom: 16 }}>
          <h3 className="ai-settings-card__title">{t('ai.usage.learningCache')}</h3>
          <InteraktCheckOption
            checked={learnedReplyCacheEnabled}
            onChange={setLearnedReplyCacheEnabled}
            title={t('ai.usage.learnedReplyCacheEnabled')}
          />
          <InteraktCheckOption
            checked={autoLearnSafeIntents}
            onChange={setAutoLearnSafeIntents}
            title={t('ai.usage.autoLearnSafeIntents')}
          />
          <div className="ai-settings-grid">
            <label className="ai-settings-label">
              {t('ai.usage.autoApproveThreshold')}
              <input className="ai-settings-input" type="number" min={50} max={100} value={autoApproveConfidenceThreshold} onChange={e => setAutoApproveConfidenceThreshold(e.target.value)} />
            </label>
            <label className="ai-settings-label">
              {t('ai.usage.pendingReviewThreshold')}
              <input className="ai-settings-input" type="number" min={0} max={100} value={pendingReviewThreshold} onChange={e => setPendingReviewThreshold(e.target.value)} />
            </label>
          </div>
          <InteraktCheckOption
            checked={disableLearningForSensitive}
            onChange={setDisableLearningForSensitive}
            title={t('ai.usage.disableLearningSensitive')}
          />
          <InteraktCheckOption
            checked={replyVariationRotation}
            onChange={setReplyVariationRotation}
            title={t('ai.usage.replyVariationRotation')}
          />
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
