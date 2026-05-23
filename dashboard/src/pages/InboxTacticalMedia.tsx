import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { fetchMessageMediaBlob, getLocalPreviewUrl, isMediaMessage, mediaLabel } from './inbox-media';

interface Props {
  message: InboxMessage;
  sessionId: string;
}

export function InboxTacticalMedia({ message, sessionId }: Props) {
  const { t } = useTranslation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const showMedia = isMediaMessage(message);
  const localPreviewUrl = getLocalPreviewUrl(message);

  useEffect(() => {
    if (!showMedia || localPreviewUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchMessageMediaBlob(sessionId, message.id).then(blob => {
      if (cancelled) return;
      setLoading(false);
      if (!blob) {
        setError(true);
        return;
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setMediaUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [showMedia, localPreviewUrl, sessionId, message.id]);

  if (!showMedia) return null;

  const previewUrl = localPreviewUrl ?? mediaUrl;

  if (!localPreviewUrl && loading) {
    return (
      <div className="tac-msg__media tac-msg__media--loading">
        <Loader2 className="animate-spin" size={18} />
        <span>{t('inbox.mediaLoading')}</span>
      </div>
    );
  }

  if (error || !previewUrl) {
    return (
      <div className="tac-msg__media tac-msg__media--error">
        <span className="material-symbols-outlined">image</span>
        <span>{t('inbox.mediaUnavailable')}</span>
      </div>
    );
  }

  if (message.type === 'image' || message.type === 'sticker') {
    return (
      <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="tac-msg__media-link">
        <img src={previewUrl} alt={mediaLabel(message.type)} />
      </a>
    );
  }

  if (message.type === 'video') {
    return <video src={previewUrl} controls className="tac-msg__media-video" />;
  }

  if (message.type === 'audio' || message.type === 'ptt') {
    return <audio src={previewUrl} controls className="tac-msg__media-audio" />;
  }

  return (
    <a href={previewUrl} download className="tac-msg__media-doc">
      <span className="material-symbols-outlined">description</span>
      <span>{t('inbox.downloadMedia')}</span>
    </a>
  );
}
