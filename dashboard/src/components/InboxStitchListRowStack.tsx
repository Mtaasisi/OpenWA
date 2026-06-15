import { useTranslation } from 'react-i18next';
import type { Conversation } from '../services/api';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxConversationPreview } from './InboxConversationPreview';
import {
  formatConversationListTime,
  stitchListRowPill,
} from '../pages/inbox-helpers';
import { formatUnreadCount } from '../pages/useInboxController';

type Props = {
  conv: Conversation;
  title: string;
  isActive: boolean;
  showPinIcon?: boolean;
  contactTyping?: boolean;
};

export function InboxStitchListRowStack({
  conv,
  title,
  isActive,
  showPinIcon = false,
  contactTyping = false,
}: Props) {
  const { t } = useTranslation();
  const pill = stitchListRowPill(conv);
  const showWriting = isActive && contactTyping;
  const showOutgoingTick = conv.lastDirection === 'outgoing';

  return (
    <div className="inbox-stitch-conversation-stack">
      <div className="inbox-stitch-conversation-row inbox-stitch-conversation-row--top">
        <div className="inbox-stitch-conversation-name-row">
          <span className="inbox-conversation-name">{title}</span>
          {pill === 'awaiting' ? (
            <span className="inbox-stitch-pill inbox-stitch-pill--awaiting">
              {t('inbox.stitch.pillAwaiting')}
            </span>
          ) : pill === 'new' ? (
            <span className="inbox-stitch-pill inbox-stitch-pill--new">
              {t('inbox.stitch.pillNew')}
            </span>
          ) : null}
        </div>
        <span className="inbox-conversation-time inbox-stitch-conversation-time">
          {showPinIcon ? (
            <MaterialSymbol
              name="push_pin"
              size={14}
              filled
              className="inbox-stitch-conversation-pin"
            />
          ) : null}
          {showOutgoingTick ? (
            <MaterialSymbol
              name="done_all"
              size={12}
              className="inbox-stitch-conversation-time__tick"
              aria-hidden
            />
          ) : null}
          {formatConversationListTime(conv.lastMessageAt, t)}
        </span>
      </div>
      <div className="inbox-stitch-conversation-row inbox-stitch-conversation-row--bottom">
        <div className="inbox-stitch-conversation-preview-wrap">
          {showWriting ? (
            <span className="inbox-stitch-conversation-preview--writing">
              {t('inbox.stitch.writing')}
            </span>
          ) : (
            <InboxConversationPreview conv={conv} unread={conv.hasUnread} stitchYouPrefix />
          )}
        </div>
        {conv.unreadCount > 0 || conv.hasUnread ? (
          <span
            className="inbox-stitch-unread-badge"
            aria-label={t('inbox.unreadCount', {
              count: Math.max(conv.unreadCount ?? 0, 1),
            })}
          >
            {formatUnreadCount(Math.max(conv.unreadCount ?? 0, 1))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
