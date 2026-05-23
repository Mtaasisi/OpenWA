import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { messageApi, sessionApi, inboxApi, type InboxMessage } from '../services/api';
import { useRole } from '../hooks/useRole';
import {
  useSessionsQuery,
  useInboxConversationsQuery,
  useUnifiedInboxConversationsQuery,
  useInboxMessagesQuery,
  INBOX_POLL_INTERVAL_MS,
  INBOX_SLOW_POLL_INTERVAL_MS,
  INBOX_MESSAGE_PAGE_SIZE,
  queryKeys,
} from '../hooks/queries';
import {
  type ConversationFilter,
  filterConversations,
  buildMessageListItems,
  createOptimisticOutgoingMessage,
  createOptimisticOutgoingImageMessage,
  isGroupChat,
} from './inbox-helpers';
import {
  INBOX_IMAGE_MAX_BYTES,
  isAllowedInboxImageFile,
  readFileAsBase64,
} from './inbox-media';
import { loadUserPreferences, saveUserPreferences, USER_PREFS_STORAGE_KEY, parseInboxConversationFilter } from '../lib/user-preferences';
import { useSessionStartFlow } from '../hooks/useSessionStartFlow';
import { isSessionConnecting } from '../lib/session-status';

import { getEventsSocketAuth, getEventsSocketUrl } from '../lib/ws-config';
/** Inbox container width: single-pane (list OR chat). */
export const INBOX_WIDTH_MOBILE = 680;
/** Inbox container width: hide CRM third column (drawer instead). */
export const INBOX_WIDTH_COMPACT = 1020;
/** @deprecated Use INBOX_WIDTH_MOBILE — kept for external references */
export const MOBILE_BREAKPOINT = INBOX_WIDTH_MOBILE;
/** @deprecated Use INBOX_WIDTH_COMPACT */
export const COMPACT_BREAKPOINT = INBOX_WIDTH_COMPACT;

export type InboxViewMode = 'all' | 'one';
export type MobilePane = 'list' | 'chat';

export interface SelectedThread {
  sessionId: string;
  chatId: string;
}

export function formatUnreadCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
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

