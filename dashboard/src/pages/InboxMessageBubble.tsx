import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2, ImageIcon, FileText } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { MESSAGE_COLLAPSE_LENGTH, formatMessageStatus } from './inbox-helpers';
import { fetchMessageMediaBlob, getLocalPreviewUrl, isMediaMessage, mediaLabel } from './inbox-media';

interface InboxMessageBubbleProps {
  message: InboxMessage;
  sessionId: string;
  formatTime: (iso: string) => string;
}

function messageCopyText(msg: InboxMessage): string {
  if (msg.body?.trim()) return msg.body;
  return mediaLabel(msg.type);
}

export function InboxMessageBubble({ message, sessionId, formatTime }: InboxMessageBubbleProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const bodyText = message.body?.trim() ?? '';
  const showMedia = isMediaMessage(message);
  const localPreviewUrl = getLocalPreviewUrl(message);
  const isLong = bodyText.length > MESSAGE_COLLAPSE_LENGTH;
  const displayText =
    bodyText && isLong && !expanded ? `${bodyText.slice(0, MESSAGE_COLLAPSE_LENGTH)}…` : bodyText;

  useEffect(() => {
    if (!showMedia || localPreviewUrl) return;

    let cancelled = false;
    setMediaLoading(true);
    setMediaError(false);

    void fetchMessageMediaBlob(sessionId, message.id).then(blob => {
      if (cancelled) return;
      setMediaLoading(false);
      if (!blob) {
        setMediaError(true);
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageCopyText(message));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const renderMedia = () => {
    const previewUrl = localPreviewUrl ?? mediaUrl;

    if (!localPreviewUrl && mediaLoading) {
      return (
        <div className="inbox-bubble-media inbox-bubble-media--loading">
          <Loader2 className="animate-spin" size={20} />
          <span>{t('inbox.mediaLoading')}</span>
        </div>
      );
    }
    if (mediaError || !previewUrl) {
      return (
        <div className="inbox-bubble-media inbox-bubble-media--error">
          <ImageIcon size={20} />
          <span>{t('inbox.mediaUnavailable')}</span>
        </div>
      );
    }

    if (message.type === 'image' || message.type === 'sticker') {
      return (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inbox-bubble-media-link">
          <img src={previewUrl} alt={mediaLabel(message.type)} className="inbox-bubble-media-img" />
        </a>
      );
    }

    if (message.type === 'video') {
      return <video src={previewUrl} controls className="inbox-bubble-media-video" />;
    }

    if (message.type === 'audio' || message.type === 'ptt') {
      return <audio src={previewUrl} controls className="inbox-bubble-media-audio" />;
    }

    return (
      <a href={previewUrl} download className="inbox-bubble-media-doc">
        <FileText size={18} />
        <span>{t('inbox.downloadMedia')}</span>
      </a>
    );
  };

  return (
    <div className={`inbox-bubble-wrap ${message.direction}`}>
      <div className={`inbox-bubble ${message.direction}`}>
        <div className="inbox-bubble-actions">
          <button
            type="button"
            className="inbox-bubble-action-btn"
            onClick={() => void handleCopy()}
            title={t('inbox.copyMessage')}
            aria-label={t('inbox.copyMessage')}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {copied && <span className="inbox-bubble-copied">{t('inbox.copied')}</span>}
        </div>

        {showMedia && renderMedia()}

        {displayText ? (
          <>
            <div className="inbox-bubble-body">{displayText}</div>
            {isLong && (
              <button
                type="button"
                className="inbox-bubble-toggle"
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? t('inbox.showLess') : t('inbox.readMore')}
              </button>
            )}
          </>
        ) : showMedia ? (
          <div className="inbox-bubble-body inbox-bubble-body--media-only">{mediaLabel(message.type)}</div>
        ) : null}

        <div className="inbox-bubble-meta">
          {formatTime(message.createdAt)}
          {message.direction === 'outgoing' && message.status
            ? ` · ${formatMessageStatus(message.status, t)}`
            : ''}
        </div>
      </div>
    </div>
  );
}
