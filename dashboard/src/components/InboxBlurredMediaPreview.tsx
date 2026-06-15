import { Loader2, Download } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { InboxMessage } from '../services/api';
import { getMediaPreviewFrameStyle } from '../pages/inbox-media';

type Props = {
  message: InboxMessage;
  thumbUrl?: string | null;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Album grid cell (square tile) instead of bubble aspect frame. */
  albumCell?: boolean;
  iconSize?: number;
};

export function InboxBlurredMediaPreview({
  message,
  thumbUrl = null,
  busy = false,
  disabled = false,
  onClick,
  className,
  style,
  albumCell = false,
  iconSize = 20,
}: Props) {
  const { t } = useTranslation();
  const chipIcon = busy ? (
    <Loader2 className="animate-spin" size={iconSize} />
  ) : (
    <Download size={iconSize} />
  );

  return (
    <button
      type="button"
      className={[
        albumCell
          ? 'inbox-album__cell inbox-album__cell--thumbnail-download'
          : 'inbox-bubble-media-link inbox-bubble-media-link--button inbox-bubble-media-link--thumbnail',
        !thumbUrl ? ' inbox-bubble-media-link--placeholder' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={albumCell ? undefined : (style ?? getMediaPreviewFrameStyle(message))}
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={t('inbox.downloadMedia', { defaultValue: 'Download file' })}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="inbox-bubble-media-img--thumbnail" />
      ) : (
        <span className="inbox-bubble-media-img--placeholder" aria-hidden />
      )}
      <span className="inbox-bubble-media-download-overlay">
        <span className="inbox-bubble-media-download-chip" aria-hidden>
          {chipIcon}
        </span>
      </span>
    </button>
  );
}
