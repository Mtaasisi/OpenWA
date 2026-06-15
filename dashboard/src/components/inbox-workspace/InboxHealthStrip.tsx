import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Conversation, InboxQueueCounts } from '../../services/api';
import { isSessionConnecting } from '../../lib/session-status';
import './InboxHealthStrip.css';

type Props = {
  conversations: Conversation[];
  activeSessionId?: string | null;
  sessionStatus?: string;
  queueCounts?: InboxQueueCounts | null;
};

export function InboxHealthStrip({
  conversations,
  activeSessionId,
  sessionStatus,
  queueCounts,
}: Props) {
  const { t } = useTranslation();

  const needsHuman =
    queueCounts?.ai_needs_human ??
    conversations.filter(c => c.needsHuman || c.threadState === 'ai_needs_human').length;
  const failed =
    queueCounts?.failed_sends ??
    queueCounts?.failed ??
    conversations.filter(c => c.threadState === 'send_failed' || c.queueStatus === 'failed').length;
  const disconnected = sessionStatus && sessionStatus !== 'ready' && !isSessionConnecting(sessionStatus);

  if (!disconnected && needsHuman === 0 && failed === 0) return null;

  return (
    <div className="inbox-health-strip" role="status" aria-live="polite">
      {disconnected ? (
        <span className="inbox-health-strip__pill inbox-health-strip__pill--error">
          {t('inbox.health.sessionDisconnected', { defaultValue: 'WhatsApp disconnected' })}
          {activeSessionId ? (
            <Link to={`/sessions?session=${encodeURIComponent(activeSessionId)}`} className="inbox-health-strip__action">
              {t('inbox.health.openQr', { defaultValue: 'Open QR' })}
            </Link>
          ) : null}
        </span>
      ) : null}
      {needsHuman > 0 ? (
        <span className="inbox-health-strip__pill inbox-health-strip__pill--warn">
          {t('inbox.health.aiNeedsHuman', {
            defaultValue: '{{count}} need human',
            count: needsHuman,
          })}
        </span>
      ) : null}
      {failed > 0 ? (
        <span className="inbox-health-strip__pill inbox-health-strip__pill--error">
          {t('inbox.health.failedSends', {
            defaultValue: '{{count}} failed sends',
            count: failed,
          })}
        </span>
      ) : null}
    </div>
  );
}
