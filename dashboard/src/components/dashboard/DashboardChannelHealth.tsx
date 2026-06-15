import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import {
  ChannelBadge,
  AccountBadge,
  StatusBadge,
  QuickActionButton,
  ComingSoonPanel,
  EmptyState,
} from './index';
import { unreadBySession } from '../../lib/dashboard-metrics';
import { isSessionRunning } from '../../lib/session-status';
import { useStopSessionMutation } from '../../hooks/queries';
import { useSmsStatus } from '../../hooks/useLinkedChannels';
import { channelsUrl } from '../../lib/channel-routes';
import type { Conversation, Session, SmsStatusView } from '../../services/api';
import { getComingSoonChannels, type SmsChannelStatus } from '../../lib/channels';
import { whatsappSafetyTabHref } from '../settings/settings-nav-registry';
import type { SessionSafetyInfo } from '../../lib/dashboard-metrics';

interface DashboardChannelHealthProps {
  sessions: Session[];
  conversations: Conversation[];
  compact?: boolean;
  failedBySession?: Record<string, number>;
  sessionSafety?: Record<string, SessionSafetyInfo>;
}

function sessionStatusVariant(
  session: Session,
): 'connected' | 'warning' | 'disconnected' {
  if (session.requiresRelink) return 'warning';
  if (session.status === 'ready') return 'connected';
  if (
    session.status === 'qr_ready' ||
    session.status === 'authenticating' ||
    session.status === 'initializing'
  ) {
    return 'warning';
  }
  return 'disconnected';
}

function sessionStatusLabel(session: Session, t: (k: string) => string): string {
  if (session.requiresRelink) return t('dashboard.controlRoom.channel.engineRelink');
  if (session.status === 'ready') return t('dashboard.controlRoom.channel.connected');
  if (session.status === 'qr_ready') return t('dashboard.controlRoom.channel.qrNeeded');
  if (session.status === 'authenticating' || session.status === 'initializing') {
    return t('sessionStatus.' + session.status);
  }
  return t('dashboard.controlRoom.channel.disconnected');
}

function smsStatusVariant(
  sms: SmsStatusView | undefined,
): 'connected' | 'warning' | 'disconnected' {
  if (!sms?.configured) return 'warning';
  if (sms.status === 'connected' && sms.connected) return 'connected';
  if (sms.status === 'failed') return 'disconnected';
  return 'warning';
}

function smsStatusLabel(sms: SmsStatusView | undefined, t: (k: string) => string): string {
  if (!sms?.configured) return t('dashboard.controlRoom.channel.smsNotConfigured');
  return t(`channels.smsStatus.${sms.status as SmsChannelStatus}`);
}

function smsHasAttentionIssue(sms: SmsStatusView | undefined): boolean {
  if (!sms?.configured) return false;
  return (
    sms.status === 'failed' ||
    sms.lowBalance ||
    sms.status === 'low_balance' ||
    sms.status === 'disabled' ||
    (sms.isEnabled && !sms.connected)
  );
}

function shouldShowSmsCompact(sms: SmsStatusView | undefined): boolean {
  if (!sms?.configured) return false;
  return sms.connected || smsHasAttentionIssue(sms);
}

