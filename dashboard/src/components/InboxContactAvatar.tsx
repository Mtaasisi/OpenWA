import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { User, Users } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { queryKeys, useInboxContactAvatarBlob } from '../hooks/queries';
import { clearCachedAvatarAbsent, putCachedAvatarBlob } from '../lib/inbox-avatar-cache';
import { isSessionRunning } from '../lib/session-status';
import { avatarInitials, type ChatKind } from '../pages/inbox-helpers';
import './InboxContactAvatar.css';

export interface InboxContactAvatarProps {
  sessionId: string;
  chatId: string;
  chatKind: ChatKind;
  title: string;
  profilePicUrl?: string | null;
  sessionStatus?: string;
  className?: string;
  /** Use chat-kind icon instead of initials when no photo is available */
  iconFallback?: boolean;
  /** Corner overlay (list/header) or centered below avatar (Customer 360 hero) */
  groupBadgePlacement?: 'corner' | 'below';
  /** Icon-only kind badge on avatar when list mixes private + group chats */
  showChatKindIndicator?: boolean;
  /** @deprecated Proxy fetch is automatic when no CDN URL is available. */
  preferProxy?: boolean;
  /** Defer proxy fetch until the avatar scrolls into view. */
  fetchWhenVisible?: boolean;
}

export function InboxContactAvatar({
  sessionId,
  chatId,
  chatKind,
  title,
  profilePicUrl,
  sessionStatus,
  className,
  iconFallback = false,
  groupBadgePlacement = 'corner',
  showChatKindIndicator = false,
  fetchWhenVisible = false,
}: InboxContactAvatarProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const cdnPersistedRef = useRef(false);
  const [directError, setDirectError] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(!fetchWhenVisible);
  const sessionCanFetchAvatars = isSessionRunning(sessionStatus);
  const fetchRemote = visible;
  const pollRemote = sessionCanFetchAvatars;

  useEffect(() => {
    if (!fetchWhenVisible) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchWhenVisible, sessionId, chatId]);

  const placeholderUrl = profilePicUrl && !directError ? profilePicUrl : null;
  const hasProfilePicHint = Boolean(profilePicUrl);

  const { data: avatarBlob, isFetched, isFetching } = useInboxContactAvatarBlob(sessionId, chatId, {
    fetchRemote,
    pollRemote,
    hasProfilePicHint,
    alwaysRefresh: !fetchWhenVisible && sessionCanFetchAvatars,
  });

  useEffect(() => {
    setDirectError(false);
    cdnPersistedRef.current = false;
  }, [profilePicUrl, sessionId, chatId]);

  const handleCdnImageLoad = useCallback(() => {
    if (cdnPersistedRef.current || !placeholderUrl) return;
    cdnPersistedRef.current = true;
    void clearCachedAvatarAbsent(sessionId, chatId).then(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxAvatar(sessionId, chatId) });
    });
    void fetch(placeholderUrl)
      .then(response => (response.ok ? response.blob() : null))
      .then(blob => {
        if (blob) void putCachedAvatarBlob(sessionId, chatId, blob);
      })
      .catch(() => {
        /* CDN may block cross-origin fetch; absent clear + proxy retry still help */
      });
  }, [chatId, placeholderUrl, queryClient, sessionId]);

  useEffect(() => {
    if (!avatarBlob) {
      setProxyUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarBlob);
    setProxyUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarBlob]);

  const imageUrl = proxyUrl ?? placeholderUrl;
  const showPhoto = Boolean(imageUrl);
  const showOfflineState =
    isFetched &&
    !isFetching &&
    !showPhoto &&
    !sessionCanFetchAvatars &&
    !placeholderUrl;
  const Icon = chatKind === 'group' ? Users : User;
  const kindClass = chatKind === 'group' ? 'inbox-avatar--group' : 'inbox-avatar--private';
  const resolvedClassName = ['inbox-avatar', kindClass, className].filter(Boolean).join(' ');
  const showKindIndicator = showChatKindIndicator && groupBadgePlacement === 'corner';
  const showGroupBadge = chatKind === 'group';
  const groupBadgeBelow = showGroupBadge && groupBadgePlacement === 'below';
  const showPrivateBadge = showKindIndicator && chatKind === 'private';
  const showGroupCornerBadge = showGroupBadge && !groupBadgeBelow && (!showChatKindIndicator || showKindIndicator);

  return (
    <span
      ref={wrapRef}
      className={`inbox-contact-avatar-wrap${showOfflineState ? ' inbox-contact-avatar-wrap--offline' : ''}${groupBadgeBelow ? ' inbox-contact-avatar-wrap--group-below' : ''}`}
      title={showOfflineState ? t('inbox.avatarSessionOffline') : undefined}
    >
      <span className={resolvedClassName} aria-hidden>
        {showPhoto ? (
          <img
            src={imageUrl!}
            alt=""
            className="inbox-contact-avatar__img"
            loading="lazy"
            decoding="async"
            onError={() => setDirectError(true)}
            onLoad={placeholderUrl && !proxyUrl ? handleCdnImageLoad : undefined}
          />
        ) : iconFallback ? (
          <Icon size={chatKind === 'group' ? 18 : 16} strokeWidth={2.25} />
        ) : (
          avatarInitials(title)
        )}
      </span>
      {showGroupCornerBadge && (
        <img
          src="/group-avatar-badge.png"
          alt=""
          className="inbox-contact-avatar__group-badge"
          title={t('inbox.chatBadgeGroup')}
          aria-hidden
          decoding="async"
        />
      )}
      {showPrivateBadge && (
        <span
          className="inbox-contact-avatar__private-badge"
          title={t('inbox.chatBadgeDirect')}
          aria-label={t('inbox.chatBadgeDirect')}
        >
          <MaterialSymbol name="person" size={11} />
        </span>
      )}
      {groupBadgeBelow && (
        <img
          src="/group-avatar-badge.png"
          alt=""
          className="inbox-contact-avatar__group-badge inbox-contact-avatar__group-badge--below"
          aria-hidden
          decoding="async"
        />
      )}
      {showOfflineState && (
        <span
          className={`inbox-contact-avatar__offline${chatKind === 'group' ? ' inbox-contact-avatar__offline--group' : ''}`}
          aria-hidden
        />
      )}
    </span>
  );
}
