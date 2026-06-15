import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { automationsHref } from '../../lib/automations-routes';
import type { AiCoreStatus } from '../../lib/dashboard-metrics';

interface DashboardAiStatusBubbleProps {
  coreStatus: AiCoreStatus;
  autoReplyMasterEnabled?: boolean;
  autoReplyReady?: boolean;
}

const STATUS_DOT: Record<AiCoreStatus, string> = {
  optimal: 'dash-ai-bubble__dot--green',
  standby: 'dash-ai-bubble__dot--yellow',
  degraded: 'dash-ai-bubble__dot--red',
  offline: 'dash-ai-bubble__dot--muted',
  setup: 'dash-ai-bubble__dot--yellow',
};

export function DashboardAiStatusBubble({
  coreStatus,
  autoReplyMasterEnabled,
  autoReplyReady,
}: DashboardAiStatusBubbleProps) {
  const { t } = useTranslation();
  const autoReplyHref = automationsHref('autoReply');
  const fabHref =
    autoReplyMasterEnabled != null || autoReplyReady != null ? autoReplyHref : '/ai';
  const fabLabel =
    autoReplyMasterEnabled != null || autoReplyReady != null
      ? t('dashboard.controlRoom.openAutoReplyHealth')
      : t('nav.aiAssistant');

  return (
    <div className="dash-ai-fab" aria-live="polite">
      <div className="dash-ai-bubble">
        <span className={`dash-ai-bubble__dot ${STATUS_DOT[coreStatus]}`} aria-hidden />
        <p>{t(`dashboard.controlRoom.aiCore.${coreStatus}`)}</p>
      </div>
      <Link to={fabHref} className="dash-ai-fab__btn" aria-label={fabLabel}>
        <MaterialSymbol name="terminal" size={30} className="dash-ai-fab__icon" />
      </Link>
    </div>
  );
}
