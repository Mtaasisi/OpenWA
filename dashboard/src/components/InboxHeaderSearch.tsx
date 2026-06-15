import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxContactAvatar } from './InboxContactAvatar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  useInboxMessageSearchQuery,
  useInboxThreadSearchQuery,
} from '../hooks/queries';
import type { Conversation, InboxMessageSearchHit } from '../services/api';
import {
  formatConversationListTime,
  getChatKind,
  getConversationTitle,
} from '../pages/inbox-helpers';
import { loadMessageMediaBlob, createMediaObjectUrl } from '../pages/inbox-media';
import type { ShellInboxSearchBinding } from '../lib/shell-inbox-search-context';
import './InboxHeaderSearch.css';

export type InboxGlobalSearchFilter = 'all' | 'chats' | 'messages' | 'images' | 'groups';

const FILTER_ORDER: InboxGlobalSearchFilter[] = ['all', 'chats', 'messages', 'images', 'groups'];

function highlightSearchTerm(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="inbox-header-search__highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function resolveSearchHitTitle(
  hit: InboxMessageSearchHit,
  chatTitleByKey: Map<string, string>,
): string {
  const fromChat = chatTitleByKey.get(`${hit.sessionId}:${hit.chatId}`);
  if (fromChat) return fromChat;
  return hit.chatName?.trim() || hit.chatId;
}

