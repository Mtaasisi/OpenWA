import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import type { Session, SessionHealthOverview } from '../services/api';
import { isSessionConnecting } from '../lib/session-status';
import { isSessionHealthHealthy } from '../lib/session-health-utils';
import { sessionNeedsLink } from '../lib/session-link.util';
import { settingsPanelHref } from './settings/settings-nav-registry';
import './SessionsStatusPills.css';

type LinkSafetyRow = {
  sessionId: string;
  ready: boolean;
};

type Props = {
  sessions: Session[];
  healthOverview: SessionHealthOverview[];
  linkSafetySessions?: LinkSafetyRow[];
  variant?: 'pills' | 'cards';
  onRelinkAlert?: () => void;
  onHealthAlert?: () => void;
  onLinkSafetyAlert?: () => void;
};

export function SessionsStatusPills({
  sessions,
  healthOverview,
  linkSafetySessions = [],
  variant = 'pills',
  onRelinkAlert,
  onHealthAlert,
  onLinkSafetyAlert,
}: Props) {
  const { t } = useTranslation();

  const disconnected = sessions.filter(
    s => s.phone && s.status !== 'ready' && !isSessionConnecting(s.status),
  ).length;
  const needsRelink = sessions.filter(s => s.requiresRelink).length;
  const healthIssues = healthOverview.filter(e => !isSessionHealthHealthy(e)).length;
  const linkSafetyIssues = linkSafetySessions.filter(row => {
    const session = sessions.find(s => s.id === row.sessionId);
    return session && sessionNeedsLink(session) && !row.ready;
  }).length;

  if (disconnected === 0 && needsRelink === 0 && healthIssues === 0 && linkSafetyIssues === 0) {
    return null;
  }

  const cardMode = variant === 'cards';

  if (cardMode) {
    return (
      <div className="cc-alerts" role="status" aria-live="polite">
        {needsRelink > 0 ? (
          <button
            type="button"
            className="cc-alerts__item cc-alerts__item--error cc-alerts__item--action"
            onClick={onRelinkAlert}
          >
            <MaterialSymbol name="qr_code_scanner" size={20} />
            {t('sessions.statusPills.needsRelink', { count: needsRelink })}
          </button>
        ) : null}
        {disconnected > 0 && needsRelink === 0 ? (
          <button
            type="button"
            className="cc-alerts__item cc-alerts__item--error cc-alerts__item--action"
            onClick={onRelinkAlert}
          >
            <MaterialSymbol name="qr_code_scanner" size={20} />
            {t('sessions.statusPills.disconnected', { count: disconnected })}
          </button>
        ) : null}
        {healthIssues > 0 ? (
          <button
            type="button"
            className="cc-alerts__item cc-alerts__item--neutral cc-alerts__item--action"
            onClick={onHealthAlert}
          >
            <MaterialSymbol name="health_and_safety" size={20} />
            {t('sessions.statusPills.health', { count: healthIssues })}
          </button>
        ) : null}
        {linkSafetyIssues > 0 ? (
          onLinkSafetyAlert ? (
            <button
              type="button"
              className="cc-alerts__item cc-alerts__item--neutral cc-alerts__item--action"
              onClick={onLinkSafetyAlert}
            >
              <MaterialSymbol name="shield" size={20} />
              {t('sessions.statusPills.linkSafety', { count: linkSafetyIssues })}
            </button>
          ) : (
            <Link
              to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
              className="cc-alerts__item cc-alerts__item--neutral"
            >
              <MaterialSymbol name="shield" size={20} />
              {t('sessions.statusPills.linkSafety', { count: linkSafetyIssues })}
            </Link>
          )
        ) : null}
      </div>
    );
  }

  const pillClass = (tone: 'error' | 'warn') =>
    [
      'sessions-status-pills__pill',
      tone === 'error' ? 'sessions-status-pills__pill--error' : 'sessions-status-pills__pill--warn',
    ].join(' ');

  return (
    <div className="sessions-status-pills" role="status" aria-live="polite">
      {needsRelink > 0 ? (
        <span className={pillClass('error')}>
          {t('sessions.statusPills.needsRelink', { count: needsRelink })}
        </span>
      ) : null}
      {disconnected > 0 && needsRelink === 0 ? (
        <span className={pillClass('error')}>
          {t('sessions.statusPills.disconnected', { count: disconnected })}
        </span>
      ) : null}
      {healthIssues > 0 ? (
        <span className={pillClass('warn')}>
          {t('sessions.statusPills.health', { count: healthIssues })}
        </span>
      ) : null}
      {linkSafetyIssues > 0 ? (
        <Link
          to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
          className={`${pillClass('warn')} sessions-status-pills__pill--link`}
        >
          {t('sessions.statusPills.linkSafety', { count: linkSafetyIssues })}
        </Link>
      ) : null}
    </div>
  );
}

export function getPrimarySessionAlert(
  session: Session,
  healthIssueMessage: string | null,
): { tone: 'critical' | 'warn'; messageKey?: string; message?: string } | null {
  if (session.requiresRelink) {
    return {
      tone: 'critical',
      messageKey:
        session.relinkReason === 'alternate_engine'
          ? 'sessions.engine.requiresRelinkAlternateEngine'
          : 'sessions.engine.requiresRelinkAuthMissing',
    };
  }
  if (session.status === 'failed') {
    return { tone: 'critical', messageKey: 'sessions.health.relinkRequired' };
  }
  if (healthIssueMessage) {
    return { tone: 'warn', message: healthIssueMessage };
  }
  return null;
}
