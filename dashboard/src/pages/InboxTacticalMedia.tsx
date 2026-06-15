import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Download } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import {
  loadMessageMediaBlob,
  createMediaObjectUrl,
  getLocalPreviewUrl,
  getMessageMediaMimetype,
  isImagePreviewMessage,
  isMediaMessage,
  isMessageMediaDownloading,
  mediaLabel,
  needsManualMediaDownload,
  normalizeMessageType,
  requestManualMediaDownload,
  resolveMediaSessionId,
  shouldFetchMessageMedia,
  shouldShowBlurredMediaPreview,
  startMediaDownloadPoll,
} from './inbox-media';
import { wrapInboxMediaWithStar } from '../components/InboxMediaStarButton';
import { InboxBlurredMediaPreview } from '../components/InboxBlurredMediaPreview';

interface Props {
  message: InboxMessage;
  sessionId: string;
  sessionStatus?: string;
}

export function InboxTacticalMedia({ message, sessionId, sessionStatus }: Props) {
  const { t } = useTranslation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualDownloading, setManualDownloading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const showMedia = isMediaMessage(message);
  const localPreviewUrl = getLocalPreviewUrl(message);
  const mediaSessionId = resolveMediaSessionId(message, sessionId);
  const mediaMimetype = getMessageMediaMimetype(message);
  const needsManualDownload = needsManualMediaDownload(message);
  const mediaDownloading = isMessageMediaDownloading(message);

  const applyDownloadedBlob = (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = createMediaObjectUrl(blob, mediaMimetype);
    if (!url) {
      setError(true);
      return;
    }
    objectUrlRef.current = url;
    setMediaUrl(url);
    setError(false);
  };

  useEffect(() => {
    if (!shouldFetchMessageMedia(message)) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setMediaUrl(null);
    void loadMessageMediaBlob(mediaSessionId, message.id, {
      isCancelled: () => cancelled,
      fallbackMime: mediaMimetype,
    })
      .then(blob => {
        if (cancelled) return;
        setLoading(false);
        if (!blob) {
          setError(true);
          return;
        }
        applyDownloadedBlob(blob);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [message, mediaSessionId, message.id, sessionStatus, mediaMimetype]);

  useEffect(() => {
    if (!mediaDownloading || mediaUrl) return;
    return startMediaDownloadPoll(mediaSessionId, message.id, {
      fallbackMime: mediaMimetype,
      onBlob: applyDownloadedBlob,
    });
  }, [mediaDownloading, mediaUrl, mediaSessionId, message.id, mediaMimetype]);

  if (!showMedia) return null;

  const fullMediaUrl = mediaUrl;
  const thumbnailUrl = localPreviewUrl;
  const previewUrl = fullMediaUrl ?? thumbnailUrl;
  const blurredPreview = shouldShowBlurredMediaPreview(message, fullMediaUrl);

  const triggerManualDownload = () => {
    setManualDownloading(true);
    void requestManualMediaDownload(message.id)
      .then(ok => {
        if (!ok) {
          setError(true);
          setManualDownloading(false);
          return null;
        }
        return loadMessageMediaBlob(mediaSessionId, message.id, { fallbackMime: mediaMimetype });
      })
      .then(blob => {
        setManualDownloading(false);
        if (!blob) {
          setError(true);
          return;
        }
        applyDownloadedBlob(blob);
      })
      .catch(() => {
        setManualDownloading(false);
        setError(true);
      });
  };

  const placeholderIconName = () => {
    switch (normalizeMessageType(message.type)) {
      case 'video':
        return 'videocam';
      case 'audio':
      case 'ptt':
        return 'mic';
      case 'document':
        return 'description';
      default:
        return 'image';
    }
  };

  if (blurredPreview && thumbnailUrl) {
    return wrapInboxMediaWithStar(
      message,
      <InboxBlurredMediaPreview
        message={message}
        thumbUrl={thumbnailUrl}
        busy={manualDownloading || mediaDownloading}
        onClick={needsManualDownload ? triggerManualDownload : undefined}
      />,
    );
  }

  if (needsManualDownload && !fullMediaUrl) {
    return (
      <div className="inbox-bubble-media-pending">
        <span className="inbox-bubble-media-pending-label">
          <span className="material-symbols-outlined">{placeholderIconName()}</span>
          {mediaLabel(message.type)}
        </span>
        <button
          type="button"
          className="inbox-bubble-media-download"
          disabled={manualDownloading}
          onClick={triggerManualDownload}
        >
          {manualDownloading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Download size={14} />
          )}
          {t('inbox.downloadMedia', { defaultValue: 'Download' })}
        </button>
      </div>
    );
  }

  if (!localPreviewUrl && loading) {
    return (
      <div className="inbox-bubble-media-status">
        <Loader2 className="animate-spin" size={18} />
        <span>{t('inbox.mediaLoading')}</span>
      </div>
    );
  }

  if ((error || !previewUrl) && !needsManualDownload) {
    return (
      <div className="inbox-bubble-media-status">
        <span className="material-symbols-outlined">image</span>
        <span>{t('inbox.mediaUnavailable')}</span>
      </div>
    );
  }

  if (!previewUrl) {
    return null;
  }
  const mediaSrc = previewUrl;

  if (isImagePreviewMessage(message)) {
    return wrapInboxMediaWithStar(
      message,
      <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="tac-msg__media-link">
        <img src={mediaSrc} alt={mediaLabel(message.type)} />
      </a>,
    );
  }

  if (normalizeMessageType(message.type) === 'video') {
    return wrapInboxMediaWithStar(
      message,
      <video src={mediaSrc} controls className="tac-msg__media-video" />,
    );
  }

  const mediaType = normalizeMessageType(message.type);
  if (mediaType === 'audio' || mediaType === 'ptt') {
    return wrapInboxMediaWithStar(
      message,
      <audio src={mediaSrc} controls className="tac-msg__media-audio" />,
    );
  }

  return wrapInboxMediaWithStar(
    message,
    <a href={mediaSrc} download className="tac-msg__media-doc">
      <span className="material-symbols-outlined">description</span>
      <span>{t('inbox.downloadMedia')}</span>
    </a>,
  );
}
