import { useTranslation } from 'react-i18next';
import { DashboardSection } from './DashboardSection';

interface DashboardWorkSummaryProps {
  pendingCount: number;
  dueTodayCount: number;
}

export function DashboardWorkSummary({ pendingCount, dueTodayCount }: DashboardWorkSummaryProps) {
  const { t } = useTranslation();
  const completionPct =
    pendingCount + dueTodayCount > 0
      ? Math.max(0, Math.min(100, Math.round((dueTodayCount / (pendingCount + dueTodayCount)) * 100)))
      : 100;

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.workSummary')}
      className="dash-section--compact"
    >
      <div className="dash-work-summary-grid">
        <div className="dash-work-summary-stat">
          <strong>{pendingCount}</strong>
          <span>{t('dashboard.controlRoom.pendingTasks')}</span>
        </div>
        <div className="dash-work-summary-stat dash-work-summary-stat--accent">
          <strong>{completionPct}%</strong>
          <span>{t('dashboard.controlRoom.dueTodayShort')}</span>
        </div>
      </div>
    </DashboardSection>
  );
}
