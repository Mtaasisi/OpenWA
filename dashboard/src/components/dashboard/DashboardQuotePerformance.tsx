import { useTranslation } from 'react-i18next';
import { FileText, Plus, Send } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { QuickActionButton } from './index';
import type { QuoteSummary } from '../../lib/dashboard-metrics';

interface DashboardQuotePerformanceProps {
  summary: QuoteSummary;
  currency?: string;
}

export function DashboardQuotePerformance({ summary, currency = '' }: DashboardQuotePerformanceProps) {
  const { t } = useTranslation();

  const stats = [
    { key: 'draft', value: summary.draft },
    { key: 'sent', value: summary.sent, accent: summary.sent > 0 },
    { key: 'accepted', value: summary.accepted, accent: summary.accepted > 0 },
    { key: 'rejected', value: summary.rejected },
    { key: 'expired', value: summary.expired },
    { key: 'needsFollowup', value: summary.needsFollowup, warn: summary.needsFollowup > 0 },
  ];

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.quotePerformance')}
      icon={<MaterialSymbol name="request_quote" size={20} className="dash-section__title-icon" />}
      linkTo="/quotes"
      linkLabel={t('dashboard.controlRoom.openQuotes')}
    >
      <div className="dash-quote-stats">
        {stats.map(s => (
          <div
            key={s.key}
            className={`dash-quote-stat${s.accent ? ' dash-quote-stat--accent' : ''}${s.warn ? ' dash-quote-stat--warn' : ''}`}
          >
            <strong>{s.value}</strong>
            <span>{t(`dashboard.controlRoom.quotes.${s.key}`)}</span>
          </div>
        ))}
        <div className="dash-quote-stat dash-quote-stat--total">
          <strong>
            {summary.totalQuotedValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
            {currency ? ` ${currency}` : ''}
          </strong>
          <span>{t('dashboard.controlRoom.quotes.totalValue')}</span>
        </div>
      </div>
      <div className="dash-channel-card__actions">
        <QuickActionButton
          label={t('dashboard.controlRoom.openQuotes')}
          to="/quotes"
          icon={FileText}
        />
        <QuickActionButton
          label={t('dashboard.controlRoom.actions.createQuote')}
          to="/quotes?create=1"
          icon={Plus}
        />
        <QuickActionButton
          label={t('dashboard.controlRoom.actions.followupQuotes')}
          to="/followups"
          icon={Send}
        />
      </div>
    </DashboardSection>
  );
}
