import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { followupApi } from '../../services/api';
import { useSessionsQuery } from '../../hooks/queries';
import { DashboardSection } from './DashboardSection';
import { settingsPanelHref } from '../../components/settings/settings-nav-registry';

export function DashboardAutopilotSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['followup', 'autopilot', 'dashboard'],
    queryFn: () => followupApi.getAutopilotDashboard(),
    refetchInterval: 60_000,
  });

  const { data: sessions = [] } = useSessionsQuery();

  if (isLoading || !data) return null;

  const sessionName = (id: string) => sessions.find(s => s.id === id)?.name ?? `${id.slice(0, 8)}…`;

  return (
    <DashboardSection
      title="Follow-up Autopilot"
      linkTo={settingsPanelHref('followup-autopilot')}
      linkLabel="Settings"
    >
      <div className="dashboard-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
        <div className="ws-metric-card">
          <span className="ws-metric-card__label">Status</span>
          <strong>{data.enabled ? (data.mode === 'off' ? 'Configured' : data.mode.replace(/_/g, ' ')) : 'Off'}</strong>
        </div>
        <div className="ws-metric-card">
          <span className="ws-metric-card__label">Auto-sent today</span>
          <strong>{data.autoSentToday}</strong>
        </div>
        <div className="ws-metric-card">
          <span className="ws-metric-card__label">Needs approval</span>
          <strong>
            <Link to="/followups" state={{ filter: 'needs_approval' }}>
              {data.needsApproval}
            </Link>
          </strong>
        </div>
        <div className="ws-metric-card">
          <span className="ws-metric-card__label">Failed</span>
          <strong>{data.failed}</strong>
        </div>
      </div>
      {data.pausedAccounts.length > 0 && (
        <p className="settings-hint settings-hint--muted" style={{ marginTop: '0.75rem' }}>
          Paused accounts: {data.pausedAccounts.map(sessionName).join(', ')}
        </p>
      )}
    </DashboardSection>
  );
}
