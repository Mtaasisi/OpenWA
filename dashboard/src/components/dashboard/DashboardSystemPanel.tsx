import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { DashboardSection } from './DashboardSection';
import { StatusBadge, AccountBadge, QuickActionButton, EmptyState } from './index';
import { isSessionRunning } from '../../lib/session-status';
import { useStopSessionMutation } from '../../hooks/queries';
import type { Session } from '../../services/api';

interface DashboardSystemPanelProps {
  alerts: string[];
  sessions: Session[];
}

export function DashboardSystemPanel({ alerts, sessions }: DashboardSystemPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stopMutation = useStopSessionMutation();

  return (
    <>
      {alerts.length > 0 && (
        <DashboardSection
          title={t('dashboard.controlRoom.systemAlerts')}
          className="dash-section--system-alerts"
        >
          <ul className="dashboard-system-alerts">
            {alerts.map(msg => (
              <li key={msg}>
                <AlertTriangle size={14} aria-hidden />
                {msg}
              </li>
            ))}
          </ul>
        </DashboardSection>
      )}

      <DashboardSection
        title={t('dashboard.sessionsOverview')}
        linkTo="/channels?channel=whatsapp"
        linkLabel={t('dashboard.controlRoom.openChannels')}
      >
        {sessions.length === 0 ? (
          <EmptyState title={t('dashboard.noSessions')} className="dash-inline-empty" />
        ) : (
          <div className="dashboard-sessions-compact">
            {sessions.map(session => (
              <div key={session.id} className="dash-channel-card">
                <div className="dash-channel-card__header">
                  <AccountBadge name={session.name} subtitle={session.phone ?? undefined} />
                  <StatusBadge
                    variant={session.status === 'ready' ? 'connected' : 'disconnected'}
                  >
                    {t(`sessionStatus.${session.status}`, { defaultValue: session.status })}
                  </StatusBadge>
                </div>
                <div className="dash-channel-card__actions">
                  <QuickActionButton
                    label={t('dashboard.view')}
                    onClick={() => navigate('/channels')}
                  />
                  {isSessionRunning(session.status) && (
                    <QuickActionButton
                      label={t('dashboard.disconnect')}
                      onClick={() => void stopMutation.mutateAsync(session.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}