export function DashboardChannelHealth({
  sessions,
  conversations,
  compact,
  failedBySession = {},
  sessionSafety = {},
}: DashboardChannelHealthProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stopMutation = useStopSessionMutation();
  const { data: smsStatus } = useSmsStatus();
  const unreadMap = unreadBySession(conversations);
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.requiresRelink && !b.requiresRelink) return -1;
    if (!a.requiresRelink && b.requiresRelink) return 1;
    return 0;
  });
  const visibleSessions = compact ? sortedSessions.slice(0, 3) : sortedSessions;
  const relinkCount = sessions.filter(s => s.requiresRelink).length;
  const showSmsCard = !compact || shouldShowSmsCompact(smsStatus);
  const smsVariant = smsStatusVariant(smsStatus);
  const smsMuted = smsVariant === 'disconnected';

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.channelHealth')}
      icon={<MaterialSymbol name="sensors" size={20} className="dash-section__title-icon" />}
      linkTo={compact ? '/channels' : '/channels'}
      linkLabel={compact ? undefined : t('dashboard.controlRoom.openChannels')}
      className={compact ? 'dash-section--compact dash-section--channel-rail' : undefined}
    >
      {relinkCount > 0 ? (
        <p className="dash-channel-relink-hint">
          {t('dashboard.controlRoom.channel.engineRelinkHint', { count: relinkCount })}
        </p>
      ) : null}
      {visibleSessions.length === 0 ? (
        <EmptyState title={t('dashboard.noSessions')} className="dash-inline-empty" />
      ) : (
        visibleSessions.map(session => {
          const variant = sessionStatusVariant(session);
          const unread = unreadMap[session.id] ?? 0;
          const failed = failedBySession[session.id] ?? 0;
          const safety = sessionSafety[session.id];
          const muted = variant === 'disconnected' && !session.requiresRelink;
          return (
            <div key={session.id} className={`dash-channel-card${muted ? ' dash-channel-card--muted' : ''}`}>
              <div className="dash-channel-card__header">
                <div>
                  <ChannelBadge channel="whatsapp" />
                  <div style={{ marginTop: '0.35rem' }}>
                    <AccountBadge name={session.name} subtitle={session.phone ?? undefined} />
                  </div>
                </div>
                {variant === 'connected' ? (
                  <MaterialSymbol name="check_circle" size={22} style={{ color: 'var(--dash-mac-green, #28c840)' }} />
                ) : (
                  <StatusBadge
                    variant={variant === 'warning' ? 'warning' : 'disconnected'}
                  >
                    {sessionStatusLabel(session, t)}
                  </StatusBadge>
                )}
              </div>
              {session.requiresRelink && (
                <span className="dash-channel-card__stat-compact dash-channel-card__stat--danger">
                  {t('dashboard.controlRoom.channel.engineRelink')}
                </span>
              )}
              {safety?.linkSafetyReady === false && (safety.linkSafetyIssues ?? 0) > 0 && (
                <span className="dash-channel-card__stat-compact dash-channel-card__stat--danger">
                  {t('dashboard.controlRoom.channel.linkSafetyIssues', {
                    count: safety.linkSafetyIssues,
                  })}
                </span>
              )}
              {compact && failed > 0 && (
                <span className="dash-channel-card__stat-compact dash-channel-card__stat--danger">
                  {t('dashboard.controlRoom.channel.failedSends', { count: failed })}
                </span>
              )}
              {compact && safety?.warmupDay != null && (
                <span className="dash-channel-card__stat-compact">
                  {t('dashboard.controlRoom.channel.warmupDay', { day: safety.warmupDay })}
                </span>
              )}
              {compact && safety?.automationPaused && (
                <span className="dash-channel-card__stat-compact dash-channel-card__stat--danger">
                  {t('dashboard.controlRoom.channel.automationPaused')}
                </span>
              )}
              {!compact && (
                <>
                  <div className="dash-channel-card__stats">
                    {unread > 0 && (
                      <span>{t('dashboard.controlRoom.channel.unread', { count: unread })}</span>
                    )}
                    {failed > 0 && (
                      <span className="dash-channel-card__stat--danger">
                        {t('dashboard.controlRoom.channel.failedSends', { count: failed })}
                      </span>
                    )}
                    {safety?.warmupDay != null && (
                      <span>
                        {t('dashboard.controlRoom.channel.warmupDay', { day: safety.warmupDay })}
                      </span>
                    )}
                    {(safety?.queuePending ?? 0) > 0 && (
                      <span>
                        {t('dashboard.controlRoom.channel.queuePending', { count: safety!.queuePending! })}
                      </span>
                    )}
                    {safety?.automationPaused && (
                      <span className="dash-channel-card__stat--danger">
                        {t('dashboard.controlRoom.channel.automationPaused')}
                      </span>
                    )}
                    {safety?.healthAlert && (
                      <span className="dash-channel-card__stat--danger">{safety.healthAlert}</span>
                    )}
                    {safety?.linkSafetyReady === false && (safety.linkSafetyIssues ?? 0) > 0 && (
                      <span className="dash-channel-card__stat--danger">
                        {t('dashboard.controlRoom.channel.linkSafetyIssues', {
                          count: safety.linkSafetyIssues,
                        })}
                      </span>
                    )}
                    {session.aiAutoReplyEnabled && (
                      <span>{t('dashboard.controlRoom.channel.autoReplyOn')}</span>
                    )}
                  </div>
                  <div className="dash-channel-card__actions">
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.openInbox')}
                      onClick={() => navigate('/inbox')}
                    />
                    {safety?.linkSafetyReady === false && (safety.linkSafetyIssues ?? 0) > 0 ? (
                      <QuickActionButton
                        label={t('whatsappLinkSafety.bannerAction')}
                        onClick={() => navigate(whatsappSafetyTabHref('overview'))}
                      />
                    ) : null}
                    {(session.requiresRelink ||
                      session.status === 'qr_ready' ||
                      session.status === 'disconnected') && (
                      <QuickActionButton
                        label={t('dashboard.controlRoom.actions.scanQr')}
                        onClick={() =>
                          navigate(
                            channelsUrl({
                              channel: 'whatsapp',
                              sessionFocus: session.id,
                              reconnect: true,
                            }),
                          )
                        }
                      />
                    )}
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.settings')}
                      onClick={() => navigate('/channels')}
                    />
                    {(safety?.queuePending ?? 0) > 0 && (
                      <QuickActionButton
                        label={t('dashboard.controlRoom.actions.reviewWaQueue')}
                        onClick={() => navigate(whatsappSafetyTabHref('queue'))}
                      />
                    )}
                    {isSessionRunning(session.status) && (
                      <QuickActionButton
                        label={t('dashboard.disconnect')}
                        onClick={() => void stopMutation.mutateAsync(session.id)}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}

      {showSmsCard && (
        <div
          className={`dash-channel-card${smsMuted ? ' dash-channel-card--muted' : ''}`}
          style={visibleSessions.length > 0 ? { marginTop: compact ? '0.5rem' : '0.75rem' } : undefined}
        >
          <div className="dash-channel-card__header">
            <div>
              <ChannelBadge channel="sms" />
              <p className="dash-channel-card__subtitle" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                {t('dashboard.controlRoom.channel.smsOutgoingOnly')}
              </p>
            </div>
            {smsVariant === 'connected' ? (
              <MaterialSymbol name="check_circle" size={22} style={{ color: 'var(--dash-mac-green, #28c840)' }} />
            ) : (
              <StatusBadge variant={smsVariant === 'warning' ? 'warning' : 'disconnected'}>
                {smsStatusLabel(smsStatus, t)}
              </StatusBadge>
            )}
          </div>
          {compact && smsStatus?.lastError && smsStatus.status === 'failed' && (
            <span className="dash-channel-card__stat-compact dash-channel-card__stat--danger">
              {smsStatus.lastError}
            </span>
          )}
          {!compact && (
            <>
              <div className="dash-channel-card__stats">
                {smsStatus?.lastBalance != null && (
                  <span>{t('dashboard.controlRoom.channel.smsBalance', { balance: smsStatus.lastBalance })}</span>
                )}
                {smsStatus?.lowBalance && (
                  <span className="dash-channel-card__stat--danger">
                    {t('dashboard.controlRoom.channel.smsLowBalance')}
                  </span>
                )}
                {smsStatus?.lastError && smsStatus.status === 'failed' && (
                  <span className="dash-channel-card__stat--danger">{smsStatus.lastError}</span>
                )}
              </div>
              <div className="dash-channel-card__actions">
                <QuickActionButton
                  label={t('dashboard.controlRoom.actions.openSmsSettings')}
                  onClick={() => navigate(channelsUrl({ channel: 'sms' }))}
                />
                {smsStatus?.configured && (
                  <QuickActionButton
                    label={t('channels.smsCheckBalance')}
                    onClick={() => navigate(channelsUrl({ channel: 'sms' }))}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!compact && (
        <>
          <h3 className="dash-section__title" style={{ marginTop: '1.25rem', fontSize: '0.875rem' }}>
            {t('dashboard.controlRoom.channel.futureChannels')}
          </h3>
          <div className="dash-coming-soon-grid">
            {getComingSoonChannels().map(ch => (
              <ComingSoonPanel key={ch.id} title={t(ch.labelKey)} showStatusBadge />
            ))}
          </div>
          <button
            type="button"
            className="dash-provision-channel"
            style={{ marginTop: '0.75rem' }}
            onClick={() => navigate(channelsUrl({ add: true }))}
          >
            <MaterialSymbol name="add" size={18} />
            {t('dashboard.controlRoom.provisionChannel')}
          </button>
        </>
      )}
    </DashboardSection>
  );
}
