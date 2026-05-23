import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { MESSAGE_COLLAPSE_LENGTH } from './inbox-helpers';
import { InboxTacticalMedia } from './InboxTacticalMedia';

interface Props {
  message: InboxMessage;
  sessionId: string;
  formatTime: (iso: string) => string;
}

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function InboxTacticalMessageBubble({ message, sessionId, formatTime }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const incoming = message.direction === 'incoming';
  const bodyText = message.body?.trim() ?? '';
  const isLong = bodyText.length > MESSAGE_COLLAPSE_LENGTH;
  const displayText =
    bodyText && isLong && !expanded ? `${bodyText.slice(0, MESSAGE_COLLAPSE_LENGTH)}…` : bodyText;

  const showChecks =
    !incoming &&
    message.status &&
    ['sent', 'delivered', 'read'].includes(message.status);

  return (
    <div className={`tac-msg ${incoming ? 'tac-msg--in' : 'tac-msg--out'}`}>
      <div className="tac-msg__label">
        {incoming ? t('inbox.tactical.remoteSrc') : t('inbox.tactical.localOp')}
      </div>
      <div className="tac-msg__frame">
        <span className="tac-corner tac-corner--tl" />
        <span className="tac-corner tac-corner--tr" />
        <span className="tac-corner tac-corner--bl" />
        <span className="tac-corner tac-corner--br" />
        <InboxTacticalMedia message={message} sessionId={sessionId} />
        {displayText ? <p className="tac-msg__body">{displayText}</p> : null}
        {isLong && (
          <button type="button" className="tac-msg__more" onClick={() => setExpanded(v => !v)}>
            {expanded ? t('inbox.showLess') : t('inbox.readMore')}
          </button>
        )}
      </div>
      <div className="tac-msg__meta">
        <span>{formatBubbleTime(message.createdAt)}</span>
        {showChecks && (
          <span className="tac-msg__checks" aria-label={formatTime(message.createdAt)}>
            <Check size={10} strokeWidth={3} />
            <Check size={10} strokeWidth={3} />
          </span>
        )}
        {!incoming && message.status === 'pending' && (
          <span className="tac-msg__status">{t('inbox.messageStatus.pending')}</span>
        )}
        {!incoming && message.status === 'failed' && (
          <span className="tac-msg__status tac-msg__status--err">{t('inbox.messageStatus.failed')}</span>
        )}
      </div>
    </div>
  );
}
