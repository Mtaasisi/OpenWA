import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { sessionAccentColor } from '../pages/inbox-helpers';
import type { Session } from '../services/api';
import { channelsUrl } from '../lib/channel-routes';
import {
  isLinkedSessionRecovering,
  LINKED_SESSION_RECOVERY_TIMEOUT_MS,
} from '../lib/linked-session-recovery';
import './InboxActiveSendAccount.css';

type SendSession = Pick<Session, 'id' | 'name' | 'phone' | 'status' | 'requiresRelink'>;

interface InboxActiveSendAccountProps {
  session: SendSession | null | undefined;
  className?: string;
  onReconnect?: (sessionId: string) => void;
  /** Hide when exactly one session is connected — redundant in single-account setups. */
  connectedReadyCount?: number;
  variant?: 'default' | 'interakt' | 'tactical';
}

export function InboxActiveSendAccount({
  session,
  className,
  onReconnect,
  connectedReadyCount,
  variant = 'default',
}: InboxActiveSendAccountProps) {
  const { t } = useTranslation();
  const [recoveryTimedOut, setRecoveryTimedOut] = useState(false);

  const recovering = session ? isLinkedSessionRecovering(session) : false;

  useEffect(() => {
    if (!recovering) {
      setRecoveryTimedOut(false);
      return;
    }
    const timer = setTimeout(
      () => setRecoveryTimedOut(true),
      LINKED_SESSION_RECOVERY_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [recovering, session?.id, session?.status]);

  if (!session) return null;

  const accent = sessionAccentColor(session.id);
  const connected = session.status === 'ready';

  if (connected && connectedReadyCount === 1) return null;

  const reconnectControl =
    onReconnect != null ? (
      <button
        type="button"
        className="inbox-send-account__reconnect"
        onClick={() => onReconnect(session.id)}
      >
        {t('inbox.reconnectAccount', { defaultValue: 'Reconnect' })}
      </button>
    ) : (
      <Link
        to={channelsUrl({ channel: 'whatsapp', sessionFocus: session.id, reconnect: true })}
        className="inbox-send-account__reconnect"
      >
        {t('inbox.reconnectAccount', { defaultValue: 'Reconnect' })}
      </Link>
    );

  const showAutoRecovering = recovering && !recoveryTimedOut;

  const variantClass =
    variant === 'interakt'
      ? 'inbox-send-account--interakt'
      : variant === 'tactical'
        ? 'inbox-send-account--tactical'
        : '';

  if (!connected) {
    return (
      <div
        className={[
          'inbox-send-account',
          showAutoRecovering
            ? 'inbox-send-account--recovering'
            : 'inbox-send-account--disconnected',
          variantClass,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        role="status"
        aria-live="polite"
        style={{ '--send-account-accent': accent } as React.CSSProperties}
      >
        <span className="inbox-send-account__dot" aria-hidden />
        <span className="inbox-send-account__name">{session.name}</span>
        {showAutoRecovering ? (
          <span className="inbox-send-account__recovering">
            <Loader2 className="inbox-send-account__recovering-icon animate-spin" size={14} aria-hidden />
            {t('inbox.reconnectingAccount', { defaultValue: 'Reconnecting…' })}
          </span>
        ) : (
          <>
            <span className="inbox-send-account__muted">
              {t('inbox.sessionNotConnected', { defaultValue: 'Not connected' })}
            </span>
            {reconnectControl}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        'inbox-send-account',
        'inbox-send-account--ready',
        variantClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      style={{ '--send-account-accent': accent } as React.CSSProperties}
    >
      <span className="inbox-send-account__dot is-ready" aria-hidden />
      <span className="inbox-send-account__label">{t('inbox.sendingFrom', { defaultValue: 'Sending from:' })}</span>
      <strong className="inbox-send-account__name">{session.name}</strong>
      {variant === 'default' && session.phone ? (
        <span className="inbox-send-account__phone">{session.phone}</span>
      ) : null}
    </div>
  );
}
