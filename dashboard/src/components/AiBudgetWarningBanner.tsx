import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MaterialSymbol } from './MaterialSymbol';
import { aiUsageApi } from '../services/api';
import { useAiCostPermissions } from '../hooks/useAiCostPermissions';
import { settingsPanelHref } from './settings/settings-nav-registry';
import './AiBudgetWarningBanner.css';

type Props = {
  compact?: boolean;
};

export function AiBudgetWarningBanner({ compact }: Props) {
  const { t } = useTranslation();
  const { canView } = useAiCostPermissions();

  const { data } = useQuery({
    queryKey: ['ai-budget-warning'],
    queryFn: () => aiUsageApi.getBudgetStatus(),
    enabled: canView,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (!canView || !data) return null;

  const paused = data.aiBudgetPaused || data.autoReplyPaused;
  const warning = data.atWarningThreshold;

  if (!paused && !warning) return null;

  const dailyPct = data.dailyUsagePercent.toFixed(0);
  const monthlyPct = data.monthlyUsagePercent.toFixed(0);

  const message = paused
    ? t('ai.usage.bannerPaused', {
        defaultValue: 'AI auto-reply is paused — daily or monthly budget limit reached.',
      })
    : t('ai.usage.bannerWarning', {
        defaultValue: 'AI spend is at {{daily}}% of daily and {{monthly}}% of monthly budget.',
        daily: dailyPct,
        monthly: monthlyPct,
      });

  return (
    <div
      className={`ai-budget-banner${paused ? ' ai-budget-banner--paused' : ''}${compact ? ' ai-budget-banner--compact' : ''}`}
      role="status"
    >
      <MaterialSymbol name={paused ? 'pause_circle' : 'warning'} size={18} />
      <span className="ai-budget-banner__text">{message}</span>
      <Link to={settingsPanelHref('ai-usage')} className="ai-budget-banner__link">
        {t('ai.usage.viewUsage', { defaultValue: 'View usage' })}
      </Link>
    </div>
  );
}