function InboxSearchMediaThumb({
  hit,
  chatTitle,
  onOpen,
  active,
}: {
  hit: InboxMessageSearchHit;
  chatTitle: string;
  onOpen: () => void;
  active?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void loadMessageMediaBlob(hit.sessionId, hit.id)
      .then(blob => {
        if (cancelled || !blob) {
          setFailed(true);
          return;
        }
        objectUrl = createMediaObjectUrl(blob, 'image/jpeg');
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hit.sessionId, hit.id]);

  return (
    <button
      type="button"
      className={`inbox-header-search__media-cell${active ? ' is-active' : ''}`}
      onClick={onOpen}
      title={chatTitle}
    >
      <span className="inbox-header-search__media-thumb">
        {url ? (
          <img src={url} alt="" className="inbox-header-search__media-img" />
        ) : failed ? (
          <MaterialSymbol name="image" size={22} className="inbox-header-search__media-placeholder-icon" />
        ) : (
          <Loader2 size={18} className="animate-spin inbox-header-search__media-spinner" />
        )}
      </span>
      <span className="inbox-header-search__media-caption">{chatTitle}</span>
    </button>
  );
}

function SearchMatchReason({ reason }: { reason?: string }) {
  const { t } = useTranslation();
  if (!reason) return null;
  const key = `inbox.globalSearch.matchReason.${reason}`;
  const label = t(key);
  if (label === key) return null;
  return <span className="inbox-header-search__match-reason">{label}</span>;
}

function ChatResultRow({
  conv,
  query,
  onPick,
  active,
  matchReason,
}: {
  conv: Conversation;
  query: string;
  onPick: () => void;
  active?: boolean;
  matchReason?: string;
}) {
  const { t } = useTranslation();
  const title = getConversationTitle(conv, t);
  const preview = conv.lastPreview?.trim() || '';
  const chatKind = getChatKind(conv.chatId);

  return (
    <button
      type="button"
      className={`inbox-header-search__chat-row${active ? ' is-active' : ''}`}
      onClick={onPick}
    >
      <InboxContactAvatar
        sessionId={conv.sessionId}
        chatId={conv.chatId}
        chatKind={chatKind}
        title={title}
        profilePicUrl={conv.profilePicUrl}
        sessionStatus={conv.sessionStatus}
        className="inbox-header-search__avatar"
        iconFallback={chatKind === 'group'}
        fetchWhenVisible
      />
      <div className="inbox-header-search__chat-body">
        <p className="inbox-header-search__chat-name">{title}</p>
        {preview ? (
          <p className="inbox-header-search__chat-preview">{highlightSearchTerm(preview, query)}</p>
        ) : null}
        <SearchMatchReason reason={matchReason} />
      </div>
    </button>
  );
}

function MessageResultRow({
  hit,
  query,
  chatTitle,
  onPick,
  active,
}: {
  hit: InboxMessageSearchHit;
  query: string;
  chatTitle: string;
  onPick: () => void;
  active?: boolean;
}) {
  const { t } = useTranslation();
  const when = hit.timestamp ?? hit.createdAt;
  const chatKind = hit.isGroup ? 'group' : getChatKind(hit.chatId);

  return (
    <button
      type="button"
      className={`inbox-header-search__message-row${active ? ' is-active' : ''}`}
      onClick={onPick}
    >
      <InboxContactAvatar
        sessionId={hit.sessionId}
        chatId={hit.chatId}
        chatKind={chatKind}
        title={chatTitle}
        sessionStatus={undefined}
        className="inbox-header-search__avatar inbox-header-search__avatar--message"
        iconFallback={hit.isGroup}
        fetchWhenVisible
      />
      <div className="inbox-header-search__message-body">
        <div className="inbox-header-search__message-head">
          <span className="inbox-header-search__message-name">{chatTitle}</span>
          <span className="inbox-header-search__message-time">
            {formatConversationListTime(String(when ?? ''), t)}
          </span>
        </div>
        <p className="inbox-header-search__message-preview">
          {highlightSearchTerm(hit.bodyPreview || hit.body, query)}
        </p>
        <SearchMatchReason reason={hit.matchReason} />
      </div>
    </button>
  );
}

type Props = {
  binding: ShellInboxSearchBinding;
};

export function InboxHeaderSearch({ binding }: Props) {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const isStitchSearch = activeTheme.effects === 'stitch';
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxGlobalSearchFilter>('all');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const trimmed = debouncedQuery.trim();
  const hasQuery = trimmed.length >= 2;

  const groupsOnly = filter === 'groups';
  const showChats = filter === 'all' || filter === 'chats' || filter === 'groups';
  const showMessages = filter === 'all' || filter === 'messages' || filter === 'groups';
  const showMedia = filter === 'all' || filter === 'images';

  const chatParams = useMemo(
    () => ({
      q: trimmed,
      limit: 6,
    }),
    [trimmed],
  );

  const { data: threadData, isFetching: chatsLoading } = useInboxThreadSearchQuery(chatParams, {
    enabled: open && hasQuery && showChats,
  });

  const chats = useMemo((): Conversation[] => {
    const rows = threadData?.threads ?? [];
    return rows
      .filter(row => (groupsOnly ? row.chatId.endsWith('@g.us') : true))
      .map(
        row =>
          ({
            sessionId: row.sessionId,
            sessionName: '',
            sessionStatus: 'ready',
            chatId: row.chatId,
            displayName: row.displayName ?? '',
            lastMessageAt: row.lastMessageAt,
            lastPreview: row.lastPreview,
            lastDirection: 'incoming',
            messageCount: 0,
            unreadCount: row.unreadCount,
            hasUnread: row.unreadCount > 0,
            resolved: false,
            hasFollowUp: false,
          }) as Conversation,
      );
  }, [threadData?.threads, groupsOnly]);

  const chatMatchByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of threadData?.threads ?? []) {
      if (row.matchReason) {
        map.set(`${row.sessionId}:${row.chatId}`, row.matchReason);
      }
    }
    return map;
  }, [threadData?.threads]);

  const { data: messageData, isFetching: messagesLoading } = useInboxMessageSearchQuery(
    { q: trimmed, groupsOnly, limit: 6 },
    {
      enabled:
        open && hasQuery && (filter === 'all' || filter === 'messages' || filter === 'groups'),
    },
  );

  const { data: mediaData, isFetching: mediaLoading } = useInboxMessageSearchQuery(
    { q: trimmed, mediaOnly: true, limit: 8 },
    { enabled: open && hasQuery && (filter === 'all' || filter === 'images') },
  );

  const messages = messageData?.matches ?? [];
  const media = mediaData?.matches ?? [];
  const isLoading = chatsLoading || messagesLoading || mediaLoading;

  const chatTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const conv of chats) {
      map.set(`${conv.sessionId}:${conv.chatId}`, getConversationTitle(conv, t));
    }
    for (const hit of messages) {
      const key = `${hit.sessionId}:${hit.chatId}`;
      if (!map.has(key)) map.set(key, resolveSearchHitTitle(hit, map));
    }
    for (const hit of media) {
      const key = `${hit.sessionId}:${hit.chatId}`;
      if (!map.has(key)) map.set(key, resolveSearchHitTitle(hit, map));
    }
    return map;
  }, [chats, messages, media, t]);

  const pickItems = useMemo(() => {
    const items: Array<{ sessionId: string; chatId: string; key: string }> = [];
    if (showChats) {
      for (const conv of chats) {
        items.push({
          sessionId: conv.sessionId,
          chatId: conv.chatId,
          key: `chat:${conv.sessionId}:${conv.chatId}`,
        });
      }
    }
    if (showMessages) {
      for (const hit of messages) {
        items.push({
          sessionId: hit.sessionId,
          chatId: hit.chatId,
          key: `msg:${hit.id}`,
        });
      }
    }
    if (showMedia) {
      for (const hit of media) {
        items.push({
          sessionId: hit.sessionId,
          chatId: hit.chatId,
          key: `media:${hit.id}`,
        });
      }
    }
    return items;
  }, [showChats, showMessages, showMedia, chats, messages, media]);

  useEffect(() => {
    setActiveIdx(0);
  }, [trimmed, filter, pickItems.length]);

  const pickThread = useCallback(
    (sessionId: string, chatId: string) => {
      binding.openThread(sessionId, chatId);
      setOpen(false);
      setQuery('');
    },
    [binding],
  );

  const applyListSearch = useCallback(() => {
    binding.applyListSearch(trimmed);
    setOpen(false);
  }, [binding, trimmed]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const hasChatResults = showChats && chats.length > 0;
  const hasMessageResults = showMessages && messages.length > 0;
  const hasMediaResults = showMedia && media.length > 0;
  const empty = hasQuery && !isLoading && !hasChatResults && !hasMessageResults && !hasMediaResults;
  const showPanel = open && hasQuery;
  const isPickActive = (key: string) => pickItems[activeIdx]?.key === key;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      binding.searchInputRef.current?.blur();
      return;
    }
    if (!showPanel || pickItems.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIdx(i => Math.min(pickItems.length - 1, i + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = pickItems[activeIdx] ?? pickItems[0];
      if (item) pickThread(item.sessionId, item.chatId);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`inbox-header-search${showPanel ? ' inbox-header-search--open' : ''}`}
    >
      <MaterialSymbol name="search" size={18} className="inbox-header-search__icon" />
      <input
        ref={binding.searchInputRef}
        type="search"
        className="inbox-header-search__input"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={
          isStitchSearch ? t('inbox.stitch.searchPatients') : t('shell.searchPlaceholder')
        }
        aria-label={
          isStitchSearch ? t('inbox.stitch.searchPatients') : t('shell.searchPlaceholder')
        }
        aria-expanded={showPanel}
        aria-controls="inbox-header-search-panel"
        autoComplete="off"
      />
      {showPanel ? (
        <div
          id="inbox-header-search-panel"
          className="inbox-header-search__panel"
          role="listbox"
          aria-label={t('inbox.globalSearch.resultsLabel')}
        >
          <div className="inbox-header-search__filters" role="tablist">
            {FILTER_ORDER.map(key => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`inbox-header-search__filter${filter === key ? ' is-active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {t(`inbox.globalSearch.filters.${key}`)}
              </button>
            ))}
          </div>

          <div className="inbox-header-search__scroll">
            {isLoading && (
              <div className="inbox-header-search__loading">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}

            {empty ? (
              <p className="inbox-header-search__empty">{t('inbox.globalSearch.empty')}</p>
            ) : null}

            {showChats && chats.length > 0 ? (
              <section className="inbox-header-search__section">
                <h4 className="inbox-header-search__section-title">
                  {t('inbox.globalSearch.sections.chats')}
                </h4>
                <div className="inbox-header-search__chat-list">
                  {chats.map(conv => (
                    <ChatResultRow
                      key={`${conv.sessionId}:${conv.chatId}`}
                      conv={conv}
                      query={trimmed}
                      active={isPickActive(`chat:${conv.sessionId}:${conv.chatId}`)}
                      matchReason={chatMatchByKey.get(`${conv.sessionId}:${conv.chatId}`)}
                      onPick={() => pickThread(conv.sessionId, conv.chatId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {showMessages && messages.length > 0 ? (
              <section className="inbox-header-search__section inbox-header-search__section--border">
                <h4 className="inbox-header-search__section-title">
                  {t('inbox.globalSearch.sections.messages')}
                </h4>
                <div className="inbox-header-search__message-list">
                  {messages.map(hit => (
                    <MessageResultRow
                      key={hit.id}
                      hit={hit}
                      query={trimmed}
                      chatTitle={
                        chatTitleByKey.get(`${hit.sessionId}:${hit.chatId}`) ??
                        resolveSearchHitTitle(hit, chatTitleByKey)
                      }
                      active={isPickActive(`msg:${hit.id}`)}
                      onPick={() => pickThread(hit.sessionId, hit.chatId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {showMedia && media.length > 0 ? (
              <section className="inbox-header-search__section inbox-header-search__section--border">
                <h4 className="inbox-header-search__section-title">
                  {t('inbox.globalSearch.sections.media')}
                </h4>
                <div className="inbox-header-search__media-grid">
                  {media.map(hit => (
                    <InboxSearchMediaThumb
                      key={hit.id}
                      hit={hit}
                      chatTitle={
                        chatTitleByKey.get(`${hit.sessionId}:${hit.chatId}`) ??
                        resolveSearchHitTitle(hit, chatTitleByKey)
                      }
                      active={isPickActive(`media:${hit.id}`)}
                      onOpen={() => pickThread(hit.sessionId, hit.chatId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="inbox-header-search__footer">
            <span className="inbox-header-search__hint">{t('inbox.globalSearch.hint')}</span>
            <button type="button" className="inbox-header-search__view-all" onClick={applyListSearch}>
              {t('inbox.globalSearch.viewAll', { query: trimmed })}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