export function useInboxController() {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();

  const { data: allSessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useSessionsQuery({
    refetchInterval: 5_000,
  });

  const {
    starting: sessionStartPending,
    qrModal,
    closeQrModal,
    startSessionFlow,
  } = useSessionStartFlow({
    onReady: () => {
      void refetchSessions();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxConversationsAll });
      setComposerError(null);
    },
    onError: msg => setComposerError(msg),
  });

  const [viewMode, setViewModeState] = useState<InboxViewMode>(
    () => loadUserPreferences().inboxDefaultView,
  );
  const setViewMode = useCallback((mode: InboxViewMode) => {
    setViewModeState(mode);
    saveUserPreferences({ inboxDefaultView: mode });
  }, []);
  const [sessionId, setSessionId] = useState('');
  const [selectedThread, setSelectedThread] = useState<SelectedThread | null>(null);
  const [crmDrawerOpen, setCrmDrawerOpen] = useState(false);
  const [showCustomerPanel, setShowCustomerPanelState] = useState(
    () => loadUserPreferences().inboxShowCustomerPanel,
  );
  const setShowCustomerPanel = useCallback((visible: boolean) => {
    setShowCustomerPanelState(visible);
    saveUserPreferences({ inboxShowCustomerPanel: visible });
    if (!visible) setCrmDrawerOpen(false);
  }, []);
  const toggleShowCustomerPanel = useCallback(() => {
    setShowCustomerPanelState(prev => {
      const next = !prev;
      saveUserPreferences({ inboxShowCustomerPanel: next });
      if (!next) setCrmDrawerOpen(false);
      return next;
    });
  }, []);
  const [showChatList, setShowChatListState] = useState(() => loadUserPreferences().inboxShowChatList);
  const toggleShowChatList = useCallback(() => {
    setShowChatListState(prev => {
      const next = !prev;
      saveUserPreferences({ inboxShowChatList: next });
      return next;
    });
  }, []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilterState] = useState<ConversationFilter>(() =>
    parseInboxConversationFilter(loadUserPreferences().inboxConversationFilter),
  );
  const setActiveFilter = useCallback((filter: ConversationFilter) => {
    setActiveFilterState(filter);
    saveUserPreferences({ inboxConversationFilter: filter });
  }, []);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [crmDirty, setCrmDirty] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [olderMessageOffset, setOlderMessageOffset] = useState(0);
  const [pendingMessages, setPendingMessages] = useState<InboxMessage[]>([]);
  const [showSyncing, setShowSyncing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
  const fastPoll = viewMode === 'all' ? anySessionReady : sessionReady;
  const pollInterval = fastPoll ? INBOX_POLL_INTERVAL_MS : INBOX_SLOW_POLL_INTERVAL_MS;

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

  const filteredConversations = useMemo(
    () => filterConversations(conversations, searchQuery, activeFilter),
    [conversations, searchQuery, activeFilter],
  );

  const activeSessionId = viewMode === 'all' ? selectedThread?.sessionId ?? '' : sessionId;
  const activeChatId = selectedThread?.chatId ?? null;

  const {
    data: messagesData = { messages: [], total: 0 },
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    refetch: refetchMessages,
  } = useInboxMessagesQuery(activeSessionId, activeChatId, {
    enabled: !!activeSessionId && !!activeChatId,
    refetchInterval: threadReady || sessionReady ? pollInterval : false,
    limit: INBOX_MESSAGE_PAGE_SIZE,
    olderOffset: olderMessageOffset,
  });

  const serverMessages = messagesData.messages;
  const messageTotal = messagesData.total;
  const displayMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map(m => m.body + m.createdAt));
    const pending = pendingMessages.filter(p => !serverIds.has(p.body + p.createdAt));
    return [...serverMessages, ...pending];
  }, [serverMessages, pendingMessages]);

  const messageListItems = useMemo(() => buildMessageListItems(displayMessages, t), [displayMessages, t]);

  const canSend = canWrite && (viewMode === 'all' ? !!threadReady : sessionReady);
  const showConversationsLoader = loadingConversations && conversations.length === 0;
  const showMessagesLoader = loadingMessages && displayMessages.length === 0;
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (isGroupChat(c.chatId) ? 0 : (c.unreadCount ?? 0)),
    0,
  );
  const selectedConv = selectedThread
    ? conversations.find(c => c.sessionId === selectedThread.sessionId && c.chatId === selectedThread.chatId)
    : undefined;
  const canLoadOlder = messageTotal > displayMessages.length;

  /** Wide layout: collapse list when a thread is open and user turned list off. */
  const collapseChatList = !showChatList && !!selectedThread && !isMobile;

  useEffect(() => {
    const syncPanelPrefs = () => {
      const prefs = loadUserPreferences();
      setShowCustomerPanelState(prefs.inboxShowCustomerPanel);
      setShowChatListState(prefs.inboxShowChatList);
      setActiveFilterState(parseInboxConversationFilter(prefs.inboxConversationFilter));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_PREFS_STORAGE_KEY) syncPanelPrefs();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('openwa-prefs-updated', syncPanelPrefs);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('openwa-prefs-updated', syncPanelPrefs);
    };
  }, []);

  const invalidateInbox = useCallback(
    (thread?: SelectedThread | null) => {
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
    },
    [viewMode, sessionId, activeSessionId, activeChatId, queryClient],
  );

  const confirmLeaveIfDirty = useCallback((): boolean => {
    if (!crmDirty) return true;
    return window.confirm(t('inbox.unsavedCrmWarning'));
  }, [crmDirty, t]);

  const openThread = (thread: SelectedThread) => {
    if (selectedThread && !confirmLeaveIfDirty()) return;
    setSelectedThread(thread);
    setComposerError(null);
    setOlderMessageOffset(0);
    setPendingMessages([]);
    prevMessageCountRef.current = 0;
    if (isMobile) setMobilePane('chat');
    const markRead =
      viewMode === 'all'
        ? inboxApi.markConversationRead(thread.sessionId, thread.chatId)
        : sessionApi.markConversationRead(thread.sessionId, thread.chatId);
    void markRead
      .then(() => invalidateInbox(thread))
      .catch(() => undefined);
  };

  const handleStartSession = (targetSessionId: string) => {
    if (!canWrite) return;
    void startSessionFlow(targetSessionId, allSessions).catch(err => {
      setComposerError(err instanceof Error ? err.message : t('inbox.errorStart'));
    });
  };

  const backToList = useCallback(() => {
    if (!confirmLeaveIfDirty()) return;
    if (!isMobile && !showChatList && selectedThread) {
      setSelectedThread(null);
      setDraft('');
      setComposerError(null);
      setOlderMessageOffset(0);
      setPendingMessages([]);
    }
    setMobilePane('list');
  }, [confirmLeaveIfDirty, isMobile, showChatList, selectedThread]);

  useEffect(() => {
    if (loadingSessions || allSessions.length === 0) return;

    let ro: ResizeObserver | null = null;
    let cancelled = false;

    const applyWidth = (width: number) => {
      setIsMobile(width < INBOX_WIDTH_MOBILE);
      setIsCompact(width < INBOX_WIDTH_COMPACT);
    };

    const attach = () => {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>('.inbox-page, .tactical-inbox');
      if (!root) {
        requestAnimationFrame(attach);
        return;
      }
      applyWidth(root.getBoundingClientRect().width);
      ro = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect.width;
        if (w != null) applyWidth(w);
      });
      ro.observe(root);
    };

    attach();
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [loadingSessions, allSessions.length]);

  useEffect(() => {
    if (allSessions.length === 0) return;
    const exists = allSessions.some(s => s.id === sessionId);
    if (!sessionId || !exists) {
      const prefs = loadUserPreferences();
      const fromPref =
        prefs.inboxDefaultSessionId &&
        allSessions.some(s => s.id === prefs.inboxDefaultSessionId)
          ? prefs.inboxDefaultSessionId
          : null;
      const ready = allSessions.find(s => s.status === 'ready');
      setSessionId(fromPref || ready?.id || allSessions[0].id);
      setComposerError(null);
    }
  }, [allSessions, sessionId]);

  useEffect(() => {
    setOlderMessageOffset(0);
    setPendingMessages([]);
  }, [activeSessionId, activeChatId]);

  useEffect(() => {
    if (!selectedThread) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (crmDrawerOpen) {
        setCrmDrawerOpen(false);
        return;
      }
      if (!isMobile && showChatList) return;
      backToList();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedThread, backToList, crmDrawerOpen, isMobile, showChatList]);

  useEffect(() => {
    if (!fetchingConversations && !fetchingMessages) {
      setShowSyncing(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSyncing(true), 400);
    return () => window.clearTimeout(timer);
  }, [fetchingConversations, fetchingMessages]);

  useEffect(() => {
    const count = displayMessages.length;
    if (count > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = count;
  }, [displayMessages]);

  useEffect(() => {
    const apiKey = sessionStorage.getItem('openwa_api_key');
    if (!apiKey) return;
    if (viewMode === 'one' && !sessionId) return;

    let socket: Socket | null = null;
    socket = io(getEventsSocketUrl(), getEventsSocketAuth(apiKey));

    const wsSessionId = viewMode === 'all' ? '*' : sessionId;

    socket.on('connect', () => {
      setWsReconnecting(false);
      socket?.emit('message', {
        type: 'subscribe',
        sessionId: wsSessionId,
        events: ['message.received', 'message.sent'],
        requestId: 'inbox-sub',
      });
    });

    socket.on('disconnect', () => setWsReconnecting(true));

    socket.on('message', (msg: { type?: string; payload?: WsPayload }) => {
      if (msg.type !== 'event' || !msg.payload) return;
      const event = msg.payload.event;
      if (event !== 'message.received' && event !== 'message.sent') return;
      const data = msg.payload.data as IncomingMessagePayload | undefined;
      if (!data?.chatId) return;
      if (viewMode === 'one' && msg.payload.sessionId !== sessionId) return;
      const current = selectedThreadRef.current;
      const matchesThread =
        current && msg.payload.sessionId === current.sessionId && data.chatId === current.chatId;
      if (matchesThread) setPendingMessages([]);
      invalidateInbox(matchesThread ? current : null);
    });

    return () => {
      socket?.disconnect();
    };
  }, [sessionId, viewMode, invalidateInbox]);

  const handleSend = async () => {
    if (!activeSessionId || !activeChatId || !draft.trim() || !canSend) return;
    const text = draft.trim();
    const optimistic = createOptimisticOutgoingMessage(activeSessionId, activeChatId, text);
    setPendingMessages(prev => [...prev, optimistic]);
    setSending(true);
    setComposerError(null);
    setDraft('');
    try {
      await messageApi.sendText(activeSessionId, activeChatId, text);
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      invalidateInbox(selectedThread);
    } catch (err) {
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setComposerError(err instanceof Error ? err.message : t('inbox.errorSend'));
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleAttachImageClick = () => {
    if (!canSend || sending) return;
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeSessionId || !activeChatId || !canSend) return;

    if (!isAllowedInboxImageFile(file)) {
      setComposerError(t('inbox.imageTypeNotSupported'));
      return;
    }
    if (file.size > INBOX_IMAGE_MAX_BYTES) {
      setComposerError(t('inbox.imageTooLarge'));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const caption = draft.trim();
    const optimistic = createOptimisticOutgoingImageMessage(
      activeSessionId,
      activeChatId,
      caption,
      previewUrl,
    );
    setPendingMessages(prev => [...prev, optimistic]);
    setSending(true);
    setComposerError(null);
    if (caption) setDraft('');

    try {
      const base64 = await readFileAsBase64(file);
      await messageApi.sendImageFile(activeSessionId, activeChatId, base64, file.type, {
        caption: caption || undefined,
        filename: file.name,
      });
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      invalidateInbox(selectedThread);
    } catch (err) {
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setComposerError(err instanceof Error ? err.message : t('inbox.errorSendImage'));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setSending(false);
    }
  };

  const handleManualRefresh = () => {
    void refetchSessions();
    void refetchConversations();
    if (activeChatId) void refetchMessages();
  };

  const composerPlaceholder = !canWrite
    ? t('inbox.cannotSendNoWrite')
    : !canSend
      ? t('inbox.cannotSendDisconnected')
      : t('inbox.placeholder');

  const showThreadDisconnected =
    !!selectedThread &&
    !!threadSession &&
    !threadReady &&
    (viewMode === 'all' || (viewMode === 'one' && !!selectedSession && !sessionReady));

  const sessionStatusKey = threadSession?.status ?? selectedSession?.status;

  const selectSessionRail = (id: string) => {
    if (!confirmLeaveIfDirty()) return;
    setSessionId(id);
    setViewMode('one');
    setSelectedThread(null);
    setComposerError(null);
  };

  return {
    t,
    canWrite,
    allSessions,
    loadingSessions,
    sessionStartPending,
    isSessionConnecting,
    qrModal,
    closeQrModal,
    viewMode,
    setViewMode,
    sessionId,
    setSessionId,
    selectedThread,
    selectedConv,
    draft,
    setDraft,
    sending,
    composerError,
    setComposerError,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    isMobile,
    isCompact,
    showCustomerPanel,
    setShowCustomerPanel,
    toggleShowCustomerPanel,
    showChatList,
    toggleShowChatList,
    collapseChatList,
    mobilePane,
    crmDrawerOpen,
    setCrmDrawerOpen,
    crmDirty,
    setCrmDirty,
    wsReconnecting,
    messagesEndRef,
    imageInputRef,
    selectedSession,
    threadSession,
    sessionReady,
    threadReady,
    anySessionReady,
    conversations,
    filteredConversations,
    activeSessionId,
    activeChatId,
    messageListItems,
    canSend,
    showSyncing,
    showConversationsLoader,
    showMessagesLoader,
    totalUnread,
    canLoadOlder,
    fetchingMessages,
    displayMessages,
    confirmLeaveIfDirty,
    openThread,
    handleStartSession,
    backToList,
    handleSend,
    handleAttachImageClick,
    handleImageFileChange,
    handleComposerKeyDown,
    handleManualRefresh,
    composerPlaceholder,
    showThreadDisconnected,
    sessionStatusKey,
    invalidateInbox,
    selectSessionRail,
    setOlderMessageOffset,
  };
}

export type InboxController = ReturnType<typeof useInboxController>;
