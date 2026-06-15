import { useState, useEffect, useRef, memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2, ImageIcon, FileText, Clock, Bot, Download, Video, Mic } from 'lucide-react';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { isAiAutoReplyMessage } from '../lib/inbox-message-source';
import type { InboxMessage } from '../services/api';
import { MESSAGE_COLLAPSE_LENGTH, formatMessageStatus } from './inbox-helpers';
import { InboxFormattedMessageBody } from '../lib/whatsapp-format';
import { InboxMediaLightbox } from '../components/InboxMediaLightbox';
import { InboxContactAvatar } from '../components/InboxContactAvatar';
import { InboxGroupMemberAvatar } from '../components/InboxGroupMemberAvatar';
import { wrapInboxMediaWithStar } from '../components/InboxMediaStarButton';
import { InboxFailedMessageActions } from '../components/InboxFailedMessageActions';
import { InboxBlurredMediaPreview } from '../components/InboxBlurredMediaPreview';
import type { GroupMemberMessageHighlight } from '../lib/group-participants';
import {
  loadMessageMediaBlob,
  createMediaObjectUrl,
  getLocalPreviewUrl,
  getMessageMediaMimetype,
  isImagePreviewMessage,
  isMediaMessage,
  isMessageMediaDownloading,
  isMessageMediaKnownUnavailable,
  mediaLabel,
  needsManualMediaDownload,
  normalizeMessageType,
  isRedundantMediaCaption,
  requestManualMediaDownload,
  resolveMediaSessionId,
  revokeTrackedObjectUrl,
  shouldFetchMessageMedia,
  startMediaDownloadPoll,
} from './inbox-media';

interface InboxMessageBubbleProps {
  message: InboxMessage;
  sessionId: string;
  sessionStatus?: string;
  formatTime: (iso: string) => string;
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
  onContextMenu?: (
    event: React.MouseEvent,
    helpers: { openLightbox: () => void },
  ) => void;
  touchMenuHandlers?: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onTouchStart' | 'onTouchEnd' | 'onTouchMove' | 'onTouchCancel'
  >;
  stackCompact?: boolean;
  stackContinues?: boolean;
}

function messageCopyText(msg: InboxMessage): string {
  if (msg.body?.trim()) return msg.body;
  return mediaLabel(msg.type);
}

function showReadTick(status: string | undefined): boolean {
  return status === 'read' || status === 'delivered' || status === 'sent';
}

