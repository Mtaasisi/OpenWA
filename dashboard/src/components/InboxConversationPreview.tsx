import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '../services/api';
import { InboxFormattedMessageBody } from '../lib/whatsapp-format';
import { MaterialSymbol } from './MaterialSymbol';
import { getConversationListPreview, stitchListPreviewYouPrefix, type ConversationListPreviewIcon } from '../pages/inbox-helpers';

type Props = {
  conv: Conversation;
  className?: string;
  unread?: boolean;
  /** Stitch list: prefix outgoing previews with "You:" */
  stitchYouPrefix?: boolean;
};

const PREVIEW_ICON: Record<ConversationListPreviewIcon, string> = {
  image: 'photo_camera',
  sticker: 'emoji_emotions',
  video: 'videocam',
  audio: 'mic',
  document: 'description',
  location: 'location_on',
  contact: 'person',
};

export function InboxConversationPreview({ conv, className, unread = false, stitchYouPrefix = false }: Props) {
  const { t } = useTranslation();
  const preview = useMemo(() => getConversationListPreview(conv, t), [conv, t]);
  const youLabel = stitchYouPrefix ? stitchListPreviewYouPrefix(conv, t) : null;

  return (
    <div
      className={[
        'inbox-conversation-preview-row',
        unread ? 'inbox-conversation-preview-row--unread' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {preview.kind === 'media' ? (
        <MaterialSymbol
          name={PREVIEW_ICON[preview.icon]}
          size={16}
          className="inbox-conversation-preview-icon"
          aria-hidden
        />
      ) : null}
      <div className="inbox-conversation-preview">
        {youLabel ? (
          <span className="inbox-stitch-conversation-preview__you">{youLabel} </span>
        ) : null}
        <InboxFormattedMessageBody text={preview.text} />
      </div>
    </div>
  );
}
