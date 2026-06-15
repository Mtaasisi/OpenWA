import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { DataTable, type DataTableColumn, EmptyState, QuickActionButton } from './index';
import { Users } from 'lucide-react';

interface StaffRow {
  staffId: string;
  name: string;
  assigned: number;
  repliesSent: number;
  avgResponseMs: number;
  followupsCompleted: number;
  won: number;
  lost: number;
  overdue: number;
}

interface DashboardStaffPerformanceProps {
  rows: StaffRow[];
  compact?: boolean;
}

function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function staffScore(row: StaffRow): number {
  const total = row.won + row.lost + row.followupsCompleted;
  if (total === 0) return row.assigned > 0 ? 50 : 0;
  return Math.min(100, Math.round(((row.won + row.followupsCompleted) / Math.max(total, 1)) * 100));
}

export function DashboardStaffPerformance({ rows, compact }: DashboardStaffPerformanceProps) {
  const { t } = useTranslation();

  const columns: DataTableColumn<StaffRow>[] = [
    { key: 'name', header: t('dashboard.controlRoom.columns.staff'), render: r => r.name },
    { key: 'assigned', header: t('dashboard.controlRoom.columns.assigned'), render: r => r.assigned },
    { key: 'replies', header: t('dashboard.controlRoom.columns.replies'), render: r => (r.repliesSent > 0 ? r.repliesSent : '—') },
    { key: 'response', header: t('dashboard.controlRoom.columns.avgResponse'), render: r => (r.avgResponseMs > 0 ? `${Math.round(r.avgResponseMs / 1000)}s` : '—') },
    { key: 'followups', header: t('dashboard.controlRoom.columns.followupsDone'), render: r => r.followupsCompleted },
    { key: 'won', header: t('dashboard.controlRoom.columns.won'), render: r => r.won },
    { key: 'lost', header: t('dashboard.controlRoom.columns.lost'), render: r => r.lost },
    { key: 'overdue', header: t('dashboard.controlRoom.columns.overdue'), render: r => r.overdue },
  ];

  const leaderboard = [...rows]
    .sort((a, b) => staffScore(b) - staffScore(a))
    .slice(0, compact ? 3 : rows.length);

  return (
    <DashboardSection
      title={compact ? t('dashboard.controlRoom.staffLeaderboard') : t('dashboard.controlRoom.staffPerformance')}
      icon={compact ? undefined : <MaterialSymbol name="leaderboard" size={20} className="dash-section__title-icon" />}
      linkTo="/reports?section=staff"
      linkLabel={t('dashboard.controlRoom.viewReports')}
      className={compact ? 'dash-section--compact' : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.staffEmpty')}
          description={t('dashboard.controlRoom.staffEmptyDesc')}
          icon={Users}
          action={
            <QuickActionButton
              label={t('dashboard.controlRoom.viewReports')}
              to="/reports?section=staff"
            />
          }
        />
      ) : compact ? (
        leaderboard.map(row => {
          const pct = staffScore(row);
          return (
            <div key={row.staffId} className="dash-staff-row">
              <div className="dash-staff-row__avatar">{staffInitials(row.name)}</div>
              <div className="dash-staff-row__body">
                <div className="dash-staff-row__top">
                  <span>{row.name}</span>
                  <span className="dash-staff-row__pct">{pct}%</span>
                </div>
                <div className="dash-staff-row__bar">
                  <div
                    className={`dash-staff-row__bar-fill${pct < 75 ? ' dash-staff-row__bar-fill--warn' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={r => r.staffId} />
      )}
    </DashboardSection>
  );
}
