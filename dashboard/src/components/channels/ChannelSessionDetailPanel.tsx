import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import type { Session, SessionHealthOverview, WhatsAppLinkPreflightSummaryRow } from '../../services/api';
import { detectSessionHealthIssue } from '../../lib/session-health-utils';
import { isSessionRunning } from '../../lib/session-status';
import { settingsPanelHref } from '../settings/settings-nav-registry';
import { getLinkSafetyDisplay } from './channel-link-safety-display';

type EngineOption = { id: string; name: string };

type Props = {
  session: Session;
  canWrite: boolean;
  engines: EngineOption[];
  currentEngineId: string;
  currentEngineLabel: string;
  healthEntry?: SessionHealthOverview;
  linkSafetyRow?: WhatsAppLinkPreflightSummaryRow;
  proxyUrlText: string;
  proxyType: 'http' | 'https' | 'socks4' | 'socks5';
  onProxyUrlChange: (value: string) => void;
  onProxyTypeChange: (value: 'http' | 'https' | 'socks4' | 'socks5') => void;
  savingAiAutoReply: boolean;
  savingFollowupAutopilot: boolean;
  savingProxy: boolean;
  savingStaffAi: boolean;
  relinkingId: string | null;
  formatStatus: (status: string) => string;
  showRelinkBanner: boolean;
  relinkMessageKey: string;
  onProxyToggle: (enabled: boolean) => void;
  onAiAutoReplyToggle: (enabled: boolean) => void;
  onFollowupAutopilotToggle: (enabled: boolean) => void;
  onSaveAll: () => void;
  onRelink: () => void;
  onForceRelink: () => void;
  onScanQrFlow: () => void;
  onDelete: () => void;
  onRestart: () => void;
  onStop?: () => void;
  canForceRelink: boolean;
  canRestart: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onClose?: () => void;
};

