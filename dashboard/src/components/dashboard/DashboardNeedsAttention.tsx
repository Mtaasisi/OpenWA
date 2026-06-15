import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { StatusBadge, ChannelBadge, AccountBadge, QuickActionButton, EmptyState } from './index';
import type { ChannelType } from '../workspace/ChannelBadge';
import type { AttentionAlert } from '../../lib/dashboard-metrics';

const ALERT_ICONS: Record<string, string> = {
  unreplied: 'sms',
  overdue: 'event_upcoming',
  'failed-sends': 'sms_failed',
  disconnected: 'link_off',
  qr: 'qr_code_2',
  'unassigned-hot': 'person_off',
  'ai-paused': 'psychology',
  'sync-fail': 'sync_problem',
};

function alertIcon(id: string): string {
  if (id.startsWith('sms-')) return 'sms';
  if (id.startsWith('engine-relink')) return 'qr_code_2';
  if (id.startsWith('disconnected')) return 'link_off';
  if (id.startsWith('qr')) return 'qr_code_2';
  for (const key of Object.keys(ALERT_ICONS)) {
    if (id.startsWith(key)) return ALERT_ICONS[key];
  }
  return 'bolt';
}

interface DashboardNeedsAttentionProps {
  alerts: AttentionAlert[];
}

export function DashboardNeedsAttention({ alerts }: DashboardNeedsAttentionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.needsAttention')}
      icon={<MaterialSymbol name="bolt" size={20} className="dash-section__title-icon dash-section__title-icon--danger" />}
      badge={alerts.length > 0 ? t('dashboard.controlRoom.activeAlerts', { count: alerts.length }) : undefined}
      linkTo="/followups"
      linkLabel={t('dashboard.controlRoom.viewAllFollowups')}
    >
      {alerts.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.allClear')}
          description={t('dashboard.controlRoom.allClearDesc')}
          icon={<MaterialSymbol name="check_circle" size={32} />}
        />
      ) : (
        alerts.map(alert => (
          <div
            key={alert.id}
            className={`dash-alert-row dash-alert-row--${alert.severity}`}
          >
            <div className="dash-alert-row__icon-well" aria-hidden>
              <MaterialSymbol name={alertIcon(alert.id)} size={20} />
            </div>
            <div className="dash-alert-row__content">
              <p className="dash-alert-row__title">{alert.title}</p>
              <p className="dash-alert-row__desc">{alert.description}</p>
              <div className="dash-alert-row__meta">
                {alert.channel && (
                  <ChannelBadge channel={alert.channel as ChannelType} />
                )}
                {alert.accountName && <AccountBadge name={alert.accountName} />}
                <StatusBadge variant={alert.severity === 'high' ? 'danger' : 'warning'}>
                  {alert.severity === 'high'
                    ? t('dashboard.controlRoom.severityHigh')
                    : t('dashboard.controlRoom.severityMedium')}
                </StatusBadge>
              </div>
              <div className="dash-alert-row__actions">
                <QuickActionButton
                  label={alert.actionLabel}
                  variant="primary"
                  onClick={() =>
                    navigate(alert.actionTo, alert.actionState ? { state: alert.actionState } : undefined)
                  }
                />
              </div>
            </div>
          </div>
        ))
      )}
    </DashboardSection>
  );
}
