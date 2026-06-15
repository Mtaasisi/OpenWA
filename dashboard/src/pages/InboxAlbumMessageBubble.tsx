import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../components/MaterialSymbol';
import type { InboxMessage } from '../services/api';
import { albumCaption } from './inbox-helpers';
import { InboxMessageAlbumGrid } from './InboxMessageAlbumGrid';
import { InboxContactAvatar } from '../components/InboxContactAvatar';
import { InboxGroupMemberAvatar } from '../components/InboxGroupMemberAvatar';
import type { GroupMemberMessageHighlight } from '../lib/group-participants';

interface Props {
  messages: InboxMessage[];
  sessionId: string;
  sessionStatus?: string;
  formatTime: (iso: string) => string;
  tactical?: boolean;
  interaktLayout?: boolean;
  stitchLayout?: boolean;
  contactChatId?: string;
  contactTitle?: string;
  profilePicUrl?: string | null;
  groupSender?: {
    chatId: string;
    label: string;
    selected?: boolean;
  };
  onGroupSenderClick?: (memberId: string) => void;
  onGroupSenderContextMenu?: (event: React.MouseEvent, memberId: string) => void;
  memberHighlight?: GroupMemberMessageHighlight;
  onContextMenu?: (event: React.MouseEvent) => void;
  touchMenuHandlers?: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onTouchStart' | 'onTouchEnd' | 'onTouchMove' | 'onTouchCancel'
  >;
  stackCompact?: boolean;
  stackContinues?: boolean;
}

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function InboxAlbumMessageBubble({
  messages,
  sessionId,
  sessionStatus,
  formatTime,
  tactical = false,
  interaktLayout = false,
  stitchLayout = false,
  contactChatId,
  contactTitle,
  profilePicUrl,
  groupSender,
  onGroupSenderClick,
  onGroupSenderContextMenu,
  memberHighlight,
  onContextMenu,
  touchMenuHandlers,
  stackCompact = false,
  stackContinues = false,
}: Props) {
  const { t } = useTranslation();
  const useInteraktBubble = interaktLayout && !stitchLayout;
  const wrapHighlightClass =
    memberHighlight === 'active'
      ? 'inbox-bubble-wrap--member-active'
      : memberHighlight === 'dimmed'
        ? 'inbox-bubble-wrap--member-dimmed'
        : '';
  const primary = messages[messages.length - 1];
  const incoming = primary.direction === 'incoming';
  const caption = albumCaption(messages);
  const mediaOnly = !caption.trim();
  const showBubbleMeta = !stackContinues;
  const showChecks =
    !incoming && primary.status && ['sent', 'delivered', 'read'].includes(primary.status);

  if (tactical) {
    return (
      <div
        className={`tac-msg ${incoming ? 'tac-msg--in' : 'tac-msg--out'}${wrapHighlightClass ? ` ${wrapHighlightClass}` : ''}`}
        data-message-id={primary.id}
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
          ) : (
            incoming ? 'REMOTE_SRC' : 'LOCAL_OP'
          )}
        </div>
        <div
          className="tac-msg__frame"
          onContextMenu={
            onContextMenu
              ? event => {
                  event.preventDefault();
                  onContextMenu(event);
                }
              : undefined
          }
        >
          <span className="tac-corner tac-corner--tl" />
          <span className="tac-corner tac-corner--tr" />
          <span className="tac-corner tac-corner--bl" />
          <span className="tac-corner tac-corner--br" />
          <InboxMessageAlbumGrid
        messages={messages}
        sessionId={sessionId}
        sessionStatus={sessionStatus}
        interaktLayout={useInteraktBubble}
      />
        </div>
        <div className="tac-msg__meta">
          <span>{formatBubbleTime(primary.createdAt)}</span>
          {showChecks && (
            <span className="tac-msg__checks" aria-label={formatTime(primary.createdAt)}>
              <Check size={10} strokeWidth={3} />
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    );
  }

  const handleBubbleContextMenu = (event: React.MouseEvent) => {
    if (!onContextMenu) return;
    event.preventDefault();
    onContextMenu(event);
  };

  const bubble = (
    <div
      className={`inbox-bubble ${primary.direction}${useInteraktBubble ? ' inbox-bubble--interakt' : ''}${stitchLayout ? ' inbox-bubble--stitch' : ''}${mediaOnly ? ' inbox-bubble--media-only' : ''}${stackCompact ? ' inbox-bubble--stack-follow' : ''}${stackContinues ? ' inbox-bubble--stack-precursor' : ''}`}
      onContextMenu={onContextMenu ? handleBubbleContextMenu : undefined}
    >
      {useInteraktBubble && !incoming && (
        <span className="inbox-interakt-agent-badge">{t('inbox.interakt.agentBadge')}</span>
      )}
      <InboxMessageAlbumGrid
        messages={messages}
        sessionId={sessionId}
        sessionStatus={sessionStatus}
        interaktLayout={useInteraktBubble}
      />
      {!useInteraktBubble && showBubbleMeta ? (
        <div className="inbox-bubble-meta">
          <span className="inbox-interakt-bubble-time">{formatTime(primary.createdAt)}</span>
          {primary.direction === 'outgoing' && primary.status ? ` · ${primary.status}` : null}
        </div>
      ) : null}
    </div>
  );

  const metaOut =
    useInteraktBubble && !incoming && showBubbleMeta ? (
      <div className="inbox-interakt-bubble-meta-row">
        <span className="inbox-interakt-bubble-time">{formatTime(primary.createdAt)}</span>
        {showChecks && (
          <MaterialSymbol
            name="done_all"
            size={12}
            className="inbox-interakt-read-tick inbox-interakt-read-tick--muted"
            aria-hidden
          />
        )}
      </div>
    ) : null;

  const metaIn =
    useInteraktBubble && incoming && showBubbleMeta ? (
      <div className="inbox-interakt-bubble-meta-row inbox-interakt-bubble-meta-row--in">
        <span className="inbox-interakt-bubble-time">{formatTime(primary.createdAt)}</span>
      </div>
    ) : null;

  if (useInteraktBubble && incoming) {
    return (
      <div
        className={[
          'inbox-bubble-wrap incoming inbox-bubble-wrap--interakt',
          stackCompact ? 'inbox-bubble-wrap--stacked' : '',
          wrapHighlightClass,
        ]
          .filter(Boolean)
          .join(' ')}
        data-message-id={primary.id}
        {...touchMenuHandlers}
      >
        {stackCompact ? (
          <span className="inbox-interakt-bubble-avatar-spacer" aria-hidden />
        ) : groupSender ? (
          <InboxGroupMemberAvatar
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            memberId={groupSender.chatId}
            memberLabel={groupSender.label}
            selected={groupSender.selected}
            onClick={() => onGroupSenderClick?.(groupSender.chatId)}
            fetchWhenVisible
          />
        ) : contactChatId && contactTitle ? (
          <span className="inbox-group-member-avatar">
            <InboxContactAvatar
              sessionId={sessionId}
              chatId={contactChatId}
              chatKind="private"
              title={contactTitle}
              profilePicUrl={profilePicUrl}
              sessionStatus={sessionStatus}
              className="inbox-interakt-bubble-avatar inbox-avatar inbox-avatar--private"
              fetchWhenVisible
            />
          </span>
        ) : null}
        <div className="inbox-interakt-bubble-col inbox-interakt-bubble-col--in">
          {groupSender && !stackCompact && (
            <button
              type="button"
              className="inbox-interakt-bubble-sender"
              onClick={() => onGroupSenderClick?.(groupSender.chatId)}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                onGroupSenderContextMenu?.(e, groupSender.chatId);
              }}
            >
              {groupSender.label}
            </button>
          )}
          <div className="inbox-interakt-bubble-shell">{bubble}</div>
          {metaIn}
        </div>
      </div>
    );
  }

  if (useInteraktBubble && !incoming) {
    return (
      <div className="inbox-bubble-wrap outgoing inbox-bubble-wrap--interakt-out">
        <div className="inbox-interakt-bubble-col inbox-interakt-bubble-col--out">
          <div className="inbox-interakt-bubble-shell">{bubble}</div>
          {metaOut}
        </div>
      </div>
    );
  }

  return (
    <div
      className={['inbox-bubble-wrap', primary.direction, stitchLayout ? 'inbox-bubble-wrap--stitch' : '', wrapHighlightClass].filter(Boolean).join(' ')}
      data-message-id={primary.id}
    >
      {bubble}
    </div>
  );
}
