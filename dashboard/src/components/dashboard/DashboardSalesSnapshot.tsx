import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { QuoteSummary } from '../../lib/dashboard-metrics';

interface DashboardSalesSnapshotProps {
  summary: QuoteSummary;
  wonToday: number;
}

const BAR_HEIGHTS = [50, 66, 33, 75, 100, 86];

export function DashboardSalesSnapshot({ summary, wonToday }: DashboardSalesSnapshotProps) {
  const { t } = useTranslation();

  return (
    <section className="cr-panel cr-panel--compact">
      <div className="cr-panel__head cr-panel__head--compact">
        <h3>{t('dashboard.controlRoom.salesSnapshot')}</h3>
        <Link to="/reports?section=pipeline" className="cr-panel__head-link">
          {t('dashboard.controlRoom.hero.today')}
          <MaterialSymbol name="expand_more" size={14} />
        </Link>
      </div>
      <div className="cr-sales-snapshot">
        <div className="cr-sales-snapshot__stats">
          <div>
            <p className="cr-sales-snapshot__stat-label">{t('dashboard.controlRoom.quotes.accepted')}</p>
            <p className="cr-sales-snapshot__stat-value">
              {summary.accepted > 0 ? summary.totalQuotedValue.toLocaleString() : '—'}
            </p>
            {wonToday > 0 && (
              <span className="cr-sales-snapshot__stat-trend">+{wonToday}</span>
            )}
          </div>
          <div>
            <p className="cr-sales-snapshot__stat-label">{t('dashboard.controlRoom.quotes.sent')}</p>
            <p className="cr-sales-snapshot__stat-value">{summary.sent}</p>
          </div>
        </div>
        <div className="cr-sales-snapshot__chart" aria-hidden>
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="cr-sales-snapshot__bar"
              style={{ height: `${h}%`, opacity: 0.25 + (i / BAR_HEIGHTS.length) * 0.75 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
