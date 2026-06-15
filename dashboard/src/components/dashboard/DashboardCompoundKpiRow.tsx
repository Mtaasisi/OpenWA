import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { renderIconSlot } from '../workspace/render-icon';
import type {
  DashboardActivityBar,
  DashboardCompoundKpi,
  DashboardCompoundSegment,
} from '../../lib/dashboard-metrics';

interface DashboardCompoundKpiRowProps {
  kpis: DashboardCompoundKpi[];
  loading?: boolean;
}

function formatValue(value: string | number, loading?: boolean): string {
  if (loading) return '…';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function segmentBarWidth(segments: DashboardCompoundSegment[], segment: DashboardCompoundSegment): number {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return 0;
  return Math.max((segment.value / total) * 100, segment.value > 0 ? 8 : 0);
}

function activityBarWidth(bars: DashboardActivityBar[], bar: DashboardActivityBar): number {
  const max = Math.max(...bars.map(b => b.value), 1);
  return Math.max((bar.value / max) * 100, bar.value > 0 ? 6 : 0);
}

export function DashboardCompoundKpiRow({ kpis, loading }: DashboardCompoundKpiRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (kpis.length === 0) return null;

  return (
    <div className="dashboard-compound-kpi-grid">
      {kpis.map(kpi => {
        const iconNode = renderIconSlot(kpi.icon, 18, 'dash-compound-kpi__icon');
        const className = [
          'dash-compound-kpi',
          kpi.severity !== 'neutral' ? `dash-compound-kpi--${kpi.severity}` : '',
          kpi.allClear ? 'dash-compound-kpi--clear' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={kpi.id}
            type="button"
            className={className}
            onClick={() =>
              navigate(kpi.linkTo, kpi.linkState ? { state: kpi.linkState } : undefined)
            }
          >
            <div className="dash-compound-kpi__head">
              {iconNode}
              <span className="dash-compound-kpi__title">{t(kpi.titleKey)}</span>
            </div>

            {kpi.allClear ? (
              <div className="dash-compound-kpi__clear">
                <span className="dash-compound-kpi__clear-value">{t('dashboard.controlRoom.allClear')}</span>
                {kpi.helperKey && (
                  <span className="dash-compound-kpi__helper">{t(kpi.helperKey)}</span>
                )}
              </div>
            ) : (
              <>
                <div className="dash-compound-kpi__stats">
                  <div className="dash-compound-kpi__stat dash-compound-kpi__stat--primary">
                    <strong>{formatValue(kpi.primaryValue, loading)}</strong>
                    {kpi.primaryLabelKey && (
                      <span>{t(kpi.primaryLabelKey)}</span>
                    )}
                  </div>
                  {kpi.secondaryValue != null && kpi.secondaryLabelKey && (
                    <div className="dash-compound-kpi__stat">
                      <strong>{formatValue(kpi.secondaryValue, loading)}</strong>
                      <span>{t(kpi.secondaryLabelKey)}</span>
                    </div>
                  )}
                </div>

                {kpi.activityBars && kpi.activityBars.length > 0 && (
                  <div className="dash-compound-kpi__bars">
                    {kpi.activityBars.map(bar => (
                      <div key={bar.id} className="dash-compound-kpi__bar-row">
                        <span className="dash-compound-kpi__bar-label">{t(bar.labelKey)}</span>
                        <div className="dash-compound-kpi__bar-track" aria-hidden>
                          <div
                            className={`dash-compound-kpi__bar-fill dash-compound-kpi__bar-fill--${bar.tone}`}
                            style={{ width: `${activityBarWidth(kpi.activityBars!, bar)}%` }}
                          />
                        </div>
                        <span className="dash-compound-kpi__bar-value">
                          {formatValue(bar.value, loading)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {kpi.segments && kpi.segments.length > 0 && (
                  <div className="dash-compound-kpi__segments">
                    <div className="dash-compound-kpi__stack" aria-hidden>
                      {kpi.segments.map(seg => (
                        <div
                          key={seg.id}
                          className={`dash-compound-kpi__stack-seg dash-compound-kpi__stack-seg--${seg.severity}`}
                          style={{ width: `${segmentBarWidth(kpi.segments!, seg)}%` }}
                        />
                      ))}
                    </div>
                    <div className="dash-compound-kpi__legend">
                      {kpi.segments.map(seg => (
                        <span
                          key={seg.id}
                          className={`dash-compound-kpi__legend-item dash-compound-kpi__legend-item--${seg.severity}`}
                        >
                          <span className="dash-compound-kpi__legend-value">
                            {formatValue(seg.value, loading)}
                          </span>
                          {t(seg.labelKey)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!kpi.allClear && kpi.helperKey && (
              <span className="dash-compound-kpi__helper">{t(kpi.helperKey)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
