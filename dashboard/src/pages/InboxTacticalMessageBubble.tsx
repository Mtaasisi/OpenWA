import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Bot, Copy } from 'lucide-react';
import { isAiAutoReplyMessage } from '../lib/inbox-message-source';
import type { InboxMessage } from '../services/api';
import { MESSAGE_COLLAPSE_LENGTH } from './inbox-helpers';
import { InboxFormattedMessageBody } from '../lib/whatsapp-format';
import type { GroupMemberMessageHighlight } from '../lib/group-participants';
import { InboxTacticalMedia } from './InboxTacticalMedia';
import { InboxFailedMessageActions } from '../components/InboxFailedMessageActions';

interface Props {
  message: InboxMessage;
  sessionId: string;
  sessionStatus?: string;
  formatTime: (iso: string) => string;
  groupSender?: {
    chatId: string;
    label: string;
    selected?: boolean;
  };
  onGroupSenderClick?: (memberId: string) => void;
  onGroupSenderContextMenu?: (event: React.MouseEvent, memberId: string) => void;
  memberHighlight?: GroupMemberMessageHighlight;
  onContextMenu?: (
    event: React.MouseEvent,
    helpers: { openLightbox: () => void },
  ) => void;
  touchMenuHandlers?: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onTouchStart' | 'onTouchEnd' | 'onTouchMove' | 'onTouchCancel'
  >;
}

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function messageCopyText(msg: InboxMessage): string {
  return msg.body?.trim() ?? msg.type;
}

export function InboxTacticalMessageBubble({
  message,
  sessionId,
  sessionStatus,
  formatTime,
  groupSender,
  onGroupSenderClick,
  onGroupSenderContextMenu,
  memberHighlight,
  onContextMenu,
  touchMenuHandlers,
}: Props) {
  const { t } = useTranslation();
  const wrapHighlightClass =
    memberHighlight === 'active'
      ? 'inbox-bubble-wrap--member-active'
      : memberHighlight === 'dimmed'
        ? 'inbox-bubble-wrap--member-dimmed'
        : '';
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const incoming = message.direction === 'incoming';
  const aiReply = isAiAutoReplyMessage(message);
  const bodyText = message.body?.trim() ?? '';
  const isLong = bodyText.length > MESSAGE_COLLAPSE_LENGTH;
  const displayText =
    bodyText && isLong && !expanded ? `${bodyText.slice(0, MESSAGE_COLLAPSE_LENGTH)}…` : bodyText;

  const showChecks =
    !incoming &&
    message.status &&
    ['sent', 'delivered', 'read'].includes(message.status);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageCopyText(message));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={[
        'tac-msg',
        incoming ? 'tac-msg--in' : 'tac-msg--out',
        wrapHighlightClass,
      ]
        .filter(Boolean)
        .join(' ')}
      data-message-id={message.id}
      {...touchMenuHandlers}
    >
      <div className="tac-msg__label">
        {groupSender ? (
          <button
            type="button"
            className={[
              'tac-msg__sender',
              groupSender.selected ? 'tac-msg__sender--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onGroupSenderClick?.(groupSender.chatId)}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              onGroupSenderContextMenu?.(e, groupSender.chatId);
            }}
          >
            {groupSender.label}
          </button>
        ) : incoming ? (
          t('inbox.tactical.remoteSrc')
        ) : (
          t('inbox.tactical.localOp')
        )}
      </div>
      <div
        className="tac-msg__frame"
        onContextMenu={
          onContextMenu
            ? event => {
                event.preventDefault();
                onContextMenu(event, { openLightbox: () => undefined });
              }
            : undefined
        }
      >
        <span className="tac-corner tac-corner--tl" />
        <span className="tac-corner tac-corner--tr" />
        <span className="tac-corner tac-corner--bl" />
        <span className="tac-corner tac-corner--br" />
        <div className="tac-msg__actions">
          <button
            type="button"
            className="tac-msg__copy"
            onClick={() => void handleCopy()}
            title={t('inbox.copyMessage')}
            aria-label={t('inbox.copyMessage')}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <InboxTacticalMedia message={message} sessionId={sessionId} sessionStatus={sessionStatus} />
        {displayText ? (
          <p className="tac-msg__body">
            <InboxFormattedMessageBody text={displayText} />
          </p>
        ) : null}
        {isLong && (
          <button type="button" className="tac-msg__more" onClick={() => setExpanded(v => !v)}>
            {expanded ? t('inbox.showLess') : t('inbox.readMore')}
          </button>
        )}
      </div>
      <div className="tac-msg__meta">
        {aiReply && (
          <span className="tac-msg__ai-badge" title={t('inbox.aiAutoReplyBadge')}>
            <Bot size={10} aria-hidden />
            {t('inbox.aiAutoReplyBadge')}
          </span>
        )}
        <span>{formatBubbleTime(message.createdAt)}</span>
        {showChecks && (
          <span className="tac-msg__checks" aria-label={formatTime(message.createdAt)}>
            <Check size={10} strokeWidth={3} />
            <Check size={10} strokeWidth={3} />
          </span>
        )}
        {!incoming && message.status === 'pending' && (
          <span className="tac-msg__checks tac-msg__checks--pending" aria-label={t('inbox.messageStatus.pending')}>
            <Clock size={11} strokeWidth={2.5} />
          </span>
        )}
        {!incoming && message.status === 'failed' && (
          <span className="tac-msg__status tac-msg__status--err">{t('inbox.messageStatus.failed')}</span>
        )}
      </div>
      {!incoming && message.status === 'failed' && (
        <InboxFailedMessageActions message={message} sessionId={sessionId} />
      )}
    </div>
  );
}
