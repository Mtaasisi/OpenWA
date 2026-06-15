import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { TimelineItem, EmptyState, QuickActionButton } from './index';
import { formatRelativeTime, type TimelineEntry } from '../../lib/dashboard-metrics';

interface DashboardRecentActivityProps {
  entries: TimelineEntry[];
  compact?: boolean;
}

export function DashboardRecentActivity({ entries, compact }: DashboardRecentActivityProps) {
  const { t } = useTranslation();
  const visible = compact ? entries.slice(0, 6) : entries;

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.recentActivity')}
      icon={<MaterialSymbol name="history" size={20} className="dash-section__title-icon" />}
      linkTo="/logs"
      linkLabel={compact ? undefined : t('dashboard.controlRoom.viewLogs')}
      className={compact ? 'dash-section--compact' : undefined}
    >
      {visible.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.activityEmpty')}
          description={t('dashboard.controlRoom.activityEmptyDesc')}
          icon={<MaterialSymbol name="history" size={32} />}
        />
      ) : (
        visible.map(entry => (
          <TimelineItem
            key={entry.id}
            icon={<MaterialSymbol name={entry.symbol} size={12} />}
            action={t(entry.actionKey)}
            meta={entry.meta}
            time={formatRelativeTime(entry.time, t)}
          />
        ))
      )}
      {compact && entries.length > 0 && (
        <QuickActionButton
          label={t('dashboard.controlRoom.loadHistory')}
          to="/logs"
          className="dash-section-footer-action"
        />
      )}
    </DashboardSection>
  );
}
