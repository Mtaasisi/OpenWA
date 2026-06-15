import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import type { Session, WhatsAppLinkPreflightSummaryRow } from '../../services/api';
import { isSessionConnecting } from '../../lib/session-status';
import { getLinkSafetyDisplay } from './channel-link-safety-display';
import { settingsPanelHref } from '../settings/settings-nav-registry';

type Props = {
  session: Session;
  selected?: boolean;
  focused?: boolean;
  canWrite: boolean;
  healthIssueMessage?: string | null;
  linkSafetyRow?: WhatsAppLinkPreflightSummaryRow;
  unreadCount?: number;
  failedCount?: number;
  isRelinking?: boolean;
  starting?: boolean;
  formatLastActive: (date?: string) => string;
  onSelect: () => void;
  onScanQr: () => void;
  onOpenInbox?: () => void;
};

function cardBadgeClass(session: Session, needsAction: boolean): string {
  if (needsAction) return 'cc-card__badge cc-card__badge--action';
  if (session.status === 'ready' && !session.requiresRelink) {
    return 'cc-card__badge cc-card__badge--connected';
  }
  if (isSessionConnecting(session.status)) {
    return 'cc-card__badge cc-card__badge--connecting';
  }
  return 'cc-card__badge cc-card__badge--disconnected';
}

function cardBadgeLabel(
  session: Session,
  needsAction: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (needsAction) return t('channels.card.actionRequired');
  if (session.status === 'ready' && !session.requiresRelink) {
    return t('channels.card.connected', { defaultValue: 'Connected' });
  }
  if (isSessionConnecting(session.status)) {
    return t(`sessionStatus.${session.status}`, { defaultValue: session.status });
  }
  return t('channels.card.disconnected', { defaultValue: 'Disconnected' });
}

export function ChannelSessionCard({
  session,
  selected,
  focused,
  canWrite,
  healthIssueMessage,
  linkSafetyRow,
  unreadCount = 0,
  failedCount = 0,
  isRelinking,
  starting,
  formatLastActive,
  onSelect,
  onScanQr,
  onOpenInbox,
}: Props) {
  const { t } = useTranslation();
  const needsAction =
    session.requiresRelink || session.status === 'failed' || Boolean(healthIssueMessage);
  const connected = session.status === 'ready' && !session.requiresRelink;
  const connecting = isSessionConnecting(session.status);
  const aiActive = connected && session.aiAutoReplyEnabled !== false;

  const subtitle = connecting
    ? t(`sessionStatus.${session.status}`, { defaultValue: session.status })
    : aiActive
      ? t('sessions.card.aiAutoReply')
      : connected && session.pushName?.trim()
        ? `${session.pushName.trim()} · WhatsApp`
        : `WhatsApp · ${formatLastActive(session.lastActive)}`;

  const linkSafetyDisplay = getLinkSafetyDisplay(linkSafetyRow, connected, t);

  const iconClass = aiActive
    ? 'cc-card__icon--bot'
    : connected || !connecting
      ? 'cc-card__icon--wa'
      : 'cc-card__icon--connecting';

  return (
    <div
      id={`session-card-${session.id}`}
      className={[
        'cc-card',
        selected ? 'cc-card--selected' : '',
        focused ? 'cc-card--focused' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onDoubleClick={() => {
        if (connected && onOpenInbox) onOpenInbox();
      }}
      title={
        connected && onOpenInbox
          ? t('channels.card.openInboxHint', { defaultValue: 'Double-click to open Inbox' })
          : needsAction && canWrite
            ? t('channels.card.scanQrHint', { defaultValue: 'Press Enter to scan QR' })
            : undefined
      }
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (e.key === 'Enter' && needsAction && canWrite) onScanQr();
          else onSelect();
        }
      }}
    >
      <div className="cc-card__head">
        <div className="cc-card__who">
          <div className={['cc-card__icon', iconClass].join(' ')}>
            {aiActive ? (
              <MaterialSymbol name="robot_2" size={28} />
            ) : connecting ? (
              <Loader2 size={28} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <MaterialSymbol name="chat_bubble" size={28} />
            )}
          </div>
          <div>
            <h3 className="cc-card__name">{session.name}</h3>
            <p className="cc-card__desc">{subtitle}</p>
          </div>
        </div>
        <span className={cardBadgeClass(session, needsAction)}>
          {cardBadgeLabel(session, needsAction, t)}
        </span>
      </div>

      {needsAction ? (
        <div className="cc-card__foot">
          <div className="cc-card__warn">
            <MaterialSymbol name="error" size={18} />
            <span>
              {healthIssueMessage ||
                (session.requiresRelink
                  ? t('channels.card.scanToConnect', { defaultValue: 'Scan QR to connect' })
                  : t('sessions.health.relinkRequired'))}
            </span>
          </div>
          {canWrite ? (
            <button
              type="button"
              className="fu-btn fu-btn--primary fu-btn--sm cc-card__scan"
              disabled={isRelinking || starting}
              onClick={e => {
                e.stopPropagation();
                onScanQr();
              }}
            >
              {isRelinking || starting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MaterialSymbol name="qr_code" size={14} />
              )}
              {t('sessions.engine.scanQr')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="cc-card__foot">
          <div className="cc-card__metrics">
            {unreadCount > 0 ? (
              <span className="cc-card__metric">
                <MaterialSymbol name="mark_chat_unread" size={18} />
                {t('channels.card.unread', { count: unreadCount, defaultValue: '{{count}} unread' })}
              </span>
            ) : null}
            {linkSafetyDisplay ? (
              linkSafetyDisplay.tone === 'warn' ? (
                <Link
                  to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
                  className="cc-card__metric cc-card__metric--link"
                  onClick={e => e.stopPropagation()}
                >
                  <MaterialSymbol name="verified_user" size={18} />
                  {linkSafetyDisplay.label}
                </Link>
              ) : (
                <span className="cc-card__metric cc-card__metric--ok">
                  <MaterialSymbol name="verified_user" size={18} />
                  {linkSafetyDisplay.label}
                </span>
              )
            ) : null}
            {failedCount > 0 ? (
              <span className="cc-card__metric cc-card__metric--error">
                {t('dashboard.controlRoom.channel.failedSends', { count: failedCount })}
              </span>
            ) : null}
            {connecting ? (
              <span className="cc-card__metric">
                {t(`sessionStatus.${session.status}`, { defaultValue: session.status })}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
