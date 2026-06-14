import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import { aiApi, aiUsageApi } from '../../services/api';
import { getAuthHeaders } from '../../lib/auth-storage';
import { useToast } from '../Toast';
import { useAiCostPermissions } from '../../hooks/useAiCostPermissions';
import './AiUsageCostPanel.css';

type Props = {
  onBack: () => void;
};

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function AiUsageCostPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canManage } = useAiCostPermissions();
  const [dailyBudget, setDailyBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [autoReplyBudget, setAutoReplyBudget] = useState('');

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
    queryKey: ['ai-usage-recent'],
    queryFn: () => aiUsageApi.getRecent({ limit: 30 }),
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
    mutationFn: () =>
      aiUsageApi.updateBudgetSettings({
        aiDailyBudgetUsd: dailyBudget ? Number(dailyBudget) : undefined,
        aiMonthlyBudgetUsd: monthlyBudget ? Number(monthlyBudget) : undefined,
        autoReplyDailyBudgetUsd: autoReplyBudget ? Number(autoReplyBudget) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-usage-summary'] });
      toast.success(t('ai.usage.budgetsSaved'));
    },
  });

  const usage = summaryQ.data?.usage;
  const budget = summaryQ.data?.budget;
  const maxDailyBar = Math.max(...(dailyQ.data?.map(d => d.costUsd) ?? [0.01]), 0.01);

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
                <span className="ai-usage-card__label">{t('ai.usage.dailyBudgetUsage')}</span>
                <strong>{pct(budget?.dailyUsagePercent ?? 0)}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.monthlyBudgetUsage')}</span>
                <strong>{pct(budget?.monthlyUsagePercent ?? 0)}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.usage.autoReplyToday')}</span>
                <strong>{formatUsd(usage?.autoReplyTodayCostUsd ?? 0)}</strong>
              </div>
            </div>

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
              <h3>{t('ai.usage.budgetSettings')}</h3>
              <div className="ai-usage-budget-form">
                <label>
                  {t('ai.usage.dailyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(configQ.data?.aiDailyBudgetUsd ?? 1)}
                    value={dailyBudget}
                    onChange={e => setDailyBudget(e.target.value)}
                  />
                </label>
                <label>
                  {t('ai.usage.monthlyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(configQ.data?.aiMonthlyBudgetUsd ?? 20)}
                    value={monthlyBudget}
                    onChange={e => setMonthlyBudget(e.target.value)}
                  />
                </label>
                <label>
                  {t('ai.usage.autoReplyDailyBudget')}
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(configQ.data?.autoReplyDailyBudgetUsd ?? 0.5)}
                    value={autoReplyBudget}
                    onChange={e => setAutoReplyBudget(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="settings-wa__btn-primary"
                  disabled={budgetMutation.isPending}
                  onClick={() => budgetMutation.mutate()}
                >
                  {t('ai.usage.saveBudgets')}
                </button>
              </div>
            </section>
            )}

            <section className="ai-usage-section">
              <h3>{t('ai.usage.recentCalls')}</h3>
              <div className="settings-table-wrap">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>{t('ai.usage.tableTime')}</th>
                      <th>{t('ai.usage.tableFeature')}</th>
                      <th>{t('ai.usage.tableModel')}</th>
                      <th>{t('ai.usage.tableTokens')}</th>
                      <th>{t('ai.usage.tableCost')}</th>
                      <th>{t('ai.usage.tableStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentQ.data?.items ?? []).map(row => (
                      <tr key={row.id}>
                        <td>{new Date(row.createdAt).toLocaleString()}</td>
                        <td>{row.feature}</td>
                        <td>{row.model}</td>
                        <td>{row.inputTokens}/{row.outputTokens}</td>
                        <td>{formatUsd(Number(row.actualCostUsd))}</td>
                        <td>{row.status}</td>
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