export function ChannelSessionDetailPanel({
  session,
  canWrite,
  engines,
  currentEngineId,
  currentEngineLabel,
  healthEntry,
  linkSafetyRow,
  proxyUrlText,
  proxyType,
  onProxyUrlChange,
  onProxyTypeChange,
  savingAiAutoReply,
  savingFollowupAutopilot,
  savingProxy,
  savingStaffAi,
  relinkingId,
  formatStatus,
  showRelinkBanner,
  relinkMessageKey,
  onProxyToggle,
  onAiAutoReplyToggle,
  onFollowupAutopilotToggle,
  onSaveAll,
  onRelink,
  onForceRelink,
  onScanQrFlow,
  onDelete,
  onRestart,
  onStop,
  canForceRelink,
  canRestart,
  showBack,
  onBack,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [proxyExpanded, setProxyExpanded] = useState(Boolean(proxyUrlText.trim()));
  const healthIssue = healthEntry ? detectSessionHealthIssue(healthEntry) : null;
  const saving = savingProxy || savingStaffAi;
  const disconnected = session.status !== 'ready' || session.requiresRelink;
  const connected = session.status === 'ready' && !session.requiresRelink;
  const linkSafetyDisplay = getLinkSafetyDisplay(linkSafetyRow, connected, t);
  const proxyConfigured = Boolean(proxyUrlText.trim());
  const showProxyFields = proxyExpanded || proxyConfigured;

  useEffect(() => {
    setProxyExpanded(Boolean(proxyUrlText.trim()));
  }, [session.id, proxyUrlText]);

  const handleScanQr = () => {
    if (showRelinkBanner) void onRelink();
    else if (canForceRelink) onForceRelink();
    else onScanQrFlow();
  };

  return (
    <>
      <div className="cc-inspector__header">
        <div className="cc-inspector__header-row">
          {showBack ? (
            <button
              type="button"
              className="cc-inspector__back"
              onClick={onBack}
              aria-label={t('channels.backToList')}
            >
              <MaterialSymbol name="arrow_back" size={20} />
              <span className="cc-inspector__back-label">{t('channels.backToList')}</span>
            </button>
          ) : null}
          <h3 className="cc-inspector__title">{session.name}</h3>
          {onClose ? (
            <button
              type="button"
              className="cc-inspector__close"
              onClick={onClose}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <MaterialSymbol name="close" size={22} />
            </button>
          ) : null}
        </div>
        <p className="cc-inspector__phone">
          {t('sessions.details.phone')}:{' '}
          <span>{session.phone || t('sessions.details.phoneNone')}</span>
        </p>
        <div
          className={`cc-inspector__status${
            disconnected
              ? ' cc-inspector__status--error'
              : connected
                ? ' cc-inspector__status--ok'
                : ' cc-inspector__status--warn'
          }`}
        >
          <span className="cc-inspector__status-dot" aria-hidden />
          {disconnected
            ? t('channels.card.disconnected', { defaultValue: 'Disconnected' })
            : connected
              ? t('channels.card.connected', { defaultValue: 'Connected' })
              : formatStatus(session.status)}
        </div>
        {connected ? (
          <div className="cc-inspector__quick">
            <Link
              to={`/inbox?session=${encodeURIComponent(session.id)}`}
              className="fu-btn fu-btn--primary fu-btn--sm cc-inspector__quick-btn"
            >
              <MaterialSymbol name="inbox" size={18} />
              {t('channels.inspector.openInbox', { defaultValue: 'Inbox' })}
            </Link>
            {canWrite && onStop && isSessionRunning(session.status) ? (
              <button
                type="button"
                className="fu-btn fu-btn--ghost fu-btn--sm cc-inspector__quick-btn cc-inspector__quick-btn--stop"
                onClick={onStop}
              >
                <MaterialSymbol name="stop_circle" size={18} />
                {t('sessions.actions.stop')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="cc-inspector__body">
        {showRelinkBanner && canWrite ? (
          <div className="cc-inspector__alert">
            <p>{t(relinkMessageKey)}</p>
            <button
              type="button"
              className="fu-btn fu-btn--primary cc-inspector__alert-btn"
              disabled={relinkingId === session.id}
              onClick={() => void onRelink()}
            >
              {relinkingId === session.id ? <Loader2 className="animate-spin" size={14} /> : null}
              {t('sessions.engine.scanQr')}
            </button>
          </div>
        ) : null}

        <div>
          <h4 className="cc-inspector__section-label">
            {t('channels.inspector.connectionDetails')}
          </h4>
          <div className="cc-inspector__panel">
            <div>
              <p className="cc-inspector__field-label">{t('sessions.details.sessionId')}</p>
              <p className="cc-inspector__field-value">{session.id}</p>
            </div>
            <div>
              <p className="cc-inspector__field-label">{t('sessions.details.engine')}</p>
              <p className="cc-inspector__field-value">
                {engines.find(e => e.id === (session.effectiveEngineType ?? currentEngineId))?.name ??
                  session.effectiveEngineType ??
                  currentEngineLabel}
              </p>
            </div>
            <div>
              <p className="cc-inspector__field-label">{t('sessions.details.lastActive')}</p>
              <p className="cc-inspector__field-value">
                {session.lastActive
                  ? new Date(session.lastActive).toLocaleString()
                  : t('common.never')}
              </p>
            </div>
            {linkSafetyDisplay ? (
              <div className="cc-inspector__panel-divider">
                <div className="cc-inspector__panel-row">
                  <div
                    className={`cc-card__metric${
                      linkSafetyDisplay.tone === 'ok' ? ' cc-card__metric--ok' : ''
                    }`}
                  >
                    <MaterialSymbol name="verified_user" size={16} />
                    <span className="cc-inspector__field-value">{linkSafetyDisplay.label}</span>
                  </div>
                  <Link
                    to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
                    className="cc-inspector__review"
                  >
                    {t('channels.inspector.review', { defaultValue: 'Review' })}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {healthEntry ? (
          <div>
            <h4 className="cc-inspector__section-label">{t('sessions.health.engineTitle')}</h4>
            <div className="cc-inspector__kv">
              <div className="cc-inspector__kv-row">
                <span>{t('sessions.health.liveStatus')}</span>
                <span className={healthIssue ? 'cc-inspector__kv-error' : ''}>
                  {formatStatus(healthEntry.liveStatus)}
                </span>
              </div>
              <div className="cc-inspector__kv-row">
                <span>{t('sessions.health.engine')}</span>
                <span>
                  {healthEntry.enginePresent
                    ? t('sessions.health.engineRunning')
                    : t('sessions.health.engineStopped')}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {canWrite ? (
          <div>
            <h4 className="cc-inspector__section-label">{t('channels.inspector.settings')}</h4>
            <div className="cc-inspector__toggles">
              <label className="cc-inspector__toggle">
                <span>{t('sessions.details.aiAutoReply')}</span>
                <input
                  type="checkbox"
                  className="cc-inspector__switch"
                  checked={session.aiAutoReplyEnabled !== false}
                  disabled={savingAiAutoReply}
                  onChange={e => onAiAutoReplyToggle(e.target.checked)}
                />
              </label>
              <label className="cc-inspector__toggle">
                <span>{t('sessions.details.followupAutopilot')}</span>
                <input
                  type="checkbox"
                  className="cc-inspector__switch"
                  checked={session.followupAutopilotEnabled === true}
                  disabled={savingFollowupAutopilot}
                  onChange={e => onFollowupAutopilotToggle(e.target.checked)}
                />
              </label>
              <label className="cc-inspector__toggle">
                <span>{t('channels.inspector.connectionProxy', { defaultValue: 'Connection proxy' })}</span>
                <input
                  type="checkbox"
                  className="cc-inspector__switch"
                  checked={proxyConfigured || proxyExpanded}
                  onChange={e => {
                    if (e.target.checked) {
                      setProxyExpanded(true);
                    } else {
                      setProxyExpanded(false);
                      onProxyToggle(false);
                    }
                  }}
                />
              </label>
            </div>
            {showProxyFields ? (
              <div className="cc-inspector__extra">
                <input
                  type="text"
                  className="cc-inspector__input"
                  value={proxyUrlText}
                  onChange={e => onProxyUrlChange(e.target.value)}
                  placeholder={t('sessions.create.proxyUrlPlaceholder')}
                />
                <select
                  className="cc-inspector__select"
                  value={proxyType}
                  onChange={e =>
                    onProxyTypeChange(e.target.value as 'http' | 'https' | 'socks4' | 'socks5')
                  }
                >
                  <option value="socks5">SOCKS5</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks4">SOCKS4</option>
                </select>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <div className="cc-inspector__footer">
          <button
            type="button"
            className="fu-btn fu-btn--primary cc-inspector__save"
            disabled={saving}
            onClick={onSaveAll}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            {t('channels.inspector.saveChanges')}
          </button>
          <div className="cc-inspector__footer-row">
            <button
              type="button"
              className={`fu-btn fu-btn--sm cc-inspector__action${
                disconnected ? ' fu-btn--primary cc-inspector__action--scan' : ' fu-btn--ghost'
              }`}
              disabled={relinkingId === session.id}
              onClick={handleScanQr}
            >
              <MaterialSymbol name="qr_code" size={16} />
              {t('sessions.engine.scanQr')}
            </button>
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm cc-inspector__action"
              disabled={!canRestart}
              onClick={() => onRestart()}
            >
              <MaterialSymbol name="restart_alt" size={16} />
              {t('sessions.actions.restart')}
            </button>
          </div>
          <button type="button" className="cc-inspector__delete" onClick={() => onDelete()}>
            {t('channels.inspector.deleteChannel')}
          </button>
        </div>
      ) : null}
    </>
  );
}

export function ChannelDetailEmpty({ message }: { message: string }) {
  return (
    <div className="cc-inspector__empty">
      <MaterialSymbol name="chat_bubble" size={40} />
      <p>{message}</p>
    </div>
  );
}