export const InboxMessageBubble = memo(function InboxMessageBubble({
  message,
  sessionId,
  sessionStatus,
  formatTime,
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
}: InboxMessageBubbleProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [manualDownloading, setManualDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [mediaInView, setMediaInView] = useState(false);
  const useInteraktBubble = interaktLayout && !stitchLayout;

  const bodyText = message.body?.trim() ?? '';
  const aiReply = isAiAutoReplyMessage(message);
  const showMedia = isMediaMessage(message);
  const needsManualDownload = needsManualMediaDownload(message);
  const localPreviewUrl = getLocalPreviewUrl(message);
  const mediaSessionId = resolveMediaSessionId(message, sessionId);
  const mediaMimetype = getMessageMediaMimetype(message);
  const canFetchMedia = shouldFetchMessageMedia(message);
  const mediaDownloading = isMessageMediaDownloading(message);
  const captionText = isRedundantMediaCaption(message, bodyText) ? '' : bodyText;
  const isLong = captionText.length > MESSAGE_COLLAPSE_LENGTH;
  const displayText =
    captionText && isLong && !expanded ? `${captionText.slice(0, MESSAGE_COLLAPSE_LENGTH)}…` : captionText;

  const wrapHighlightClass =
    memberHighlight === 'active'
      ? 'inbox-bubble-wrap--member-active'
      : memberHighlight === 'dimmed'
        ? 'inbox-bubble-wrap--member-dimmed'
        : '';

  const applyDownloadedBlob = (blob: Blob | null) => {
    if (!blob) {
      setMediaError(true);
      return;
    }
    revokeTrackedObjectUrl(objectUrlRef);
    const url = createMediaObjectUrl(blob, mediaMimetype);
    if (!url) {
      setMediaError(true);
      return;
    }
    objectUrlRef.current = url;
    setMediaUrl(url);
    setImgLoadFailed(false);
    setMediaError(false);
  };

  useEffect(() => {
    if (!showMedia || !shouldFetchMessageMedia(message)) return;
    const el = bubbleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMediaInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showMedia, message.id, mediaSessionId]);

  useEffect(() => {
    setImgLoadFailed(false);
  }, [message.id, localPreviewUrl, mediaUrl]);

  useEffect(() => {
    if (!mediaInView || !canFetchMedia) {
      revokeTrackedObjectUrl(objectUrlRef);
      if (!canFetchMedia) {
        setMediaUrl(null);
        setMediaLoading(false);
      }
      return;
    }

    if (isMessageMediaKnownUnavailable(mediaSessionId, message.id)) {
      setMediaLoading(false);
      setMediaError(true);
      return;
    }

    let cancelled = false;
    setMediaLoading(true);
    setMediaError(false);
    setMediaUrl(null);

    void loadMessageMediaBlob(mediaSessionId, message.id, {
      isCancelled: () => cancelled,
      fallbackMime: mediaMimetype,
    })
      .then(blob => {
        if (cancelled) return;
        setMediaLoading(false);
        if (!blob) {
          setMediaError(true);
          return;
        }
        revokeTrackedObjectUrl(objectUrlRef);
        const url = createMediaObjectUrl(blob, mediaMimetype);
        if (!url) {
          setMediaError(true);
          return;
        }
        objectUrlRef.current = url;
        setMediaUrl(url);
      })
      .catch(() => {
        if (cancelled) return;
        setMediaLoading(false);
        setMediaError(true);
      });

    return () => {
      cancelled = true;
      revokeTrackedObjectUrl(objectUrlRef);
    };
  }, [mediaInView, canFetchMedia, mediaSessionId, message.id, sessionStatus, mediaMimetype]);

  useEffect(() => {
    if (!mediaDownloading || !mediaInView || mediaUrl) return;

    return startMediaDownloadPoll(mediaSessionId, message.id, {
      fallbackMime: mediaMimetype,
      onBlob: applyDownloadedBlob,
    });
  }, [mediaDownloading, mediaInView, mediaUrl, mediaSessionId, message.id, mediaMimetype]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageCopyText(message));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const triggerManualDownload = () => {
    setManualDownloading(true);
    void requestManualMediaDownload(message.id)
      .then(ok => {
        if (!ok) {
          setMediaError(true);
          setManualDownloading(false);
          return;
        }
        setManualDownloading(false);
        void loadMessageMediaBlob(mediaSessionId, message.id, {
          fallbackMime: mediaMimetype,
        }).then(applyDownloadedBlob);
      })
      .catch(() => {
        setManualDownloading(false);
        setMediaError(true);
      });
  };

  const mediaPlaceholderIcon = () => {
    switch (normalizeMessageType(message.type)) {
      case 'video':
        return <Video size={20} aria-hidden />;
      case 'audio':
      case 'ptt':
        return <Mic size={20} aria-hidden />;
      case 'document':
        return <FileText size={20} aria-hidden />;
      default:
        return <ImageIcon size={20} aria-hidden />;
    }
  };

  const renderManualDownloadButton = () => (
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
  );

  const renderMediaPlaceholder = () => (
    <div className="inbox-bubble-media-pending">
      <span className="inbox-bubble-media-pending-label">
        {mediaPlaceholderIcon()}
        {mediaLabel(message.type)}
      </span>
      {renderManualDownloadButton()}
    </div>
  );

  const renderBlurredPreview = (thumbUrl: string | null, onClick?: () => void) => (
    <InboxBlurredMediaPreview
      message={message}
      thumbUrl={thumbUrl}
      busy={manualDownloading || mediaDownloading}
      onClick={onClick}
    />
  );

  const renderMediaStatus = (kind: 'loading' | 'error', messageText: string, icon?: ReactNode) => (
    <div className={`inbox-bubble-media-status inbox-bubble-media-status--${kind}`}>
      {icon ?? (kind === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />)}
      <span>{messageText}</span>
    </div>
  );

  const renderMedia = () => {
    const fullMediaUrl = mediaUrl && !imgLoadFailed ? mediaUrl : null;
    const thumbnailUrl = localPreviewUrl;
    const previewUrl = fullMediaUrl ?? thumbnailUrl;
    const imageMedia = isImagePreviewMessage(message);

    if (imageMedia && !fullMediaUrl && !imgLoadFailed) {
      if (mediaDownloading && !thumbnailUrl && mediaLoading) {
        return renderMediaStatus('loading', t('inbox.mediaLoading'));
      }
      if (needsManualDownload || mediaDownloading || Boolean(thumbnailUrl)) {
        return renderBlurredPreview(
          thumbnailUrl,
          needsManualDownload ? triggerManualDownload : undefined,
        );
      }
    }

    if (needsManualDownload && !fullMediaUrl) {
      if (mediaDownloading) {
        return renderMediaStatus('loading', t('inbox.mediaLoading'));
      }
      return renderMediaPlaceholder();
    }

    if (imgLoadFailed && !fullMediaUrl) {
      return renderMediaStatus('error', t('inbox.mediaUnavailable'));
    }

    if (mediaError && !previewUrl) {
      return renderMediaPlaceholder();
    }

    if (mediaDownloading && !previewUrl) {
      return renderMediaStatus('loading', t('inbox.mediaLoading'));
    }

    if (!thumbnailUrl && mediaLoading) {
      return renderMediaStatus('loading', t('inbox.mediaLoading'));
    }
    if (!previewUrl && !needsManualDownload && !mediaError) {
      return renderMediaStatus('error', t('inbox.mediaUnavailable'));
    }

    if (!previewUrl) {
      return null;
    }
    const mediaSrc = previewUrl;

    if (isImagePreviewMessage(message)) {
      return wrapInboxMediaWithStar(
        message,
        <button
          type="button"
          className="inbox-bubble-media-link inbox-bubble-media-link--button"
          onClick={() => setLightboxOpen(true)}
          aria-label={t('inbox.interakt.mediaLightbox')}
        >
          <img
            src={mediaSrc}
            alt={mediaLabel(message.type)}
            className="inbox-bubble-media-img"
            onError={() => {
              revokeTrackedObjectUrl(objectUrlRef);
              setMediaUrl(null);
              setImgLoadFailed(true);
            }}
          />
        </button>,
      );
    }

    if (normalizeMessageType(message.type) === 'video') {
      return wrapInboxMediaWithStar(
        message,
        <video src={mediaSrc} controls className="inbox-bubble-media-video" />,
      );
    }

    const mediaType = normalizeMessageType(message.type);
    if (mediaType === 'audio' || mediaType === 'ptt') {
      return wrapInboxMediaWithStar(
        message,
        <audio src={mediaSrc} controls className="inbox-bubble-media-audio" />,
      );
    }

    return wrapInboxMediaWithStar(
      message,
      <a href={mediaSrc} download className="inbox-bubble-media-doc">
        <FileText size={18} />
        <span>{t('inbox.downloadMedia')}</span>
      </a>,
    );
  };

  const metaInside = !stitchLayout && !useInteraktBubble;
  const showBubbleMeta = !stackContinues;

  const metaRowClass = stitchLayout
    ? `inbox-stitch-bubble-meta inbox-stitch-bubble-meta--${message.direction}`
    : useInteraktBubble && message.direction === 'incoming'
      ? 'inbox-interakt-bubble-meta-row inbox-interakt-bubble-meta-row--in'
      : useInteraktBubble
        ? 'inbox-interakt-bubble-meta-row'
        : 'inbox-bubble-meta';

  const interaktOutgoingBadge =
    useInteraktBubble && message.direction === 'outgoing' ? (
      aiReply ? (
        <span className="inbox-interakt-ai-agent-badge" title={t('inbox.interakt.aiAgentBadge')}>
          <MaterialSymbol name="psychology" size={14} filled />
          {t('inbox.interakt.aiAgentBadge')}
        </span>
      ) : (
        <span className="inbox-interakt-business-badge">{t('inbox.interakt.agentBadge')}</span>
      )
    ) : null;

  const metaBlock = (
    <div className={metaRowClass}>
      {aiReply && !(useInteraktBubble && message.direction === 'outgoing') && (
        <span className="inbox-bubble-ai-badge" title={t('inbox.aiAutoReplyBadge')}>
          <Bot size={11} aria-hidden />
          {t('inbox.aiAutoReplyBadge')}
        </span>
      )}
      <span className="inbox-interakt-bubble-time">{formatTime(message.createdAt)}</span>
      {message.direction === 'outgoing' && message.status === 'pending' ? (
        <Clock size={12} className="inbox-bubble-pending" aria-label={formatMessageStatus('pending', t)} />
      ) : message.direction === 'outgoing' && stitchLayout && message.status === 'read' ? (
        <MaterialSymbol
          name="done_all"
          size={12}
          className="inbox-stitch-bubble-meta__tick inbox-stitch-bubble-meta__tick--read"
          aria-hidden
        />
      ) : message.direction === 'outgoing' && stitchLayout && message.status === 'delivered' ? (
        <MaterialSymbol
          name="done_all"
          size={12}
          className="inbox-stitch-bubble-meta__tick inbox-stitch-bubble-meta__tick--delivered"
          aria-hidden
        />
      ) : message.direction === 'outgoing' && stitchLayout && message.status === 'sent' ? (
        <svg
          className="inbox-stitch-bubble-meta__tick inbox-stitch-bubble-meta__tick--sent"
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : message.direction === 'outgoing' && stitchLayout && showReadTick(message.status) ? (
        <svg
          className="inbox-stitch-bubble-meta__tick"
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : message.direction === 'outgoing' && useInteraktBubble && showReadTick(message.status) ? (
        <MaterialSymbol
          name="done_all"
          size={12}
          className={`inbox-interakt-read-tick${aiReply ? '' : ' inbox-interakt-read-tick--muted'}`}
        />
      ) : message.direction === 'outgoing' && message.status && !useInteraktBubble && !stitchLayout ? (
        <span>{` · ${formatMessageStatus(message.status, t)}`}</span>
      ) : null}
    </div>
  );

  const imageLightbox =
    lightboxOpen && isImagePreviewMessage(message) ? (
      <InboxMediaLightbox
        messages={[message]}
        initialIndex={0}
        sessionId={sessionId}
        sessionStatus={sessionStatus}
        variant={useInteraktBubble ? 'interakt' : 'classic'}
        onClose={() => setLightboxOpen(false)}
      />
    ) : null;

  const handleBubbleContextMenu = (event: React.MouseEvent) => {
    if (!onContextMenu) return;
    event.preventDefault();
    onContextMenu(event, { openLightbox: () => setLightboxOpen(true) });
  };

  const hasMediaBubble = showMedia;
  const mediaOnlyBubble = showMedia && !displayText;

  const bubble = (
    <div
      className={`inbox-bubble ${message.direction}${useInteraktBubble ? ' inbox-bubble--interakt' : ''}${stitchLayout ? ' inbox-bubble--stitch' : ''}${hasMediaBubble ? ' inbox-bubble--with-media' : ''}${mediaOnlyBubble ? ' inbox-bubble--media-only' : ''}${stackCompact ? ' inbox-bubble--stack-follow' : ''}${stackContinues ? ' inbox-bubble--stack-precursor' : ''}`}
      onContextMenu={onContextMenu ? handleBubbleContextMenu : undefined}
    >
      {!useInteraktBubble && (
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
      )}

      {interaktOutgoingBadge}

      {showMedia && renderMedia()}

      {displayText ? (
        <>
          <div className="inbox-bubble-body">
            <InboxFormattedMessageBody text={displayText} />
          </div>
          {isLong && (
            <button
              type="button"
              className={`inbox-bubble-toggle${useInteraktBubble ? ' inbox-bubble-toggle--interakt' : ''}`}
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? t('inbox.showLess') : t('inbox.readMore')}
            </button>
          )}
        </>
      ) : null}

      {metaInside && showBubbleMeta ? metaBlock : null}
      {!useInteraktBubble && message.direction === 'outgoing' && message.status === 'failed' && (
        <InboxFailedMessageActions message={message} sessionId={sessionId} />
      )}
    </div>
  );

  const metaIn =
    useInteraktBubble && message.direction === 'incoming' && showBubbleMeta ? (
      <div className="inbox-interakt-bubble-meta-row inbox-interakt-bubble-meta-row--in">
        <span className="inbox-interakt-bubble-time">{formatTime(message.createdAt)}</span>
      </div>
    ) : null;

  const metaOut =
    useInteraktBubble && message.direction === 'outgoing' && showBubbleMeta ? (
      <div className="inbox-interakt-bubble-meta-row">
        <span className="inbox-interakt-bubble-time">{formatTime(message.createdAt)}</span>
        {message.status && ['sent', 'delivered', 'read'].includes(message.status) ? (
          <MaterialSymbol
            name="done_all"
            size={12}
            className={`inbox-interakt-read-tick${message.status === 'read' ? '' : ' inbox-interakt-read-tick--muted'}`}
            aria-hidden
          />
        ) : null}
      </div>
    ) : null;

  if (useInteraktBubble && message.direction === 'incoming') {
    return (
      <>
        <div
          className={[
            'inbox-bubble-wrap incoming inbox-bubble-wrap--interakt',
            stackCompact ? 'inbox-bubble-wrap--stacked' : '',
            wrapHighlightClass,
          ]
            .filter(Boolean)
            .join(' ')}
          data-message-id={message.id}
          ref={bubbleRef}
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
        {imageLightbox}
      </>
    );
  }

  if (useInteraktBubble && message.direction === 'outgoing') {
    return (
      <>
        <div
          className={[
            'inbox-bubble-wrap outgoing inbox-bubble-wrap--interakt-out',
            stackCompact ? 'inbox-bubble-wrap--stacked' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          ref={bubbleRef}
          {...touchMenuHandlers}
        >
          <div className="inbox-interakt-bubble-col inbox-interakt-bubble-col--out">
            <div className="inbox-interakt-bubble-shell">{bubble}</div>
            {metaOut}
          </div>
        </div>
        {message.status === 'failed' && (
          <InboxFailedMessageActions message={message} sessionId={sessionId} />
        )}
        {imageLightbox}
      </>
    );
  }

  return (
    <>
      <div
        className={['inbox-bubble-wrap', message.direction, stitchLayout ? 'inbox-bubble-wrap--stitch' : '', wrapHighlightClass].filter(Boolean).join(' ')}
        data-message-id={message.id}
        ref={bubbleRef}
        {...touchMenuHandlers}
      >
        {stitchLayout ? (
          <div className="inbox-bubble-wrap__column">
            {bubble}
            {showBubbleMeta ? metaBlock : null}
          </div>
        ) : (
          bubble
        )}
      </div>
      {imageLightbox}
    </>
  );
});
