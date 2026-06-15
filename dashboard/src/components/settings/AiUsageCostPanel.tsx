import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import { aiApi, aiUsageApi, aiMessageBufferApi } from '../../services/api';
import { getAuthHeaders } from '../../lib/auth-storage';
import { maskConversationId } from '../../lib/mask-conversation-id';
import { useToast } from '../Toast';
import { useAiCostPermissions } from '../../hooks/useAiCostPermissions';
import './AiUsageCostPanel.css';

type Props = {
  onBack: () => void;
};

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatUsdBalance(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function budgetRemaining(budgetUsd: number, spentUsd: number): number {
  return Math.max(0, budgetUsd - spentUsd);
}

function budgetCardTone(usagePercent: number, remainingUsd: number): 'ok' | 'low' | 'empty' {
  if (remainingUsd <= 0) return 'empty';
  if (usagePercent >= 80) return 'low';
  return 'ok';
}

type BudgetFormValues = {
  daily: string;
  monthly: string;
  autoReply: string;
};

function parseBudgetAmount(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function hasOptimizationMetrics(
  usage: {
    cacheHitRate?: number;
    cacheHitCount?: number;
    moneySavedByCacheUsd?: number;
    budgetBlockedCount?: number;
    duplicateSkippedCount?: number;
    averagePromptTokens?: number;
    averageCompletionTokens?: number;
    promptBudgetWarningCount?: number;
  } | undefined,
): boolean {
  if (!usage) return false;
  return [
    usage.cacheHitRate,
    usage.cacheHitCount,
    usage.moneySavedByCacheUsd,
    usage.budgetBlockedCount,
    usage.duplicateSkippedCount,
    usage.averagePromptTokens,
    usage.averageCompletionTokens,
    usage.promptBudgetWarningCount,
  ].some(v => v != null);
}

type RecentPreset = 'today' | '7d' | 'mtd' | 'all';

function recentSinceIso(preset: RecentPreset): string | undefined {
  const now = new Date();
  if (preset === 'all') return undefined;
  if (preset === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (preset === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return d.toISOString();
}

export function AiUsageCostPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canManage } = useAiCostPermissions();
  const [dailyBudget, setDailyBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [autoReplyBudget, setAutoReplyBudget] = useState('');
  const savedBudgetsRef = useRef<BudgetFormValues>({ daily: '', monthly: '', autoReply: '' });
  const budgetSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentPreset, setRecentPreset] = useState<RecentPreset>('7d');
  const [recentStatus, setRecentStatus] = useState('');

  const recentSince = useMemo(() => recentSinceIso(recentPreset), [recentPreset]);

  const summaryQ = useQuery({
    queryKey: ['ai-usage-summary'],
    queryFn: () => aiUsageApi.getSummary(),
  });

  const dailyQ = useQuery({
    queryKey: ['ai-usage-daily'],
    queryFn: () => aiUsageApi.getDaily(14),
  });

  const byModelQ = useQuery({
    queryKey: ['ai-usage-by-model'],
    queryFn: () => aiUsageApi.getByModel(),
  });

  const byFeatureQ = useQuery({
    queryKey: ['ai-usage-by-feature'],
    queryFn: () => aiUsageApi.getByFeature(),
  });

  const recentQ = useQuery({
    queryKey: ['ai-usage-recent', recentPreset, recentStatus],
    queryFn: () =>
      aiUsageApi.getRecent({
        limit: 30,
        since: recentSince,
        status: recentStatus || undefined,
      }),
  });

  const contributorsQ = useQuery({
    queryKey: ['ai-usage-prompt-contributors'],
    queryFn: () => aiUsageApi.getPromptContributors(),
  });

  const bufferStatsQ = useQuery({
    queryKey: ['ai-message-buffer-stats'],
    queryFn: () => aiMessageBufferApi.getStats(),
  });

  const bufferRecentQ = useQuery({
    queryKey: ['ai-message-buffer-recent'],
    queryFn: () => aiMessageBufferApi.listRecent(10),
  });

  const configQ = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
  });

  const pauseMutation = useMutation({
    mutationFn: () => aiUsageApi.pauseAutoReply(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-summary'] });
      toast.success(t('ai.usage.autoReplyPaused'));
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => aiUsageApi.resumeAutoReply(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-summary'] });
      toast.success(t('ai.usage.autoReplyResumed'));
    },
  });

  const budgetMutation = useMutation({
    mutationFn: (values: BudgetFormValues) =>
      aiUsageApi.updateBudgetSettings({
        aiDailyBudgetUsd: parseBudgetAmount(values.daily, 1),
        aiMonthlyBudgetUsd: parseBudgetAmount(values.monthly, 20),
        autoReplyDailyBudgetUsd: parseBudgetAmount(values.autoReply, 0.5),
      }),
    onSuccess: (_, values) => {
      savedBudgetsRef.current = values;
      queryClient.invalidateQueries({ queryKey: ['ai-usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ai-config'] });
      toast.success(t('ai.usage.budgetsSaved'));
    },
    onError: () => toast.error(t('ai.usage.budgetsSaveFailed')),
  });

  const commitBudgetSave = useCallback(
    (values: BudgetFormValues) => {
      if (!canManage) return;
      if (
        values.daily === savedBudgetsRef.current.daily &&
        values.monthly === savedBudgetsRef.current.monthly &&
        values.autoReply === savedBudgetsRef.current.autoReply
      ) {
        return;
      }
      budgetMutation.mutate(values);
    },
    [canManage, budgetMutation.mutate],
  );

  const scheduleBudgetSave = useCallback(
    (values: BudgetFormValues) => {
      if (budgetSaveTimerRef.current) clearTimeout(budgetSaveTimerRef.current);
      budgetSaveTimerRef.current = setTimeout(() => commitBudgetSave(values), 500);
    },
    [commitBudgetSave],
  );

  useEffect(() => {
    if (!configQ.data) return;
    const values: BudgetFormValues = {
      daily: String(configQ.data.aiDailyBudgetUsd ?? 1),
      monthly: String(configQ.data.aiMonthlyBudgetUsd ?? 20),
      autoReply: String(configQ.data.autoReplyDailyBudgetUsd ?? 0.5),
    };
    setDailyBudget(values.daily);
    setMonthlyBudget(values.monthly);
    setAutoReplyBudget(values.autoReply);
    savedBudgetsRef.current = values;
  }, [
    configQ.data?.aiDailyBudgetUsd,
    configQ.data?.aiMonthlyBudgetUsd,
    configQ.data?.autoReplyDailyBudgetUsd,
  ]);

  useEffect(() => {
    return () => {
      if (budgetSaveTimerRef.current) clearTimeout(budgetSaveTimerRef.current);
    };
  }, []);

  const flushBudgetSave = useCallback(() => {
    if (budgetSaveTimerRef.current) clearTimeout(budgetSaveTimerRef.current);
    commitBudgetSave({
      daily: dailyBudget,
      monthly: monthlyBudget,
      autoReply: autoReplyBudget,
    });
  }, [commitBudgetSave, dailyBudget, monthlyBudget, autoReplyBudget]);

  const usage = summaryQ.data?.usage;
  const budget = summaryQ.data?.budget;
  const maxDailyBar = Math.max(...(dailyQ.data?.map(d => d.costUsd) ?? [0.01]), 0.01);
  const recentFailed = (recentQ.data?.items ?? []).find(row => row.status === 'failed');

  const dailyRemainingUsd = budget
    ? budgetRemaining(budget.dailyBudgetUsd, budget.dailyTotalUsd)
    : 0;
  const monthlyRemainingUsd = budget
    ? budgetRemaining(budget.monthlyBudgetUsd, budget.monthlyTotalUsd)
    : 0;
  const autoReplyRemainingUsd = budget
    ? budgetRemaining(budget.autoReplyDailyBudgetUsd, budget.autoReplyDailyUsd)
    : 0;

  const exportCsv = async () => {
    const res = await fetch('/api/admin/ai-usage/export.csv', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      toast.error(t('ai.usage.exportFailed'));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-usage-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="ai"
      onBack={onBack}
      title={t('ai.usage.title')}
      askAiPanelId="ai-usage"
    >
      <div className="ai-usage-panel">
        {summaryQ.isLoading ? (
          <div className="ai-usage-panel__loading">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <>
            {(budget?.atWarningThreshold || budget?.aiBudgetPaused) && (
              <div className="settings-notice settings-notice--warn ai-usage-panel__banner">
                {budget.aiBudgetPaused
                  ? t('ai.usage.panelBudgetPaused')
                  : t('ai.usage.panelApproachingBudget')}
              </div>
            )}
            {recentFailed && (
              <div className="settings-notice settings-notice--warn ai-usage-panel__banner">
                <strong>{t('ai.usage.recentFailedBanner')}</strong>
                {recentFailed.errorMessage ? (
                  <span className="ai-usage-panel__error-detail">{recentFailed.errorMessage}</span>
                ) : null}
              </div>
            )}

            <div className="ai-usage-panel__cards">
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.today')}</span>
                <strong>{formatUsd(usage?.todayCostUsd ?? 0)}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.thisMonth')}</span>
                <strong>{formatUsd(usage?.monthCostUsd ?? 0)}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.last7Days')}</span>
                <strong>{formatUsd(usage?.last7DaysCostUsd ?? 0)}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.autoReplyToday')}</span>
                <strong>{formatUsd(usage?.autoReplyTodayCostUsd ?? 0)}</strong>
              </div>
            </div>

            {hasOptimizationMetrics(usage) && (
              <section className="ai-usage-section ai-usage-section--compact">
                <h3>{t('ai.usage.optimizationTitle')}</h3>
                <div className="ai-usage-panel__cards">
                  {usage?.cacheHitRate != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.cacheHitRate')}</span>
                      <strong>{pct(usage.cacheHitRate)}</strong>
                      {usage.cacheHitCount != null && (
                        <span className="ai-usage-card__sub">
                          {t('ai.usage.cacheHitCount', { count: usage.cacheHitCount })}
                        </span>
                      )}
                    </div>
                  )}
                  {usage?.moneySavedByCacheUsd != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.moneySavedByCache')}</span>
                      <strong>{formatUsd(usage.moneySavedByCacheUsd)}</strong>
                    </div>
                  )}
                  {usage?.budgetBlockedCount != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.budgetBlocked')}</span>
                      <strong>{usage.budgetBlockedCount}</strong>
                    </div>
                  )}
                  {usage?.duplicateSkippedCount != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.duplicateSkipped')}</span>
                      <strong>{usage.duplicateSkippedCount}</strong>
                    </div>
                  )}
                  {usage?.averagePromptTokens != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.avgPromptTokens')}</span>
                      <strong>{Math.round(usage.averagePromptTokens)}</strong>
                    </div>
                  )}
                  {usage?.averageCompletionTokens != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.avgCompletionTokens')}</span>
                      <strong>{Math.round(usage.averageCompletionTokens)}</strong>
                    </div>
                  )}
                  {usage?.promptBudgetWarningCount != null && (
                    <div className="ai-usage-card">
                      <span className="ai-usage-card__label">{t('ai.usage.promptBudgetWarnings')}</span>
                      <strong>{usage.promptBudgetWarningCount}</strong>
                    </div>
                  )}
                </div>
              </section>
            )}

            {(contributorsQ.data?.sampleCount ?? 0) > 0 && (
              <section className="ai-usage-section ai-usage-section--compact">
                <h3>{t('ai.usage.promptContributorsTitle')}</h3>
                <p className="ai-usage-panel__save-hint">
                  {t('ai.usage.promptContributorsSample', {
                    count: contributorsQ.data?.sampleCount ?? 0,
                  })}
                </p>
                <ul className="ai-usage-list">
                  <li>
                    <span>{t('ai.usage.promptContributorRules')}</span>
                    <span>{contributorsQ.data?.rulesTokens ?? 0}</span>
                  </li>
                  <li>
                    <span>{t('ai.usage.promptContributorKnowledge')}</span>
                    <span>{contributorsQ.data?.knowledgeTokens ?? 0}</span>
                  </li>
                  <li>
                    <span>{t('ai.usage.promptContributorHistory')}</span>
                    <span>{contributorsQ.data?.historyTokens ?? 0}</span>
                  </li>
                  <li>
                    <span>{t('ai.usage.promptContributorTools')}</span>
                    <span>{contributorsQ.data?.toolsTokens ?? 0}</span>
                  </li>
                  <li>
                    <span>{t('ai.usage.promptContributorMessage')}</span>
                    <span>{contributorsQ.data?.customerMessageTokens ?? 0}</span>
                  </li>
                </ul>
                {contributorsQ.data?.topOffender ? (
                  <p className="ai-usage-panel__save-hint">
                    {t('ai.usage.promptContributorTopOffender', {
                      name: contributorsQ.data.topOffender,
                    })}
                  </p>
                ) : null}
              </section>
            )}

            {(bufferStatsQ.data || (bufferRecentQ.data?.items?.length ?? 0) > 0) && (
              <section className="ai-usage-section ai-usage-section--compact">
                <h3>{t('ai.usage.messageBufferActivity')}</h3>
                <div className="ai-usage-panel__cards">
                  <div className="ai-usage-card">
                    <span className="ai-usage-card__label">{t('ai.usage.buffersProcessedToday')}</span>
                    <strong>{bufferStatsQ.data?.processedToday ?? 0}</strong>
                  </div>
                  <div className="ai-usage-card">
                    <span className="ai-usage-card__label">{t('ai.usage.buffersPending')}</span>
                    <strong>{bufferStatsQ.data?.pendingNow ?? 0}</strong>
                  </div>
                  <div className="ai-usage-card">
                    <span className="ai-usage-card__label">{t('ai.usage.buffersFailedToday')}</span>
                    <strong>{bufferStatsQ.data?.failedToday ?? 0}</strong>
                  </div>
                </div>
                {(bufferRecentQ.data?.items ?? []).length > 0 && (
                  <div className="settings-table-wrap">
                    <table className="settings-table">
                      <thead>
                        <tr>
                          <th>{t('ai.usage.bufferTableTime')}</th>
                          <th>{t('ai.usage.bufferTableConversation')}</th>
                          <th>{t('ai.usage.bufferTableMessages')}</th>
                          <th>{t('ai.usage.bufferTableStatus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bufferRecentQ.data?.items ?? []).map(row => (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleString()}</td>
                            <td className="ai-usage-panel__error-cell">
                              {maskConversationId(row.conversationId)}
                            </td>
                            <td>{row.messageIds?.length ?? 0}</td>
                            <td>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <section className="ai-usage-section ai-usage-section--compact">
              <h3>{t('ai.usage.budgetRemainingTitle')}</h3>
              <div className="ai-usage-panel__cards">
                <div
                  className={`ai-usage-card ai-usage-card--budget ai-usage-card--${budgetCardTone(
                    budget?.dailyUsagePercent ?? 0,
                    dailyRemainingUsd,
                  )}`}
                >
                  <span className="ai-usage-card__label">{t('ai.usage.dailyBudgetRemaining')}</span>
                  <strong>{formatUsdBalance(dailyRemainingUsd)}</strong>
                  <span className="ai-usage-card__sub">
                    {t('ai.usage.budgetUsedPercent', {
                      pct: pct(budget?.dailyUsagePercent ?? 0),
                    })}
                    {' · '}
                    {t('ai.usage.budgetCap', { amount: formatUsdBalance(budget?.dailyBudgetUsd ?? 0) })}
                  </span>
                </div>
                <div
                  className={`ai-usage-card ai-usage-card--budget ai-usage-card--${budgetCardTone(
                    budget?.monthlyUsagePercent ?? 0,
                    monthlyRemainingUsd,
                  )}`}
                >
                  <span className="ai-usage-card__label">{t('ai.usage.monthlyBudgetRemaining')}</span>
                  <strong>{formatUsdBalance(monthlyRemainingUsd)}</strong>
                  <span className="ai-usage-card__sub">
                    {t('ai.usage.budgetUsedPercent', {
                      pct: pct(budget?.monthlyUsagePercent ?? 0),
                    })}
                    {' · '}
                    {t('ai.usage.budgetCap', { amount: formatUsdBalance(budget?.monthlyBudgetUsd ?? 0) })}
                  </span>
                </div>
                <div
                  className={`ai-usage-card ai-usage-card--budget ai-usage-card--${budgetCardTone(
                    budget?.autoReplyDailyPercent ?? 0,
                    autoReplyRemainingUsd,
                  )}`}
                >
                  <span className="ai-usage-card__label">{t('ai.usage.autoReplyBudgetRemaining')}</span>
                  <strong>{formatUsdBalance(autoReplyRemainingUsd)}</strong>
                  <span className="ai-usage-card__sub">
                    {t('ai.usage.budgetUsedPercent', {
                      pct: pct(budget?.autoReplyDailyPercent ?? 0),
                    })}
                    {' · '}
                    {t('ai.usage.budgetCap', {
                      amount: formatUsdBalance(budget?.autoReplyDailyBudgetUsd ?? 0),
                    })}
                  </span>
                </div>
              </div>
            </section>

            <div className="ai-usage-panel__actions">
              <button
                type="button"
                className="settings-wa__btn-secondary"
                onClick={() => summaryQ.refetch()}
              >
                <RefreshCw size={14} /> {t('ai.usage.refresh')}
              </button>
              <button type="button" className="settings-wa__btn-secondary" onClick={exportCsv}>
                <Download size={14} /> {t('ai.usage.exportCsv')}
              </button>
              {canManage && budget?.autoReplyPaused ? (
                <button
                  type="button"
                  className="settings-wa__btn-primary"
                  disabled={resumeMutation.isPending}
                  onClick={() => resumeMutation.mutate()}
                >
                  <Play size={14} /> {t('ai.usage.resumeAutoReply')}
                </button>
              ) : canManage ? (
                <button
                  type="button"
                  className="settings-wa__btn-secondary"
                  disabled={pauseMutation.isPending}
                  onClick={() => pauseMutation.mutate()}
                >
                  <Pause size={14} /> {t('ai.usage.pauseAutoReply')}
                </button>
              ) : null}
            </div>

            <section className="ai-usage-section">
              <h3>{t('ai.usage.dailyCost14')}</h3>
              <div className="ai-usage-bars">
                {(dailyQ.data ?? []).map(row => (
                  <div key={row.date} className="ai-usage-bar-row">
                    <span className="ai-usage-bar-row__label">{row.date}</span>
                    <div className="ai-usage-bar-row__track">
                      <div
                        className="ai-usage-bar-row__fill"
                        style={{ width: `${(row.costUsd / maxDailyBar) * 100}%` }}
                      />
                    </div>
                    <span className="ai-usage-bar-row__value">{formatUsd(row.costUsd)}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="ai-usage-panel__split">
              <section className="ai-usage-section">
                <h3>{t('ai.usage.costByModel')}</h3>
                <ul className="ai-usage-list">
                  {(byModelQ.data ?? []).slice(0, 8).map(row => (
                    <li key={`${row.provider}:${row.model}`}>
                      <span>{row.model}</span>
                      <span>{formatUsd(row.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="ai-usage-section">
                <h3>{t('ai.usage.costByFeature')}</h3>
                <ul className="ai-usage-list">
                  {(byFeatureQ.data ?? []).slice(0, 8).map(row => (
                    <li key={row.feature}>
                      <span>{row.feature}</span>
                      <span>{formatUsd(row.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {canManage && (
            <section className="ai-usage-section">
              <div className="ai-usage-section__head">
                <h3>{t('ai.usage.budgetSettings')}</h3>
                {budgetMutation.isPending ? (
                  <span className="ai-usage-panel__save-hint">
                    <Loader2 className="animate-spin" size={12} />
                    {t('ai.usage.budgetsSaving')}
                  </span>
                ) : null}
              </div>
              <div className="ai-usage-budget-form">
                <label>
                  {t('ai.usage.dailyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={dailyBudget}
                    onChange={e => {
                      const value = e.target.value;
                      setDailyBudget(value);
                      scheduleBudgetSave({
                        daily: value,
                        monthly: monthlyBudget,
                        autoReply: autoReplyBudget,
                      });
                    }}
                    onBlur={flushBudgetSave}
                  />
                </label>
                <label>
                  {t('ai.usage.monthlyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyBudget}
                    onChange={e => {
                      const value = e.target.value;
                      setMonthlyBudget(value);
                      scheduleBudgetSave({
                        daily: dailyBudget,
                        monthly: value,
                        autoReply: autoReplyBudget,
                      });
                    }}
                    onBlur={flushBudgetSave}
                  />
                </label>
                <label>
                  {t('ai.usage.autoReplyDailyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={autoReplyBudget}
                    onChange={e => {
                      const value = e.target.value;
                      setAutoReplyBudget(value);
                      scheduleBudgetSave({
                        daily: dailyBudget,
                        monthly: monthlyBudget,
                        autoReply: value,
                      });
                    }}
                    onBlur={flushBudgetSave}
                  />
                </label>
              </div>
              <p className="ai-usage-panel__save-hint">{t('ai.usage.budgetsAutoSave')}</p>
            </section>
            )}

            <section className="ai-usage-section">
              <div className="ai-usage-section__head">
                <h3>{t('ai.usage.recentCalls')}</h3>
                <div className="ai-usage-recent-filters">
                  <label>
                    {t('ai.usage.recentFilterPeriod')}
                    <select
                      value={recentPreset}
                      onChange={e => setRecentPreset(e.target.value as RecentPreset)}
                    >
                      <option value="today">{t('ai.usage.today')}</option>
                      <option value="7d">{t('ai.usage.last7Days')}</option>
                      <option value="mtd">{t('ai.usage.thisMonth')}</option>
                      <option value="all">{t('ai.usage.recentFilterAll')}</option>
                    </select>
                  </label>
                  <label>
                    {t('ai.usage.recentFilterStatus')}
                    <select
                      value={recentStatus}
                      onChange={e => setRecentStatus(e.target.value)}
                    >
                      <option value="">{t('ai.usage.recentFilterStatusAll')}</option>
                      <option value="success">{t('ai.usage.recentStatusSuccess')}</option>
                      <option value="cache_hit">{t('ai.usage.recentStatusCacheHit')}</option>
                      <option value="failed">{t('ai.usage.recentStatusFailed')}</option>
                      <option value="budget_blocked">{t('ai.usage.recentStatusBudgetBlocked')}</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="settings-table-wrap">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>{t('ai.usage.tableTime')}</th>
                      <th>{t('ai.usage.tableFeature')}</th>
                      <th>{t('ai.usage.tableModel')}</th>
                      <th>{t('ai.usage.tableInputTokens')}</th>
                      <th>{t('ai.usage.tableOutputTokens')}</th>
                      <th>{t('ai.usage.tableCost')}</th>
                      <th>{t('ai.usage.tableStatus')}</th>
                      <th>{t('ai.usage.tableError')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentQ.data?.items ?? []).map(row => (
                      <tr key={row.id}>
                        <td>{new Date(row.createdAt).toLocaleString()}</td>
                        <td>{row.feature}</td>
                        <td>{row.model}</td>
                        <td>{row.inputTokens}</td>
                        <td>{row.outputTokens}</td>
                        <td>{formatUsd(Number(row.actualCostUsd))}</td>
                        <td>
                          {row.status}
                          {(row.metadata as { budgetWarning?: string } | null)?.budgetWarning
                            ? ` · ${t('ai.usage.budgetWarningBadge')}`
                            : ''}
                        </td>
                        <td className="ai-usage-panel__error-cell">
                          {row.errorMessage ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="ai-usage-panel__meta">
              {t('ai.usage.metaSummary', {
                model: usage?.mostExpensiveModel ?? '—',
                feature: usage?.mostExpensiveFeature ?? '—',
                avgReply: formatUsd(usage?.averageCostPerReply ?? 0),
                totalCalls: usage?.totalAiCalls ?? 0,
              })}
            </p>
          </>
        )}
      </div>
    </SettingsIntegrationShell>
  );
}
