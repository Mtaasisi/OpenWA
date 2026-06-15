import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Download } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { albumCaption } from './inbox-helpers';
import {
  loadMessageMediaBlob,
  getLocalPreviewUrl,
  getMessageMediaMimetype,
  isMessageMediaDownloading,
  isImagePreviewMessage,
  needsManualMediaDownload,
  requestManualMediaDownload,
  resolveMediaSessionId,
  shouldFetchMessageMedia,
  startMediaDownloadPoll,
} from './inbox-media';
import { InboxFormattedMessageBody } from '../lib/whatsapp-format';
import { InboxMediaLightbox } from '../components/InboxMediaLightbox';
import { InboxMediaStarButton } from '../components/InboxMediaStarButton';
import { InboxBlurredMediaPreview } from '../components/InboxBlurredMediaPreview';
import './InboxKeyboardShortcutsDialog.css';

interface Props {
  messages: InboxMessage[];
  sessionId: string;
  sessionStatus?: string;
  interaktLayout?: boolean;
}

function AlbumCell({
  message,
  sessionId,
  sessionStatus,
  overlay,
  onOpen,
}: {
  message: InboxMessage;
  sessionId: string;
  sessionStatus?: string;
  overlay?: string;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualDownloading, setManualDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const localPreviewUrl = getLocalPreviewUrl(message);
  const mediaSessionId = resolveMediaSessionId(message, sessionId);
  const mediaMimetype = getMessageMediaMimetype(message);
  const needsManualDownload = needsManualMediaDownload(message);
  const mediaDownloading = isMessageMediaDownloading(message);

  const applyDownloadedBlob = (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setMediaUrl(url);
  };

  useEffect(() => {
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
  }, [message, mediaSessionId, message.id, sessionStatus, mediaMimetype]);

  useEffect(() => {
    if (!mediaDownloading || mediaUrl) return;
    return startMediaDownloadPoll(mediaSessionId, message.id, {
      fallbackMime: mediaMimetype,
      onBlob: applyDownloadedBlob,
    });
  }, [mediaDownloading, mediaUrl, mediaSessionId, message.id, mediaMimetype]);

  const fullMediaUrl = mediaUrl;
  const previewUrl = localPreviewUrl ?? fullMediaUrl;
  const canOpen = !!fullMediaUrl && !!onOpen;

  const handleManualDownload = () => {
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

  if (isImagePreviewMessage(message) && !fullMediaUrl) {
    if (mediaDownloading && !localPreviewUrl && loading) {
      return (
        <div className="inbox-album__cell inbox-album__cell--loading">
          <Loader2 className="animate-spin" size={18} />
        </div>
      );
    }
    if (needsManualDownload || mediaDownloading || localPreviewUrl) {
      return (
        <InboxBlurredMediaPreview
          message={message}
          thumbUrl={localPreviewUrl}
          albumCell
          iconSize={18}
          busy={manualDownloading || mediaDownloading}
          onClick={
            onOpen
              ? onOpen
              : needsManualDownload
                ? handleManualDownload
                : undefined
          }
        />
      );
    }
  }

  if (needsManualDownload && !fullMediaUrl) {
    return (
      <button
        type="button"
        className="inbox-album__cell inbox-album__cell--download inbox-bubble-media-download"
        disabled={manualDownloading}
        onClick={handleManualDownload}
      >
        {manualDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
        {t('inbox.downloadMedia', { defaultValue: 'Download file' })}
      </button>
    );
  }

  if (loading && !previewUrl) {
    return (
      <div className="inbox-album__cell inbox-album__cell--loading">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (!previewUrl) {
    return <div className="inbox-album__cell inbox-album__cell--empty" aria-hidden />;
  }

  const mediaContent = (
    <>
      <img src={fullMediaUrl ?? previewUrl} alt="" />
      <InboxMediaStarButton message={message} />
      {overlay ? <span className="inbox-album__more">{overlay}</span> : null}
    </>
  );

  if (canOpen) {
    return (
      <button type="button" className="inbox-album__cell inbox-album__cell--button" onClick={onOpen}>
        {mediaContent}
      </button>
    );
  }

  return <div className="inbox-album__cell">{mediaContent}</div>;
}

export function InboxMessageAlbumGrid({ messages, sessionId, sessionStatus, interaktLayout = false }: Props) {
  const caption = albumCaption(messages);
  const count = messages.length;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const gridClass =
    count >= 5
      ? 'inbox-album__grid--count-many'
      : count === 4
        ? 'inbox-album__grid--count-4'
        : count === 3
          ? 'inbox-album__grid--count-3'
          : 'inbox-album__grid--count-2';

  const visible = count > 6 ? messages.slice(0, 5) : messages;
  const extra = count > 6 ? `+${count - 5}` : undefined;

  return (
    <div className={`inbox-album${interaktLayout ? ' inbox-album--interakt' : ''}`}>
      <div className={`inbox-album__grid ${gridClass}`}>
        {visible.map((message, index) => (
          <AlbumCell
            key={message.id}
            message={message}
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            overlay={extra && index === visible.length - 1 ? extra : undefined}
            onOpen={() => {
              const openAt = extra && index === visible.length - 1 ? visible.length : index;
              setLightboxIndex(openAt);
            }}
          />
        ))}
      </div>
      {caption ? (
        <div className="inbox-album__caption">
          <InboxFormattedMessageBody text={caption} />
        </div>
      ) : null}
      {lightboxIndex !== null && (
        <InboxMediaLightbox
          messages={messages}
          initialIndex={lightboxIndex}
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          variant={interaktLayout ? 'interakt' : 'classic'}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
