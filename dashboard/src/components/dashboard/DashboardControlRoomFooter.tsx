import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { AiSafetyMetrics } from '../../lib/dashboard-metrics';

interface DashboardControlRoomFooterProps {
  pendingCount: number;
  dueTodayCount: number;
  connected: boolean;
  aiSafety: AiSafetyMetrics;
  queueCount?: number;
  variant?: 'dashboard' | 'shell';
}

export function DashboardControlRoomFooter({
  pendingCount,
  dueTodayCount,
  connected,
  aiSafety,
  queueCount = 0,
  variant = 'dashboard',
}: DashboardControlRoomFooterProps) {
  const { t } = useTranslation();
  const total = pendingCount + dueTodayCount;
  const efficiency =
    total > 0 ? Math.max(0, Math.min(100, Math.round((dueTodayCount / total) * 100))) : 100;

  const aiLabel =
    variant === 'shell' && (aiSafety.coreStatus === 'optimal' || aiSafety.coreStatus === 'standby')
      ? t('shell.statusBar.aiSafe')
      : t(`dashboard.controlRoom.aiCore.${aiSafety.coreStatus}`);

  const channelLabel = connected
    ? variant === 'shell'
      ? t('shell.statusBar.whatsappConnected')
      : t('common.connected')
    : variant === 'shell'
      ? t('shell.statusBar.whatsappDisconnected')
      : t('common.disconnected');

  return (
    <footer className={`cr-footer${variant === 'shell' ? ' cr-footer--shell' : ''}`}>
      <div className="cr-footer__left">
        <div className="cr-footer__summary">
          <MaterialSymbol name="checklist" size={14} />
          <span className="cr-footer__summary-label">{t('dashboard.controlRoom.footer.workSummary')}</span>
          <span className="cr-footer__summary-value">
            {t('dashboard.controlRoom.footer.pendingEfficiency', {
              pending: pendingCount,
              efficiency,
            })}
          </span>
        </div>
        <div className="cr-footer__pills">
          <span className={`cr-footer__pill cr-footer__pill--${aiSafety.coreStatus}`}>
            <span className="cr-footer__pill-dot" aria-hidden />
            {aiLabel}
          </span>
          <span className={`cr-footer__pill${connected ? ' cr-footer__pill--ok' : ' cr-footer__pill--warn'}`}>
            <span className="cr-footer__pill-dot" aria-hidden />
            {channelLabel}
          </span>
          <span className="cr-footer__pill cr-footer__pill--muted">
            {t('dashboard.controlRoom.footer.queue', { count: queueCount })}
          </span>
        </div>
      </div>
      <div className="cr-footer__right">
        <span>{t('dashboard.controlRoom.footer.version')}</span>
        <span className="cr-footer__dot" aria-hidden />
        <span>{t('dashboard.controlRoom.footer.operational')}</span>
      </div>
    </footer>
  );
}
