import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxMediaStarButton } from './InboxMediaStarButton';
import { InboxBlurredMediaPreview } from './InboxBlurredMediaPreview';
import type { InboxMessage } from '../services/api';
import {
  loadMessageMediaBlob,
  getLocalPreviewUrl,
  getMessageMediaMimetype,
  getMediaLightboxPreviewFrameStyle,
  isImagePreviewMessage,
  isMessageMediaDownloading,
  needsManualMediaDownload,
  requestManualMediaDownload,
  resolveMediaSessionId,
  shouldFetchMessageMedia,
  startMediaDownloadPoll,
} from '../pages/inbox-media';

interface Props {
  message: InboxMessage;
  sessionId: string;
  sessionStatus?: string;
}

export function LightboxSlide({
  message,
  sessionId,
  sessionStatus,
}: Props) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualDownloading, setManualDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const localPreviewUrl = getLocalPreviewUrl(message);
  const mediaSessionId = resolveMediaSessionId(message, sessionId);
  const mediaMimetype = getMessageMediaMimetype(message);
  const needsManualDownload = needsManualMediaDownload(message);
  const mediaDownloading = isMessageMediaDownloading(message);
  const imageMedia = isImagePreviewMessage(message);

  const applyDownloadedBlob = (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setMediaUrl(url);
  };

  useEffect(() => {
    if (localPreviewUrl) {
      setMediaUrl(localPreviewUrl);
      return;
    }
    if (!shouldFetchMessageMedia(message)) return;
    let cancelled = false;
    setLoading(true);
    void loadMessageMediaBlob(mediaSessionId, message.id, {
      isCancelled: () => cancelled,
      fallbackMime: mediaMimetype,
    })
      .then(blob => {
        if (cancelled) return;
        setLoading(false);
        if (!blob) return;
        applyDownloadedBlob(blob);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [message, localPreviewUrl, mediaSessionId, message.id, sessionStatus, mediaMimetype]);

  useEffect(() => {
    if (!mediaDownloading || !localPreviewUrl) return;
    if (mediaUrl && mediaUrl !== localPreviewUrl) return;

    return startMediaDownloadPoll(mediaSessionId, message.id, {
      fallbackMime: mediaMimetype,
      onBlob: applyDownloadedBlob,
    });
  }, [mediaDownloading, localPreviewUrl, mediaUrl, mediaSessionId, message.id, mediaMimetype]);

  const fullMediaUrl = mediaUrl && (!localPreviewUrl || mediaUrl !== localPreviewUrl) ? mediaUrl : null;
  const thumbnailUrl = localPreviewUrl;

  const triggerManualDownload = () => {
    setManualDownloading(true);
    void requestManualMediaDownload(message.id)
      .then(ok => {
        if (!ok) {
          setManualDownloading(false);
          return null;
        }
        return loadMessageMediaBlob(mediaSessionId, message.id, { fallbackMime: mediaMimetype });
      })
      .then(blob => {
        setManualDownloading(false);
        if (!blob) return;
        applyDownloadedBlob(blob);
      })
      .catch(() => setManualDownloading(false));
  };

  if (imageMedia && !fullMediaUrl) {
    if (mediaDownloading && !thumbnailUrl && loading) {
      return (
        <div className="inbox-media-lightbox__loading">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }

    if (needsManualDownload || mediaDownloading || thumbnailUrl) {
      return (
        <InboxBlurredMediaPreview
          message={message}
          thumbUrl={thumbnailUrl}
          busy={manualDownloading || mediaDownloading}
          onClick={needsManualDownload ? triggerManualDownload : undefined}
          className="inbox-media-lightbox__preview"
          style={getMediaLightboxPreviewFrameStyle(message)}
          iconSize={24}
        />
      );
    }
  }

  if (needsManualDownload && !fullMediaUrl && !thumbnailUrl) {
    return (
      <div className="inbox-media-lightbox__loading">
        <InboxBlurredMediaPreview
          message={message}
          thumbUrl={null}
          busy={manualDownloading || mediaDownloading}
          onClick={triggerManualDownload}
          className="inbox-media-lightbox__preview"
          style={getMediaLightboxPreviewFrameStyle(message)}
          iconSize={24}
        />
      </div>
    );
  }

  if (loading && !thumbnailUrl && !fullMediaUrl) {
    return (
      <div className="inbox-media-lightbox__loading">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const previewUrl = fullMediaUrl ?? thumbnailUrl;
  if (!previewUrl) return null;

  return (
    <img
      src={previewUrl}
      alt=""
      className="inbox-media-lightbox__image"
    />
  );
}

interface LightboxProps {
  messages: InboxMessage[];
  initialIndex: number;
  sessionId: string;
  sessionStatus?: string;
  onClose: () => void;
  variant?: 'classic' | 'interakt';
}

export function InboxMediaLightbox({
  messages,
  initialIndex,
  sessionId,
  sessionStatus,
  onClose,
  variant = 'classic',
}: LightboxProps) {
  const { t } = useTranslation();
  const isInterakt = variant === 'interakt';
  const [index, setIndex] = useState(initialIndex);
  const current = messages[index];

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, messages]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        setIndex(i => i - 1);
      }
      if (e.key === 'ArrowRight' && index < messages.length - 1) {
        setIndex(i => i + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, messages.length, onClose]);

  if (!current) return null;

  const overlayClass = isInterakt
    ? 'inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template inbox-interakt-picker-overlay--media'
    : 'inbox-media-lightbox-overlay';

  const dialogClass = isInterakt ? 'inbox-interakt-media-lightbox' : 'inbox-media-lightbox';

  return createPortal(
    <div className={overlayClass} onClick={onClose} role="presentation">
      <div
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-label={t('inbox.interakt.mediaLightbox')}
        onClick={e => e.stopPropagation()}
      >
        <header className={isInterakt ? 'inbox-interakt-media-lightbox__head' : 'inbox-media-lightbox__head'}>
          <span className={isInterakt ? 'inbox-interakt-media-lightbox__count' : 'inbox-media-lightbox__count'}>
            {index + 1} / {messages.length}
          </span>
          <div className="inbox-media-lightbox__head-actions">
            <InboxMediaStarButton message={current} className="inbox-media-star-btn--lightbox" />
            <button
              type="button"
              className={isInterakt ? 'inbox-interakt-tpl-modal__preview-close' : 'inbox-media-lightbox__close'}
              onClick={onClose}
              aria-label={t('common.close')}
            >
              {isInterakt ? <MaterialSymbol name="close" size={20} /> : '×'}
            </button>
          </div>
        </header>
        <div className={isInterakt ? 'inbox-interakt-media-lightbox__stage' : 'inbox-media-lightbox__stage'}>
          {index > 0 && (
            <button
              type="button"
              className={isInterakt ? 'inbox-interakt-media-lightbox__nav inbox-interakt-media-lightbox__nav--prev' : 'inbox-media-lightbox__nav inbox-media-lightbox__nav--prev'}
              onClick={() => setIndex(i => i - 1)}
              aria-label={t('inbox.interakt.mediaLightboxPrev')}
            >
              {isInterakt ? <MaterialSymbol name="chevron_left" size={24} /> : '‹'}
            </button>
          )}
          <LightboxSlide message={current} sessionId={sessionId} sessionStatus={sessionStatus} />
          {index < messages.length - 1 && (
            <button
              type="button"
              className={isInterakt ? 'inbox-interakt-media-lightbox__nav inbox-interakt-media-lightbox__nav--next' : 'inbox-media-lightbox__nav inbox-media-lightbox__nav--next'}
              onClick={() => setIndex(i => i + 1)}
              aria-label={t('inbox.interakt.mediaLightboxNext')}
            >
              {isInterakt ? <MaterialSymbol name="chevron_right" size={24} /> : '›'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
