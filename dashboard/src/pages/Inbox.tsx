import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { Send, Loader2, RefreshCw } from 'lucide-react';
import { messageApi, sessionApi, inboxApi, type Session, type Conversation } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import {
  useSessionsQuery,
  useStartSessionMutation,
  useInboxConversationsQuery,
  useUnifiedInboxConversationsQuery,
  useInboxMessagesQuery,
  INBOX_POLL_INTERVAL_MS,
  queryKeys,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './Inbox.css';

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

const SESSION_BADGE_COLORS = ['#25D366', '#128C7E', '#34B7F1', '#9C27B0', '#FF9800', '#E91E63'];

type InboxViewMode = 'all' | 'one';

interface SelectedThread {
  sessionId: string;
  chatId: string;
}

function sessionBadgeColor(sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = (h + sessionId.charCodeAt(i)) % SESSION_BADGE_COLORS.length;
  }
  return SESSION_BADGE_COLORS[h];
}

function formatUnreadCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}

function messageBubbleText(msg: { body?: string; type: string; metadata?: Record<string, unknown> }): string {
  if (msg.body?.trim()) return msg.body;
  const meta = msg.metadata as { media?: { hasData?: boolean } } | undefined;
  if (meta?.media) return `[${msg.type}]`;
  return `[${msg.type}]`;
}

