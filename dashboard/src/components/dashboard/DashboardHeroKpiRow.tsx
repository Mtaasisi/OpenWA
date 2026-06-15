import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { DashboardHeroKpi } from '../../lib/dashboard-metrics';

interface DashboardHeroKpiRowProps {
  kpis: DashboardHeroKpi[];
  loading?: boolean;
}

export function DashboardHeroKpiRow({ kpis, loading }: DashboardHeroKpiRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="cr-hero-kpi-grid">
      {kpis.map(kpi => (
        <button
          key={kpi.id}
          type="button"
          className={[
            'cr-hero-kpi',
            kpi.severity !== 'neutral' ? `cr-hero-kpi--${kpi.severity}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() =>
            navigate(kpi.linkTo, kpi.linkState ? { state: kpi.linkState } : undefined)
          }
        >
          <div className="cr-hero-kpi__top">
            <span className="cr-hero-kpi__icon-well" aria-hidden>
              <MaterialSymbol name={kpi.symbol} size={16} />
            </span>
            <MaterialSymbol
              name="open_in_new"
              size={14}
              className="cr-hero-kpi__open"
              aria-hidden
            />
          </div>
          <p className="cr-hero-kpi__label">{t(kpi.titleKey)}</p>
          <div className="cr-hero-kpi__value-row">
            <span className="cr-hero-kpi__value">
              {loading
                ? '…'
                : typeof kpi.value === 'number'
                  ? kpi.value.toLocaleString()
                  : kpi.value}
            </span>
            {kpi.trend && (
              <span
                className={[
                  'cr-hero-kpi__trend',
                  kpi.trendUp ? 'cr-hero-kpi__trend--up' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {kpi.trend}
                {kpi.trendUp && (
                  <MaterialSymbol name="trending_up" size={10} className="cr-hero-kpi__trend-icon" />
                )}
              </span>
            )}
            {kpi.footnoteKey && (
              <span className="cr-hero-kpi__footnote">
                {t(kpi.footnoteKey, kpi.footnoteParams)}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