export function Inbox() {
  const { t } = useTranslation();
  useDocumentTitle(t('inbox.title'));
  const { canWrite } = useRole();
  const queryClient = useQueryClient();

  const { data: allSessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useSessionsQuery({
    refetchInterval: 10_000,
  });
  const startSession = useStartSessionMutation();

  const [viewMode, setViewMode] = useState<InboxViewMode>('all');
  const [sessionId, setSessionId] = useState('');
  const [selectedThread, setSelectedThread] = useState<SelectedThread | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedThreadRef = useRef<SelectedThread | null>(null);
  const prevMessageCountRef = useRef(0);
  selectedThreadRef.current = selectedThread;

  const selectedSession = allSessions.find(s => s.id === sessionId);
  const threadSession = selectedThread
    ? allSessions.find(s => s.id === selectedThread.sessionId)
    : viewMode === 'one'
      ? selectedSession
      : undefined;
  const sessionReady = selectedSession?.status === 'ready';
  const threadReady = threadSession?.status === 'ready';
  const anySessionReady = allSessions.some(s => s.status === 'ready');
  const pollInterval =
    viewMode === 'all'
      ? anySessionReady
        ? INBOX_POLL_INTERVAL_MS
        : false
      : sessionReady
        ? INBOX_POLL_INTERVAL_MS
        : false;

  const singleConversations = useInboxConversationsQuery(sessionId, {
    enabled: viewMode === 'one' && !!sessionId,
    refetchInterval: pollInterval,
  });

  const unifiedConversations = useUnifiedInboxConversationsQuery({
    enabled: viewMode === 'all',
    refetchInterval: pollInterval,
  });

  const conversationsQuery = viewMode === 'all' ? unifiedConversations : singleConversations;
  const {
    data: conversations = [],
    isLoading: loadingConversations,
    isFetching: fetchingConversations,
    refetch: refetchConversations,
  } = conversationsQuery;

  const activeSessionId = viewMode === 'all' ? selectedThread?.sessionId ?? '' : sessionId;
  const activeChatId = selectedThread?.chatId ?? null;

  const {
    data: messages = [],
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    refetch: refetchMessages,
  } = useInboxMessagesQuery(activeSessionId, activeChatId, {
    enabled: !!activeSessionId && !!activeChatId,
    refetchInterval: viewMode === 'all' ? (threadReady ? pollInterval : false) : pollInterval,
  });

  const canSend = canWrite && (viewMode === 'all' ? !!threadReady : sessionReady);
  const [showSyncing, setShowSyncing] = useState(false);
  const showConversationsLoader = loadingConversations && conversations.length === 0;
  const showMessagesLoader = loadingMessages && messages.length === 0;
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const openThread = (thread: SelectedThread) => {
    setSelectedThread(thread);
    setError(null);
    prevMessageCountRef.current = 0;
    if (!canWrite) return;
    const markRead =
      viewMode === 'all'
        ? inboxApi.markConversationRead(thread.sessionId, thread.chatId)
        : sessionApi.markConversationRead(thread.sessionId, thread.chatId);
    void markRead
      .then(() => invalidateInbox(thread))
      .catch(() => {
        /* keep UI usable if mark-read fails while offline */
      });
  };

  useEffect(() => {
    if (allSessions.length === 0) return;
    const exists = allSessions.some(s => s.id === sessionId);
    if (!sessionId || !exists) {
      const ready = allSessions.find(s => s.status === 'ready');
      setSessionId(ready?.id || allSessions[0].id);
      setError(null);
    }
  }, [allSessions, sessionId]);

  useEffect(() => {
    setSelectedThread(null);
  }, [sessionId, viewMode]);

  useEffect(() => {
    if (!fetchingConversations && !fetchingMessages) {
      setShowSyncing(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSyncing(true), 400);
    return () => window.clearTimeout(timer);
  }, [fetchingConversations, fetchingMessages]);

  useEffect(() => {
    const count = messages.length;
    if (count > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = count;
  }, [messages]);

  const invalidateInbox = (thread?: SelectedThread | null) => {
    if (viewMode === 'all') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversationsAll });
    } else if (sessionId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversations(sessionId) });
    }
    const sid = thread?.sessionId ?? activeSessionId;
    const cid = thread?.chatId ?? activeChatId;
    if (sid && cid) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxMessages(sid, cid) });
    }
  };

  useEffect(() => {
    const apiKey = sessionStorage.getItem('openwa_api_key');
    if (!apiKey) return;
    if (viewMode === 'one' && !sessionId) return;

    const socket = io(`${SOCKET_URL}/events`, {
      auth: { apiKey },
      extraHeaders: { 'X-API-Key': apiKey },
      query: { apiKey },
    });

    const wsSessionId = viewMode === 'all' ? '*' : sessionId;

    socket.on('connect', () => {
      socket.emit('message', {
        type: 'subscribe',
        sessionId: wsSessionId,
        events: ['message.received', 'message.sent'],
        requestId: 'inbox-sub',
      });
    });

    socket.on('message', (msg: { type?: string; payload?: WsPayload }) => {
      if (msg.type !== 'event' || !msg.payload) return;
      const event = msg.payload.event;
      if (event !== 'message.received' && event !== 'message.sent') return;

      const data = msg.payload.data as IncomingMessagePayload | undefined;
      if (!data?.chatId) return;

      if (viewMode === 'one' && msg.payload.sessionId !== sessionId) return;

      const current = selectedThreadRef.current;
      const matchesThread =
        current &&
        msg.payload.sessionId === current.sessionId &&
        data.chatId === current.chatId;

      invalidateInbox(matchesThread ? current : null);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, viewMode, queryClient, activeSessionId, activeChatId]);

  const handleSend = async () => {
    if (!activeSessionId || !activeChatId || !draft.trim() || !canSend) return;
    setSending(true);
    setError(null);
    try {
      await messageApi.sendText(activeSessionId, activeChatId, draft.trim());
      setDraft('');
      invalidateInbox(selectedThread);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inbox.errorSend'));
    } finally {
      setSending(false);
    }
  };

  const handleManualRefresh = () => {
    void refetchSessions();
    void refetchConversations();
    if (activeChatId) void refetchMessages();
  };

  const findConversation = (thread: SelectedThread): Conversation | undefined =>
    conversations.find(c => c.sessionId === thread.sessionId && c.chatId === thread.chatId);

  if (loadingSessions) {
    return (
      <div className="inbox-state-banner">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (allSessions.length === 0) {
    return (
      <div className="inbox-page">
        <PageHeader title={t('inbox.title')} subtitle={t('inbox.subtitle')} />
        <div className="inbox-state-banner">{t('inbox.noSessions')}</div>
      </div>
    );
  }

  const showDisconnectedBanner =
    viewMode === 'one'
      ? selectedSession && !sessionReady
      : selectedThread && threadSession && !threadReady;

  return (
    <div className="inbox-page">
      <div className="inbox-toolbar">
        <PageHeader title={t('inbox.title')} subtitle={t('inbox.subtitle')} />
        <div className="inbox-view-toggle" role="group" aria-label={t('inbox.session')}>
          <button
            type="button"
            className={viewMode === 'all' ? 'active' : ''}
            onClick={() => {
              setViewMode('all');
              setError(null);
            }}
          >
            {t('inbox.allAccounts')}
          </button>
          <button
            type="button"
            className={viewMode === 'one' ? 'active' : ''}
            onClick={() => {
              setViewMode('one');
              setError(null);
            }}
          >
            {t('inbox.oneAccount')}
          </button>
        </div>
        {viewMode === 'one' && (
          <>
            <label htmlFor="inbox-session">{t('inbox.session')}</label>
            <select
              id="inbox-session"
              value={allSessions.some(s => s.id === sessionId) ? sessionId : ''}
              onChange={e => {
                setSessionId(e.target.value);
                setError(null);
              }}
            >
              {allSessions.map((s: Session) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          className={`btn-icon inbox-refresh-btn ${showSyncing ? 'inbox-refresh-btn--active' : ''}`}
          onClick={handleManualRefresh}
          title={t('inbox.refresh')}
          aria-label={t('inbox.refresh')}
        >
          <RefreshCw size={18} />
        </button>
        {showSyncing && (viewMode === 'all' ? anySessionReady : sessionReady) && (
          <span className="inbox-sync-indicator" aria-live="polite">
            {t('inbox.syncing')}
          </span>
        )}
        {viewMode === 'one' && selectedSession && !sessionReady && (
          <button
            type="button"
            className="inbox-start-btn"
            disabled={startSession.isPending || selectedSession.status === 'initializing'}
            onClick={() => {
              startSession.mutate(sessionId, {
                onSuccess: () => {
                  invalidateInbox();
                  setError(null);
                },
                onError: err => {
                  setError(err instanceof Error ? err.message : t('inbox.errorStart'));
                },
              });
            }}
          >
            {startSession.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
            {t('inbox.startSession')}
          </button>
        )}
        {canSend && <span className="inbox-hint inbox-hint--ok">{t('inbox.connected')}</span>}
        {totalUnread > 0 && (
          <span className="inbox-toolbar-unread" aria-label={t('inbox.unreadTotal', { count: totalUnread })}>
            {formatUnreadCount(totalUnread)} {t('inbox.unread')}
          </span>
        )}
      </div>

      {showDisconnectedBanner && (
        <div className="inbox-disconnected-banner" role="status">
          {t('inbox.disconnectedBanner')}
          {viewMode === 'all' && selectedThread && threadSession && !threadReady && (
            <button
              type="button"
              className="inbox-start-btn inbox-start-btn--inline"
              disabled={startSession.isPending || threadSession.status === 'initializing'}
              onClick={() => {
                startSession.mutate(selectedThread.sessionId, {
                  onSuccess: () => {
                    invalidateInbox(selectedThread);
                    setError(null);
                  },
                  onError: err => {
                    setError(err instanceof Error ? err.message : t('inbox.errorStart'));
                  },
                });
              }}
            >
              {startSession.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
              {t('inbox.startSession')} ({threadSession.name})
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="inbox-state-banner inbox-error" role="alert">
          {error}
        </div>
      )}

      <div className="inbox-body">
        <aside className="inbox-conversations">
          <div className="inbox-conversations-header">
            <span>{t('inbox.conversations')}</span>
            {totalUnread > 0 && (
              <span className="inbox-unread-badge inbox-unread-badge--header">
                {formatUnreadCount(totalUnread)}
              </span>
            )}
          </div>
          <div className="inbox-conversation-list">
            {showConversationsLoader && (
              <div className="inbox-state-banner">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!showConversationsLoader && conversations.length === 0 && (
              <div className="inbox-state-banner">{t('inbox.noConversations')}</div>
            )}
            {conversations.map(conv => {
              const isActive =
                selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
              return (
                <button
                  key={`${conv.sessionId}:${conv.chatId}`}
                  type="button"
                  className={`inbox-conversation-item ${isActive ? 'active' : ''} ${conv.hasUnread ? 'inbox-conversation-item--unread' : ''}`}
                  onClick={() =>
                    openThread({ sessionId: conv.sessionId, chatId: conv.chatId })
                  }
                >
                  {viewMode === 'all' && (
                    <span
                      className="inbox-session-badge"
                      style={{ backgroundColor: sessionBadgeColor(conv.sessionId) }}
                      title={conv.sessionName}
                    >
                      {conv.sessionName}
                    </span>
                  )}
                  <div className="inbox-conversation-row-top">
                    <div className="inbox-conversation-name">{conv.displayName}</div>
                    {conv.unreadCount > 0 && (
                      <span className="inbox-unread-badge" aria-label={t('inbox.unreadCount', { count: conv.unreadCount })}>
                        {formatUnreadCount(conv.unreadCount)}
                      </span>
                    )}
                  </div>
                  <div className="inbox-conversation-preview">{conv.lastPreview || t('inbox.noPreview')}</div>
                  <div className="inbox-conversation-time">{formatTime(conv.lastMessageAt)}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="inbox-thread">
          {!selectedThread ? (
            <div className="inbox-thread-empty">{t('inbox.selectConversation')}</div>
          ) : (
            <>
              <div className="inbox-conversations-header inbox-thread-header">
                {viewMode === 'all' && (
                  <span
                    className="inbox-session-badge"
                    style={{ backgroundColor: sessionBadgeColor(selectedThread.sessionId) }}
                  >
                    {findConversation(selectedThread)?.sessionName ?? threadSession?.name}
                  </span>
                )}
                <span>{findConversation(selectedThread)?.displayName || selectedThread.chatId}</span>
              </div>
              <div className="inbox-messages">
                {showMessagesLoader && (
                  <div className="inbox-state-banner">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                )}
                {!showMessagesLoader && messages.length === 0 && (
                  <div className="inbox-state-banner">{t('inbox.noMessages')}</div>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`inbox-bubble ${msg.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
                  >
                    {messageBubbleText(msg)}
                    <div className="inbox-bubble-meta">
                      {formatTime(msg.createdAt)}
                      {msg.direction === 'outgoing' && msg.status ? ` · ${msg.status}` : ''}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form
                className="inbox-composer"
                onSubmit={e => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={canSend ? t('inbox.placeholder') : t('inbox.cannotSend')}
                  disabled={!canSend || sending}
                />
                <button type="submit" disabled={!canSend || sending || !draft.trim()}>
                  {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

interface WsPayload {
  event: string;
  sessionId: string;
  data?: unknown;
}

interface IncomingMessagePayload {
  id?: string;
  chatId: string;
  from?: string;
  to?: string;
  body?: string;
  type?: string;
  fromMe?: boolean;
}
