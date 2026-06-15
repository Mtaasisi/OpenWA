import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  sessionApi,
  inboxApi,
  type Conversation,
  type InboxMessage,
  type InboxSavedViewRow,
} from '../services/api';
import { mediaLabel } from './inbox-media';
import { useRole } from '../hooks/useRole';
import { useToast } from '../components/Toast';
import {
  useSessionsQuery,
  useUnifiedInboxConversationsQuery,
  useInboxQueueCountsQuery,
  useInboxMessagesQuery,
  INBOX_POLL_INTERVAL_MS,
  INBOX_SLOW_POLL_INTERVAL_MS,
  INBOX_MESSAGE_PAGE_SIZE,
  queryKeys,
  prefetchInboxMessages,
  prefetchInboxCrm,
} from '../hooks/queries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { InboxTrainingLearnPrompt } from '../components/InboxAiTrainingLearnStrip';
import {
  OPENWA_NEW_CHAT_EVENT,
  dispatchComposerTab,
  dispatchOpenQuickReplies,
  dispatchOpenResolve,
  dispatchOpenTransfer,
  type OpenComposerTabDetail,
} from '../lib/inbox-events';
import { dispatchOpenCommandPalette } from '../lib/inbox-command-palette';
import {
  type ConversationFilter,
  filterConversations,
  buildUnifiedInboxQuery,
  buildMessageListItems,
  createOptimisticOutgoingMessage,
  createOptimisticOutgoingImageMessage,
  inboxMessageFromWsPayload,
  listPreviewFromWsPayload,
  sortConversationsByLastMessage,
  sortConversationsWithPinned,
  isGroupChat,
  INBOX_CONVERSATION_FILTERS,
  type InboxConversationSort,
  shouldShowSessionLabel,
  matchesConversationFilter,
  findNextTriageConversation,
  scrollConversationIntoView,
  getConversationTitle,
} from './inbox-helpers';
import { shouldConfirmAiTakeoverBeforeStaffSend } from '../lib/inbox-ai-takeover';
import { isSessionConnecting } from '../lib/session-status';
import { shouldBlockInboxConversations } from '../lib/inbox-conversation-gate';
import { isLinkedSessionRecoverable } from '../lib/linked-session-recovery';
import {
  INBOX_IMAGE_MAX_BYTES,
  isAllowedInboxImageFile,
  readFileAsBase64,
} from './inbox-media';
import { isInboxEditableTarget, isInboxModKey } from './inbox-shortcuts';
import { getInboxStaffId } from '../lib/inbox-staff-identity';
import {
  loadUserPreferences,
  saveUserPreferences,
  USER_PREFS_STORAGE_KEY,
  parseInboxConversationFilter,
  parseInboxChatTypeFilter,
} from '../lib/user-preferences';
import {
  type ConversationTypeFilter,
} from '../lib/conversation-types';
import { filterGroupMessagesByMember } from '../lib/group-participants';
import { useSessionStartFlow } from '../hooks/useSessionStartFlow';
import {
  addInboxOpenTab,
  chatRefKey,
  getInboxOpenTabs,
  getInboxPinnedChats,
  recordInboxRecentChat,
  removeInboxOpenTab,
  type InboxChatRef,
} from '../lib/inbox-chat-nav';
import type { ChannelId } from '../lib/channels';
import { normalizeInboxFilterSelection } from './inbox-filter-ui';
/** Inbox container width: single-pane (list OR chat). */
export const INBOX_WIDTH_MOBILE = 680;
/** Inbox container width: hide CRM third column (drawer instead). */
export const INBOX_WIDTH_COMPACT = 1020;
/** Interakt: minimum width for inline CRM column (below this, use drawer). */
export const INBOX_WIDTH_INTERAKT_INLINE = 720;
/** Min inbox width for Stitch list + chat + 380px CRM inline (18rem + ~372px chat + 380px CRM). */
export const INBOX_WIDTH_STITCH_INLINE = 1040;
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

interface IncomingMessagePayload {
  id?: string;
  chatId: string;
  from?: string;
  to?: string;
  body?: string;
  type?: string;
  fromMe?: boolean;
  timestamp?: number;
}

export type InboxQuoteReplyTarget = {
  messageId: string;
  quotedMessageId: string;
  preview: string;
};

export function useInboxController() {
  const { t } = useTranslation();
  const toast = useToast();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const applyingUrlRef = useRef(false);
  const suppressMemberClearRef = useRef(false);
  const hadSelectedThreadRef = useRef(false);

  const [wsConnected, setWsConnected] = useState(false);
  const wsHadConnectedRef = useRef(false);
  const wsDisconnectedWhileLiveRef = useRef(false);

  const { data: allSessions = [], isLoading: loadingSessions, isPending: pendingSessions, refetch: refetchSessions } = useSessionsQuery({
    refetchInterval: wsConnected ? 60_000 : 5_000,
  });

  const {
    starting: sessionStartPending,
    qrModal,
    linkPreflight,
    closeQrModal,
    continueQrInBackground,
    startSessionFlow,
    confirmLinkPreflight,
    cancelLinkPreflight,
    retrySessionFlow,
  } = useSessionStartFlow({
    onReady: () => {
      toast.success(
        t('sessions.toasts.readyTitle'),
        `${t('sessions.toasts.readyDesc')} ${t('sessions.toasts.readySafetyHint')}`,
      );
      void refetchSessions();
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'avatar'] });
      setComposerError(null);
    },
    onError: msg => setComposerError(msg),
    onSessionStatus: event => {
      if (!event.deleted) return;
      const thread = selectedThreadRef.current;
      if (thread?.sessionId === event.sessionId) {
        setSelectedThread(null);
        setDraft('');
        setComposerError(null);
        setPendingMessages([]);
        setOlderMessageOffset(0);
      }
      setAccumulatedConversations(prev => prev.filter(c => c.sessionId !== event.sessionId));
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    },
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
  const [newChatOpen, setNewChatOpen] = useState(false);
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
  const [trainingLearnPrompt, setTrainingLearnPrompt] = useState<InboxTrainingLearnPrompt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 280);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelId | 'all'>('all');
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchMatchId, setMessageSearchMatchId] = useState<string | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [activeFilter, setActiveFilterState] = useState<ConversationFilter>(() => {
    const prefs = loadUserPreferences();
    return normalizeInboxFilterSelection(parseInboxConversationFilter(prefs.inboxConversationFilter))
      .activeFilter;
  });
  const [hideGroups, setHideGroupsState] = useState(() => {
    const prefs = loadUserPreferences();
    const normalized = normalizeInboxFilterSelection(
      parseInboxConversationFilter(prefs.inboxConversationFilter),
    );
    return prefs.inboxHideGroups || normalized.hideGroups;
  });
  const setHideGroups = useCallback((value: boolean) => {
    setHideGroupsState(value);
    saveUserPreferences({ inboxHideGroups: value });
  }, []);
  const setActiveFilter = useCallback((filter: ConversationFilter) => {
    if (filter === 'private') {
      setActiveFilterState('all');
      setHideGroupsState(true);
      saveUserPreferences({ inboxConversationFilter: 'all', inboxHideGroups: true });
      return;
    }
    if (filter === 'groups') {
      setActiveFilterState('groups');
      setHideGroupsState(false);
      saveUserPreferences({ inboxConversationFilter: 'groups', inboxHideGroups: false });
      return;
    }
    const next = filter === 'open' ? 'all' : filter;
    setActiveFilterState(next);
    if (next === 'unread') {
      setHideGroupsState(true);
      saveUserPreferences({ inboxConversationFilter: next, inboxHideGroups: true });
      return;
    }
    saveUserPreferences({ inboxConversationFilter: next });
  }, []);
  const [activeChatTypeFilter, setActiveChatTypeFilterState] = useState<ConversationTypeFilter>(() =>
    parseInboxChatTypeFilter(loadUserPreferences().inboxChatTypeFilter),
  );
  const setActiveChatTypeFilter = useCallback((filter: ConversationTypeFilter) => {
    setActiveChatTypeFilterState(filter);
    saveUserPreferences({ inboxChatTypeFilter: filter });
  }, []);
  const [selectedGroupMember, setSelectedGroupMember] = useState<string | null>(null);
  const [groupMemberMessageFilter, setGroupMemberMessageFilter] = useState(false);
  const [leadSourceFilter, setLeadSourceFilter] = useState('');

  useEffect(() => {
    if (suppressMemberClearRef.current) {
      suppressMemberClearRef.current = false;
      return;
    }
    setSelectedGroupMember(null);
    setGroupMemberMessageFilter(false);
    setQuoteReply(null);
  }, [selectedThread?.sessionId, selectedThread?.chatId]);

  useEffect(() => {
    if (!selectedGroupMember) setGroupMemberMessageFilter(false);
  }, [selectedGroupMember]);
  const [conversationSort, setConversationSortState] = useState<InboxConversationSort>(
    () => loadUserPreferences().inboxConversationSort ?? 'newest',
  );
  const setConversationSort = useCallback((sort: InboxConversationSort) => {
    setConversationSortState(sort);
    saveUserPreferences({ inboxConversationSort: sort });
  }, []);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [crmDirty, setCrmDirty] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [olderMessageOffset, setOlderMessageOffset] = useState(0);
  const [pendingMessages, setPendingMessages] = useState<InboxMessage[]>([]);
  const [quoteReply, setQuoteReply] = useState<InboxQuoteReplyTarget | null>(null);
  const [showSyncing, setShowSyncing] = useState(false);
  const [inboxListRefreshing, setInboxListRefreshing] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiTakeoverSendConfirmOpen, setAiTakeoverSendConfirmOpen] = useState(false);
  const aiTakeoverSendConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const listRefreshStartedRef = useRef(0);
  const chatRefreshStartedRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const selectedThreadRef = useRef<SelectedThread | null>(null);
  const olderMessageOffsetRef = useRef(0);
  const prevMessageCountRef = useRef(0);
  const prevSelectedMemberRef = useRef<string | null>(null);
  selectedThreadRef.current = selectedThread;
  olderMessageOffsetRef.current = olderMessageOffset;

  const selectedSession = allSessions.find(s => s.id === sessionId);
  const threadSession = selectedThread
    ? allSessions.find(s => s.id === selectedThread.sessionId)
    : viewMode === 'one'
      ? selectedSession
      : undefined;
  const sessionReady = selectedSession?.status === 'ready';
  const threadReady = threadSession?.status === 'ready';
  const anySessionReady = allSessions.some(s => s.status === 'ready');
  const anySessionConnecting = allSessions.some(s => isSessionConnecting(s.status));
  const anyBackgroundSyncing = allSessions.some(s => s.backgroundSyncing);
  const selectedSessionConnecting = selectedSession
    ? isSessionConnecting(selectedSession.status)
    : false;
  const blockInboxConversations = shouldBlockInboxConversations(
    viewMode,
    sessionId,
    selectedSessionConnecting,
    anySessionConnecting,
    anySessionReady,
  );
  const waitingForSessionConnect = blockInboxConversations;
  const syncingChatsEmpty =
    anySessionReady &&
    anyBackgroundSyncing &&
    !blockInboxConversations;
  const connectedReadySessionCount = allSessions.filter(s => s.status === 'ready').length;
  const showSessionLabel = shouldShowSessionLabel(allSessions);
  const fastPoll = viewMode === 'all' ? anySessionReady : sessionReady;
  const pollInterval =
    blockInboxConversations && !anySessionReady
      ? false
      : anyBackgroundSyncing
        ? INBOX_SLOW_POLL_INTERVAL_MS
        : fastPoll
          ? INBOX_POLL_INTERVAL_MS
          : INBOX_SLOW_POLL_INTERVAL_MS;

  /** When WebSocket is live, polling is a reconnect safety net only. */
  const livePollInterval = wsConnected ? false : pollInterval;

  const LARGE_ACCOUNT_ACTIVE_SINCE_DAYS = 90;
  const LARGE_ACCOUNT_COLD_RESOLVED_DAYS = 180;
  const [largeAccountDefaults, setLargeAccountDefaults] = useState<{
    activeSinceDays: number;
    coldResolvedDays: number;
  } | null>(null);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [accumulatedConversations, setAccumulatedConversations] = useState<Conversation[]>([]);
  const [largeAccountMode, setLargeAccountMode] = useState(false);
  const [largeAccountShowAllHistory, setLargeAccountShowAllHistory] = useState(false);

  const largeAccountRecentWindowActive =
    largeAccountMode &&
    !largeAccountShowAllHistory &&
    activeFilter === 'all' &&
    !debouncedSearchQuery.trim() &&
    !leadSourceFilter.trim();

  const effectiveActiveSinceDays =
    largeAccountDefaults?.activeSinceDays ?? LARGE_ACCOUNT_ACTIVE_SINCE_DAYS;
  const effectiveColdResolvedDays =
    largeAccountDefaults?.coldResolvedDays ?? LARGE_ACCOUNT_COLD_RESOLVED_DAYS;

  useEffect(() => {
    setConversationCursor(null);
    setAccumulatedConversations([]);
    setLargeAccountShowAllHistory(false);
  }, [
    debouncedSearchQuery,
    activeFilter,
    activeChatTypeFilter,
    conversationSort,
    viewMode,
    leadSourceFilter,
    sessionId,
    hideGroups,
  ]);

  const unifiedQueryParams = useMemo(
    () =>
      buildUnifiedInboxQuery({
        sessionId: viewMode === 'one' ? sessionId : undefined,
        searchQuery: debouncedSearchQuery,
        activeFilter,
        conversationSort,
        leadSourceFilter: leadSourceFilter || undefined,
        activeChatTypeFilter,
        cursor: conversationCursor ?? undefined,
        offset: conversationCursor ? undefined : 0,
        limit: 50,
        activeSinceDays:
          largeAccountRecentWindowActive
            ? effectiveActiveSinceDays
            : undefined,
        excludeColdResolved:
          largeAccountRecentWindowActive ? true : undefined,
        coldResolvedDays:
          largeAccountRecentWindowActive ? effectiveColdResolvedDays : undefined,
      }),
    [
      viewMode,
      sessionId,
      debouncedSearchQuery,
      activeFilter,
      conversationSort,
      conversationCursor,
      leadSourceFilter,
      activeChatTypeFilter,
      largeAccountRecentWindowActive,
      effectiveActiveSinceDays,
      effectiveColdResolvedDays,
    ],
  );

  const unifiedConversations = useUnifiedInboxConversationsQuery(unifiedQueryParams, {
    enabled: (viewMode === 'all' || !!sessionId) && !blockInboxConversations,
    refetchInterval: livePollInterval,
    staleTime: wsConnected ? 60_000 : undefined,
    refetchOnWindowFocus: !wsConnected,
  });

  const queueCountsQuery = useInboxQueueCountsQuery(
    { sessionId: viewMode === 'one' ? sessionId : undefined },
    {
      enabled: (viewMode === 'all' || !!sessionId) && !blockInboxConversations,
      refetchInterval: livePollInterval,
    },
  );

  useEffect(() => {
    if (unifiedConversations.data?.largeAccountMode) {
      setLargeAccountMode(true);
    }
    if (unifiedConversations.data?.largeAccountDefaults) {
      setLargeAccountDefaults(unifiedConversations.data.largeAccountDefaults);
    }
  }, [
    unifiedConversations.data?.largeAccountMode,
    unifiedConversations.data?.largeAccountDefaults,
  ]);

  const pinsQuery = useQuery({
    queryKey: queryKeys.inboxPins,
    queryFn: inboxApi.listPins,
    staleTime: 60_000,
  });

  const savedViewsQuery = useQuery({
    queryKey: queryKeys.inboxSavedViews,
    queryFn: inboxApi.listSavedViews,
    staleTime: 60_000,
  });

  const savedViews = useMemo(
    () => (Array.isArray(savedViewsQuery.data) ? savedViewsQuery.data : []),
    [savedViewsQuery.data],
  );

  const pinsMigrationAttemptedRef = useRef(false);

  useEffect(() => {
    if (pinsMigrationAttemptedRef.current || !pinsQuery.isSuccess) return;
    pinsMigrationAttemptedRef.current = true;

    const prefs = loadUserPreferences();
    if (prefs.inboxPinsServerSynced) return;

    const local = getInboxPinnedChats();
    const server = Array.isArray(pinsQuery.data) ? pinsQuery.data : [];
    if (local.length === 0) {
      saveUserPreferences({ inboxPinsServerSynced: true });
      return;
    }

    const seen = new Set(server.map(p => chatRefKey({ sessionId: p.sessionId, chatId: p.chatId })));
    const merged = [
      ...server,
      ...local.filter(p => !seen.has(chatRefKey(p))),
    ].slice(0, 24);

    void inboxApi
      .replacePins(
        merged.map(p => ({
          sessionId: p.sessionId,
          chatId: p.chatId,
          label: p.label ?? null,
        })),
      )
      .then(next => {
        queryClient.setQueryData(queryKeys.inboxPins, next);
        saveUserPreferences({ inboxPinnedChats: [], inboxPinsServerSynced: true });
      })
      .catch(() => {
        pinsMigrationAttemptedRef.current = false;
      });
  }, [pinsQuery.isSuccess, pinsQuery.data, queryClient]);

  const pinnedKeySet = useMemo(() => {
    const pins = Array.isArray(pinsQuery.data) ? pinsQuery.data : [];
    return new Set(pins.map(p => chatRefKey({ sessionId: p.sessionId, chatId: p.chatId })));
  }, [pinsQuery.data]);

  const clearThreadUnreadInList = useCallback(
    (thread: SelectedThread) => {
      const threadKey = `${thread.sessionId}:${thread.chatId}`;
      const patchList = (list: Conversation[]): Conversation[] =>
        list.map(c =>
          `${c.sessionId}:${c.chatId}` === threadKey
            ? { ...c, hasUnread: false, unreadCount: 0 }
            : c,
        );

      queryClient.setQueriesData<{
        conversations: Conversation[];
        total: number;
      }>({ queryKey: ['inbox', 'conversations', 'all'] }, old =>
        old?.conversations ? { ...old, conversations: patchList(old.conversations) } : old,
      );

      setAccumulatedConversations(prev => patchList(prev));
    },
    [queryClient],
  );

  const applyOpenThreadReadToList = useCallback(
    (list: Conversation[]): Conversation[] => {
      const open = selectedThreadRef.current;
      if (!open) return list;
      const threadKey = `${open.sessionId}:${open.chatId}`;
      return list.map(c =>
        `${c.sessionId}:${c.chatId}` === threadKey
          ? { ...c, hasUnread: false, unreadCount: 0 }
          : c,
      );
    },
    [],
  );

  useEffect(() => {
    const page = unifiedConversations.data?.conversations;
    if (!page) return;
    if (!conversationCursor) {
      setAccumulatedConversations(
        sortConversationsByLastMessage(applyOpenThreadReadToList(page), conversationSort),
      );
      return;
    }
    setAccumulatedConversations(prev => {
      const seen = new Set(prev.map(c => `${c.sessionId}:${c.chatId}`));
      const merged = [...prev];
      for (const c of page) {
        const key = `${c.sessionId}:${c.chatId}`;
        if (!seen.has(key)) merged.push(c);
      }
      return sortConversationsByLastMessage(applyOpenThreadReadToList(merged), conversationSort);
    });
  }, [
    unifiedConversations.data,
    conversationCursor,
    conversationSort,
    selectedThread,
    applyOpenThreadReadToList,
  ]);

  const loadingConversations = unifiedConversations.isLoading;
  const fetchingConversations = unifiedConversations.isFetching;
  const refetchConversations = unifiedConversations.refetch;

  const conversations: Conversation[] = accumulatedConversations;
  const conversationTotal =
    unifiedConversations.data?.totalApproximate
      ? (unifiedConversations.data.threadTotal ?? accumulatedConversations.length)
      : (unifiedConversations.data?.total ?? accumulatedConversations.length);
  const queueCounts = queueCountsQuery.data?.counts ?? null;
  const preferClientQueueCounts =
    Boolean(leadSourceFilter.trim()) ||
    (channelFilter !== 'all' && channelFilter !== 'whatsapp');
  const canLoadMoreConversations = unifiedConversations.data?.hasMore === true;
  const loadingMoreConversations =
    Boolean(conversationCursor) && unifiedConversations.isFetching;

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (channelFilter !== 'all' && channelFilter !== 'whatsapp') {
      return [];
    }
    list = filterConversations(list, searchQuery, activeFilter, { myStaffId: getInboxStaffId() });
    if (activeFilter === 'unread') {
      list = list.filter(c => !isGroupChat(c.chatId));
    } else if (hideGroups && activeFilter !== 'groups') {
      list = list.filter(c => !isGroupChat(c.chatId));
    }
    return sortConversationsWithPinned(
      list,
      conversationSort,
      c => pinnedKeySet.has(chatRefKey(c)),
    );
  }, [
    conversations,
    activeFilter,
    conversationSort,
    channelFilter,
    searchQuery,
    pinnedKeySet,
    hideGroups,
  ]);

  const filteredUnreadCount = useMemo(
    () => filteredConversations.filter(c => c.unreadCount > 0).length,
    [filteredConversations],
  );

  const resetInboxFilters = useCallback(() => {
    setActiveFilter('all');
    setHideGroups(false);
    setLeadSourceFilter('');
    setConversationSort('newest');
    setChannelFilter('all');
    saveUserPreferences({
      inboxConversationFilter: 'all',
      inboxHideGroups: false,
      inboxConversationSort: 'newest',
    });
  }, [setActiveFilter, setHideGroups, setConversationSort]);

  const activeSessionId = viewMode === 'all' ? selectedThread?.sessionId ?? '' : sessionId;
  const activeChatId = selectedThread?.chatId ?? null;
  const activeThreadKey =
    activeSessionId && activeChatId ? `${activeSessionId}:${activeChatId}` : '';

  useEffect(() => {
    setTrainingLearnPrompt(null);
  }, [activeSessionId, activeChatId]);

  const {
    data: messagesData = { messages: [], total: 0 },
    isLoading: loadingMessages,
    isFetching: fetchingMessages,
    refetch: refetchMessages,
  } = useInboxMessagesQuery(activeSessionId, activeChatId, {
    enabled: !!activeSessionId && !!activeChatId,
    refetchInterval: threadReady || sessionReady ? livePollInterval : false,
    refetchOnWindowFocus: !wsConnected,
    limit: INBOX_MESSAGE_PAGE_SIZE,
    olderOffset: olderMessageOffset,
  });

  const serverMessages = messagesData.messages;
  const messageTotal = messagesData.total;

  const { data: threadEvents = [] } = useQuery({
    queryKey: ['inbox', 'thread-events', activeSessionId, activeChatId],
    queryFn: () => inboxApi.getThreadEvents(activeSessionId, activeChatId!),
    enabled: Boolean(activeSessionId && activeChatId),
    staleTime: 30_000,
    refetchInterval: threadReady || sessionReady ? livePollInterval : false,
  });

  const displayMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map(m => m.body + m.createdAt));
    const pending = pendingMessages.filter(p => !serverIds.has(p.body + p.createdAt));
    const merged = [...serverMessages, ...pending];
    if (!activeSessionId) return merged;
    return merged.filter(m => !m.sessionId || m.sessionId === activeSessionId);
  }, [serverMessages, pendingMessages, activeSessionId]);

  const visibleMessages = useMemo(() => {
    if (!selectedGroupMember || !groupMemberMessageFilter || !selectedThread) {
      return displayMessages;
    }
    if (!isGroupChat(selectedThread.chatId)) return displayMessages;
    return filterGroupMessagesByMember(displayMessages, selectedGroupMember);
  }, [displayMessages, selectedGroupMember, groupMemberMessageFilter, selectedThread]);

  const messageListItems = useMemo(
    () => buildMessageListItems(visibleMessages, t, threadEvents),
    [visibleMessages, threadEvents, t],
  );

  const canSend =
    canWrite &&
    !!activeSessionId &&
    !!activeChatId &&
    (viewMode === 'all' ? !!threadReady && !!selectedThread?.sessionId : sessionReady);
  const showConversationsLoader =
    waitingForSessionConnect ||
    (loadingConversations && accumulatedConversations.length === 0);
  const showMessagesLoader =
    Boolean(activeThreadKey) && loadingMessages && displayMessages.length === 0;
  const loadingOlderMessages = fetchingMessages && olderMessageOffset > 0;
  const sessionsInitialLoad = pendingSessions && allSessions.length === 0;
  const backgroundSyncing =
    (fetchingConversations || fetchingMessages) && !inboxListRefreshing && !chatRefreshing;
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
      const normalized = normalizeInboxFilterSelection(
        parseInboxConversationFilter(prefs.inboxConversationFilter),
      );
      setShowCustomerPanelState(prefs.inboxShowCustomerPanel);
      setShowChatListState(prefs.inboxShowChatList);
      setActiveFilterState(normalized.activeFilter);
      setHideGroupsState(prefs.inboxHideGroups || normalized.hideGroups);
      setConversationSortState(prefs.inboxConversationSort ?? 'newest');
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
    (thread?: SelectedThread | null, options?: { refetchMessages?: boolean }) => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
      void queryClient.refetchQueries({
        queryKey: ['inbox', 'conversations', 'all'],
        type: 'active',
      });
      const sid = thread?.sessionId;
      const cid = thread?.chatId;
      if (sid && cid) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.inboxMessages(sid, cid) });
        if (options?.refetchMessages !== false) {
          void queryClient.refetchQueries({
            queryKey: queryKeys.inboxMessages(sid, cid),
            type: 'active',
          });
        }
      }
    },
    [queryClient],
  );

  const markAllFilteredRead = useCallback(async () => {
    if (!canWrite) return;
    const targets = filteredConversations.filter(c => c.unreadCount > 0);
    if (targets.length === 0) return;
    const batch = targets.slice(0, 80);
    const results = await Promise.allSettled(
      batch.map(c => inboxApi.markConversationRead(c.sessionId, c.chatId)),
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    invalidateInbox();
    if (ok > 0) {
      toast.success(t('inbox.interakt.markAllReadDone', { count: ok }));
    } else {
      toast.error(t('inbox.interakt.markAllReadFailed'));
    }
  }, [canWrite, filteredConversations, invalidateInbox, toast, t]);

  const appendWsMessageToCache = useCallback(
    (thread: SelectedThread, payload: IncomingMessagePayload) => {
      if (olderMessageOffsetRef.current > 0) return;
      const message = inboxMessageFromWsPayload(thread.sessionId, payload);
      const cacheKey = [
        ...queryKeys.inboxMessages(thread.sessionId, thread.chatId),
        INBOX_MESSAGE_PAGE_SIZE,
        0,
      ] as const;
      queryClient.setQueryData<{ messages: InboxMessage[]; total: number }>(cacheKey, old => {
        if (!old) return old;
        const exists = old.messages.some(
          m =>
            m.id === message.id ||
            (message.waMessageId && m.waMessageId === message.waMessageId) ||
            (m.body === message.body &&
              m.direction === message.direction &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) <
                5_000),
        );
        if (exists) return old;
        return {
          messages: [...old.messages, message],
          total: old.total + 1,
        };
      });
    },
    [queryClient],
  );

  const conversationSortRef = useRef(conversationSort);
  conversationSortRef.current = conversationSort;

  const patchConversationListOnMessage = useCallback(
    (thread: SelectedThread, payload: IncomingMessagePayload, isOpenThread: boolean) => {
      const preview = listPreviewFromWsPayload(payload);
      const lastMessageAt = payload.timestamp
        ? new Date(payload.timestamp * 1000).toISOString()
        : new Date().toISOString();
      const lastDirection = payload.fromMe ? ('outgoing' as const) : ('incoming' as const);
      const threadKey = `${thread.sessionId}:${thread.chatId}`;

      const patchList = (list: Conversation[]): Conversation[] => {
        let found = false;
        const mapped = list.map(c => {
          if (`${c.sessionId}:${c.chatId}` !== threadKey) return c;
          found = true;
          const incomingWhileClosed = !isOpenThread && !payload.fromMe;
          return {
            ...c,
            lastPreview: preview || c.lastPreview,
            lastMessageAt,
            lastDirection,
            lastMessageType: payload.type ?? c.lastMessageType,
            hasUnread: incomingWhileClosed ? true : isOpenThread ? false : c.hasUnread,
            unreadCount: incomingWhileClosed
              ? (c.unreadCount ?? 0) + 1
              : isOpenThread
                ? 0
                : c.unreadCount,
          };
        });
        if (!found) return list;
        return sortConversationsByLastMessage(mapped, conversationSortRef.current);
      };

      queryClient.setQueriesData<{
        conversations: Conversation[];
        total: number;
      }>({ queryKey: ['inbox', 'conversations', 'all'] }, old =>
        old?.conversations ? { ...old, conversations: patchList(old.conversations) } : old,
      );

      setAccumulatedConversations(prev => patchList(prev));
    },
    [queryClient],
  );

  const invalidateInboxRef = useRef(invalidateInbox);
  const appendWsMessageToCacheRef = useRef(appendWsMessageToCache);
  const patchConversationListOnMessageRef = useRef(patchConversationListOnMessage);
  invalidateInboxRef.current = invalidateInbox;
  appendWsMessageToCacheRef.current = appendWsMessageToCache;
  patchConversationListOnMessageRef.current = patchConversationListOnMessage;

  const confirmLeaveIfDirty = useCallback((): boolean => {
    if (!crmDirty) return true;
    return window.confirm(t('inbox.unsavedCrmWarning'));
  }, [crmDirty, t]);

  useEffect(() => {
    const onNewChat = () => setNewChatOpen(true);
    window.addEventListener(OPENWA_NEW_CHAT_EVENT, onNewChat);
    return () => window.removeEventListener(OPENWA_NEW_CHAT_EVENT, onNewChat);
  }, []);

  useEffect(() => {
    const state = location.state as { newChat?: boolean; filter?: string } | null;
    if (state?.newChat) {
      setNewChatOpen(true);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
      return;
    }
    if (state?.filter) {
      setActiveFilter(parseInboxConversationFilter(state.filter));
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, navigate, setActiveFilter]);

  const urlSession = searchParams.get('session')?.trim() ?? '';
  const urlChat = searchParams.get('chat')?.trim() ?? '';
  const urlMember = searchParams.get('member')?.trim() ?? '';

  useEffect(() => {
    if (selectedThread) hadSelectedThreadRef.current = true;
  }, [selectedThread]);

  useEffect(() => {
    setCrmDirty(false);
  }, [selectedThread?.sessionId, selectedThread?.chatId]);

  useEffect(() => {
    if (location.pathname !== '/inbox') return;

    const params = new URLSearchParams();
    if (selectedThread) {
      params.set('session', selectedThread.sessionId);
      params.set('chat', selectedThread.chatId);
      if (selectedGroupMember && isGroupChat(selectedThread.chatId)) {
        params.set('member', selectedGroupMember);
      }
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;

    if (!selectedThread) {
      if (!hadSelectedThreadRef.current) return;
      if (!current) return;
      applyingUrlRef.current = true;
      setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }

    applyingUrlRef.current = true;
    setSearchParams(params, { replace: true });
  }, [
    selectedThread,
    selectedGroupMember,
    location.pathname,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (location.pathname !== '/inbox') return;
    if (loadingSessions || allSessions.length === 0) return;
    if (applyingUrlRef.current) {
      applyingUrlRef.current = false;
      return;
    }

    if (!urlSession || !urlChat) return;
    if (!allSessions.some(s => s.id === urlSession)) return;

    const matchesThread =
      selectedThread?.sessionId === urlSession && selectedThread?.chatId === urlChat;
    const wantsMember = Boolean(urlMember && isGroupChat(urlChat));
    const matchesMember = !wantsMember || selectedGroupMember === urlMember;

    if (matchesThread && matchesMember) return;

    suppressMemberClearRef.current = wantsMember;

    if (!matchesThread) {
      const thread = { sessionId: urlSession, chatId: urlChat };
      clearThreadUnreadInList(thread);
      setSelectedThread(thread);
      setViewMode('all');
      setComposerError(null);
      setOlderMessageOffset(0);
      setPendingMessages([]);
      prevMessageCountRef.current = 0;
      if (isMobile) setMobilePane('chat');
      void inboxApi
        .markConversationRead(urlSession, urlChat)
        .then(() => invalidateInbox(thread))
        .catch(() => undefined);
    }

    if (wantsMember) {
      setSelectedGroupMember(urlMember);
      if (isCompact) setCrmDrawerOpen(true);
    } else if (matchesThread) {
      setSelectedGroupMember(null);
    }
  }, [
    urlSession,
    urlChat,
    urlMember,
    loadingSessions,
    allSessions,
    location.pathname,
    selectedThread,
    selectedGroupMember,
    isMobile,
    isCompact,
    setViewMode,
    invalidateInbox,
    clearThreadUnreadInList,
  ]);

  const openThread = useCallback(
    (thread: SelectedThread, label?: string) => {
      if (selectedThread && !confirmLeaveIfDirty()) return;
      clearThreadUnreadInList(thread);
      setSelectedThread(thread);
      setComposerError(null);
      setOlderMessageOffset(0);
      setPendingMessages([]);
      prevMessageCountRef.current = 0;
      setMessageSearchOpen(false);
      setMessageSearchQuery('');
      setMessageSearchMatchId(null);
      if (isMobile) setMobilePane('chat');
      const conv = conversations.find(
        c => c.sessionId === thread.sessionId && c.chatId === thread.chatId,
      );
      recordInboxRecentChat({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        label: label ?? (conv ? getConversationTitle(conv, t) : undefined),
      });
      addInboxOpenTab({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        label: label ?? (conv ? getConversationTitle(conv, t) : undefined),
      });
      scrollConversationIntoView(thread.sessionId, thread.chatId);
      const markRead =
        viewMode === 'all'
          ? inboxApi.markConversationRead(thread.sessionId, thread.chatId)
          : sessionApi.markConversationRead(thread.sessionId, thread.chatId);
      void markRead
        .then(() => invalidateInbox(thread))
        .catch(() => undefined);
    },
    [
      selectedThread,
      confirmLeaveIfDirty,
      isMobile,
      viewMode,
      invalidateInbox,
      conversations,
      t,
      clearThreadUnreadInList,
    ],
  );

  const closeOpenTab = useCallback(
    (thread: SelectedThread) => {
      removeInboxOpenTab(thread.sessionId, thread.chatId);
      const isActive =
        selectedThread?.sessionId === thread.sessionId && selectedThread?.chatId === thread.chatId;
      if (!isActive) return;
      const remaining = getInboxOpenTabs();
      if (remaining.length === 0) {
        setSelectedThread(null);
        setDraft('');
        setComposerError(null);
        setMobilePane('list');
        return;
      }
      const next = remaining[0];
      if (next) openThread(next);
    },
    [selectedThread, openThread],
  );

  const navigateOpenTab = useCallback(
    (delta: 1 | -1) => {
      const tabs = getInboxOpenTabs();
      if (tabs.length < 2) return;
      const currentIdx = selectedThread
        ? tabs.findIndex(tab => tab.sessionId === selectedThread.sessionId && tab.chatId === selectedThread.chatId)
        : -1;
      const nextIdx =
        currentIdx < 0
          ? (delta > 0 ? 0 : tabs.length - 1)
          : (currentIdx + delta + tabs.length) % tabs.length;
      const next = tabs[nextIdx];
      if (next) openThread(next);
    },
    [selectedThread, openThread],
  );

  const handleStartSession = (targetSessionId: string) => {
    if (!canWrite) return;
    const target = allSessions.find(s => s.id === targetSessionId);
    const flowOpts = target && isLinkedSessionRecoverable(target) ? { skipPreflight: true } : undefined;
    void startSessionFlow(targetSessionId, allSessions, flowOpts).catch(err => {
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

  const focusSearch = useCallback(() => {
    setSearchPanelOpen(true);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  }, []);

  const prefetchThread = useCallback(
    (sessionId: string, chatId: string) => {
      void prefetchInboxMessages(queryClient, sessionId, chatId);
      void prefetchInboxCrm(queryClient, sessionId, chatId);
    },
    [queryClient],
  );

  const togglePinThread = useCallback(
    (ref: InboxChatRef) => {
      const conv = conversations.find(c => c.sessionId === ref.sessionId && c.chatId === ref.chatId);
      const label = ref.label ?? (conv ? getConversationTitle(conv, t) : undefined);
      void inboxApi
        .togglePin({ sessionId: ref.sessionId, chatId: ref.chatId, label })
        .then(result => {
          queryClient.setQueryData(queryKeys.inboxPins, result.pins);
          toast.success(
            result.pinned ? t('inbox.pinnedChat.added') : t('inbox.pinnedChat.removed'),
          );
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [conversations, queryClient, t, toast],
  );

  const isThreadPinned = useCallback(
    (thread: SelectedThread) => pinnedKeySet.has(chatRefKey(thread)),
    [pinnedKeySet],
  );

  const applySavedView = useCallback(
    (view: InboxSavedViewRow) => {
      const cfg = view.config;
      const filter = parseInboxConversationFilter(cfg.filter);
      setActiveFilter(filter);
      setHideGroups(cfg.hideGroups === true);
      setLeadSourceFilter(cfg.leadSourceFilter ?? '');
      setConversationSort(cfg.conversationSort ?? 'newest');
      setChannelFilter(
        cfg.channelFilter && cfg.channelFilter !== 'all'
          ? (cfg.channelFilter as ChannelId)
          : 'all',
      );
      saveUserPreferences({
        inboxConversationFilter: filter,
        inboxHideGroups: cfg.hideGroups === true,
        inboxConversationSort: cfg.conversationSort ?? 'newest',
      });
    },
    [setActiveFilter, setHideGroups, setConversationSort],
  );

  const saveCurrentInboxView = useCallback(() => {
    if (!canWrite) return;
    const name = window.prompt(t('inbox.savedViews.promptName', { defaultValue: 'Name this view' }));
    if (!name?.trim()) return;

    const config = {
      filter: activeFilter,
      hideGroups,
      leadSourceFilter: leadSourceFilter.trim() || undefined,
      conversationSort,
      channelFilter: channelFilter !== 'all' ? channelFilter : undefined,
    };

    void inboxApi
      .createSavedView({ name: name.trim(), config })
      .then(created => {
        queryClient.setQueryData<InboxSavedViewRow[]>(queryKeys.inboxSavedViews, (old = []) => [
          ...old,
          created,
        ]);
        toast.success(t('inbox.savedViews.saved', { defaultValue: 'View saved' }));
      })
      .catch(() => toast.error(t('common.errorGeneric')));
  }, [
    canWrite,
    activeFilter,
    hideGroups,
    leadSourceFilter,
    conversationSort,
    channelFilter,
    queryClient,
    t,
    toast,
  ]);

  const deleteSavedView = useCallback(
    (id: string) => {
      void inboxApi
        .deleteSavedView(id)
        .then(() => {
          queryClient.setQueryData<InboxSavedViewRow[]>(queryKeys.inboxSavedViews, (old = []) =>
            old.filter(view => view.id !== id),
          );
          toast.success(t('inbox.savedViews.deleted', { defaultValue: 'View removed' }));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [queryClient, t, toast],
  );

  const focusComposer = useCallback(() => {
    if (!selectedThread) return;
    composerInputRef.current?.focus();
  }, [selectedThread]);

  const navigateConversation = useCallback(
    (delta: 1 | -1) => {
      if (filteredConversations.length === 0) return;
      const currentIdx = selectedThread
        ? filteredConversations.findIndex(
            (c) => c.sessionId === selectedThread.sessionId && c.chatId === selectedThread.chatId,
          )
        : -1;
      let nextIdx = currentIdx < 0 ? (delta > 0 ? 0 : filteredConversations.length - 1) : currentIdx + delta;
      nextIdx = Math.max(0, Math.min(filteredConversations.length - 1, nextIdx));
      const conv = filteredConversations[nextIdx];
      if (!conv) return;
      openThread({ sessionId: conv.sessionId, chatId: conv.chatId });
    },
    [filteredConversations, selectedThread, openThread],
  );

  const navigateTriage = useCallback(
    (mode: 'unread' | 'needs_reply') => {
      const predicate =
        mode === 'unread'
          ? (c: Conversation) => c.hasUnread && !c.resolved
          : (c: Conversation) => matchesConversationFilter(c, 'needs_reply', { myStaffId: getInboxStaffId() });
      const next = findNextTriageConversation(filteredConversations, selectedThread, predicate);
      if (!next) {
        toast.info(t(`inbox.triage.${mode}Empty`));
        return;
      }
      openThread({ sessionId: next.sessionId, chatId: next.chatId });
    },
    [filteredConversations, selectedThread, openThread, toast, t],
  );

  useEffect(() => {
    if (loadingSessions || allSessions.length === 0) return;

    let ro: ResizeObserver | null = null;
    let cancelled = false;

    const applyWidth = (width: number) => {
      setContainerWidth(width);
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
    if (!selectedThread) return;
    if (allSessions.some(s => s.id === selectedThread.sessionId)) return;
    setSelectedThread(null);
    setDraft('');
    setComposerError(null);
    setPendingMessages([]);
    setOlderMessageOffset(0);
    setAccumulatedConversations(prev =>
      prev.filter(c => c.sessionId !== selectedThread.sessionId),
    );
  }, [allSessions, selectedThread]);

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

  const readySessionIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const readyIds = new Set(allSessions.filter(s => s.status === 'ready').map(s => s.id));
    let sessionBecameReady = false;
    for (const id of readyIds) {
      if (!readySessionIdsRef.current.has(id)) sessionBecameReady = true;
    }
    readySessionIdsRef.current = readyIds;
    if (!sessionBecameReady) return;
    void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['inbox', 'avatar'] });
  }, [allSessions, queryClient]);

  useEffect(() => {
    setOlderMessageOffset(0);
    setPendingMessages([]);
  }, [activeSessionId, activeChatId]);

  useEffect(() => {
    if (!inboxListRefreshing && !chatRefreshing) {
      setShowSyncing(false);
      return;
    }
    if (!fetchingConversations && !fetchingMessages) {
      setShowSyncing(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSyncing(true), 400);
    return () => window.clearTimeout(timer);
  }, [fetchingConversations, fetchingMessages, inboxListRefreshing, chatRefreshing]);

  useEffect(() => {
    const count = displayMessages.length;
    if (count > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    prevMessageCountRef.current = count;
  }, [displayMessages]);

  useEffect(() => {
    if (!selectedGroupMember) {
      prevSelectedMemberRef.current = null;
      return;
    }
    if (groupMemberMessageFilter) return;
    if (!selectedThread || !isGroupChat(selectedThread.chatId)) return;
    if (displayMessages.length === 0) return;
    if (prevSelectedMemberRef.current === selectedGroupMember) return;
    prevSelectedMemberRef.current = selectedGroupMember;

    const memberMessages = filterGroupMessagesByMember(displayMessages, selectedGroupMember);
    const last = memberMessages[memberMessages.length - 1];
    if (!last) return;

    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-message-id="${CSS.escape(last.id)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    selectedGroupMember,
    groupMemberMessageFilter,
    selectedThread,
    displayMessages,
  ]);

  const viewModeRef = useRef(viewMode);
  const sessionIdRef = useRef(sessionId);
  viewModeRef.current = viewMode;
  sessionIdRef.current = sessionId;

  const { isConnected: inboxWsConnected } = useWebSocket({
    sessionId: viewMode === 'all' ? '*' : sessionId || undefined,
    sessionEvents:
      viewMode === 'one' && !sessionId ? undefined : ['message.received', 'message.sent'],
    globalEvents: ['ai.learning.pending'],
    onGlobalEvent: (event, msgSessionId, data) => {
      if (event !== 'ai.learning.pending') return;
      const chatId = typeof data.chatId === 'string' ? data.chatId : '';
      const itemId = typeof data.itemId === 'string' ? data.itemId : undefined;
      const question = typeof data.question === 'string' ? data.question : '';
      setTrainingLearnPrompt(prev => {
        if (!prev || prev.sessionId !== msgSessionId || prev.chatId !== chatId) return prev;
        return { ...prev, itemId, question: question || prev.question };
      });
    },
    onMessageEvent: (_event, { sessionId: msgSessionId, message: raw }) => {
      const data = raw as unknown as IncomingMessagePayload;
      if (!data?.chatId) return;
      if (viewModeRef.current === 'one' && msgSessionId !== sessionIdRef.current) return;

      const messageThread: SelectedThread = {
        sessionId: msgSessionId,
        chatId: data.chatId,
      };
      const current = selectedThreadRef.current;
      const matchesThread =
        current &&
        messageThread.sessionId === current.sessionId &&
        messageThread.chatId === current.chatId;

      const isOpenThread = Boolean(matchesThread);
      patchConversationListOnMessageRef.current(messageThread, data, isOpenThread);

      if (matchesThread) {
        setPendingMessages([]);
        setOlderMessageOffset(0);
        appendWsMessageToCacheRef.current(messageThread, data);
      }
    },
  });

  useEffect(() => {
    setWsConnected(inboxWsConnected);
    if (inboxWsConnected) {
      setWsReconnecting(false);
      if (wsHadConnectedRef.current && wsDisconnectedWhileLiveRef.current) {
        invalidateInboxRef.current(selectedThreadRef.current, { refetchMessages: true });
        wsDisconnectedWhileLiveRef.current = false;
      }
      wsHadConnectedRef.current = true;
    } else if (wsHadConnectedRef.current) {
      wsDisconnectedWhileLiveRef.current = true;
      setWsReconnecting(true);
    }
  }, [inboxWsConnected]);

  const addOptimisticMessage = useCallback((message: InboxMessage) => {
    setPendingMessages(prev => [...prev, message]);
  }, []);

  const removeOptimisticMessage = useCallback((id: string) => {
    setPendingMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const startQuoteReply = useCallback((message: InboxMessage) => {
    const quotedMessageId = message.waMessageId?.trim();
    if (!quotedMessageId) return;
    const preview = (message.body?.trim() || mediaLabel(message.type)).slice(0, 160);
    setQuoteReply({ messageId: message.id, quotedMessageId, preview });
    dispatchComposerTab('reply');
    window.setTimeout(() => composerInputRef.current?.focus(), 0);
  }, []);

  const clearQuoteReply = useCallback(() => setQuoteReply(null), []);

  const replyToLastInbound = useCallback(() => {
    if (!canWrite) return;
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const message = visibleMessages[i];
      if (message.direction !== 'incoming') continue;
      if (!message.waMessageId?.trim()) continue;
      startQuoteReply(message);
      return;
    }
  }, [canWrite, visibleMessages, startQuoteReply]);

  const confirmStaffSendPausesAi = useCallback(async (): Promise<boolean> => {
    if (!shouldConfirmAiTakeoverBeforeStaffSend(selectedConv)) return true;
    return new Promise<boolean>(resolve => {
      aiTakeoverSendConfirmResolverRef.current = resolve;
      setAiTakeoverSendConfirmOpen(true);
    });
  }, [selectedConv]);

  const confirmAiTakeoverSend = useCallback(() => {
    setAiTakeoverSendConfirmOpen(false);
    aiTakeoverSendConfirmResolverRef.current?.(true);
    aiTakeoverSendConfirmResolverRef.current = null;
  }, []);

  const cancelAiTakeoverSend = useCallback(() => {
    setAiTakeoverSendConfirmOpen(false);
    aiTakeoverSendConfirmResolverRef.current?.(false);
    aiTakeoverSendConfirmResolverRef.current = null;
  }, []);

  const handleSend = async () => {
    if (!activeSessionId || !activeChatId || !draft.trim() || !canSend) return;
    if (!(await confirmStaffSendPausesAi())) return;
    const text = draft.trim();
    const wasWaitingHuman = selectedConv?.aiHandlingState === 'waiting_human';
    const lastIncoming = [...visibleMessages].reverse().find(m => m.direction === 'incoming');
    const activeQuote = quoteReply;
    const optimistic = createOptimisticOutgoingMessage(activeSessionId, activeChatId, text);
    setPendingMessages(prev => [...prev, optimistic]);
    setSending(true);
    setComposerError(null);
    setDraft('');
    setQuoteReply(null);
    try {
      if (activeQuote) {
        await inboxApi.sendText({
          sessionId: activeSessionId,
          chatId: activeChatId,
          text,
          quotedMessageId: activeQuote.quotedMessageId,
        });
      } else {
        await inboxApi.sendText({ sessionId: activeSessionId, chatId: activeChatId, text });
      }
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      invalidateInbox(selectedThread);
      if (wasWaitingHuman && lastIncoming?.body) {
        setTrainingLearnPrompt({
          sessionId: activeSessionId,
          chatId: activeChatId,
          question: lastIncoming.body.slice(0, 200),
          staffAnswer: text,
        });
      }
    } catch (err) {
      if (activeQuote) setQuoteReply(activeQuote);
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      const msg = err instanceof Error ? err.message : t('inbox.errorSend');
      if (
        msg.includes('WHATSAPP_CONNECTION_LOST') ||
        msg.includes('detached Frame') ||
        msg.includes('SESSION_NOT_READY') ||
        msg.includes('not connected')
      ) {
        setComposerError(
          msg.includes('WHATSAPP_CONNECTION_LOST')
            ? t('inbox.whatsappConnectionLost')
            : t('inbox.sessionNotConnected'),
        );
      } else {
        setComposerError(msg);
      }
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
    if (!(await confirmStaffSendPausesAi())) return;

    const previewUrl = URL.createObjectURL(file);
    const caption = draft.trim();
    const activeQuote = quoteReply;
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
    setQuoteReply(null);

    try {
      const base64 = await readFileAsBase64(file);
      await inboxApi.sendImageFile(activeSessionId, activeChatId, base64, file.type, {
        caption: caption || undefined,
        filename: file.name,
        quotedMessageId: activeQuote?.quotedMessageId,
      });
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      invalidateInbox(selectedThread);
    } catch (err) {
      if (activeQuote) setQuoteReply(activeQuote);
      setPendingMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setComposerError(err instanceof Error ? err.message : t('inbox.errorSendImage'));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setSending(false);
    }
  };

  const handleManualRefresh = useCallback(() => {
    const startedAt = Date.now();
    listRefreshStartedRef.current = startedAt;
    setInboxListRefreshing(true);
    const tasks: Promise<unknown>[] = [refetchSessions(), refetchConversations()];
    if (activeChatId) tasks.push(refetchMessages());
    void Promise.all(tasks).finally(() => {
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      window.setTimeout(() => setInboxListRefreshing(false), remaining);
    });
  }, [refetchSessions, refetchConversations, refetchMessages, activeChatId]);

  const handleRefreshChat = useCallback(() => {
    if (!activeSessionId || !activeChatId) return;
    const startedAt = Date.now();
    chatRefreshStartedRef.current = startedAt;
    setChatRefreshing(true);
    setOlderMessageOffset(0);
    const thread = selectedThread ?? { sessionId: activeSessionId, chatId: activeChatId };
    invalidateInbox(thread);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.inboxAvatar(activeSessionId, activeChatId),
    });
    void queryClient.invalidateQueries({
      queryKey: ['inbox', 'crm', activeSessionId, activeChatId],
    });
    void refetchMessages().finally(() => {
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      window.setTimeout(() => setChatRefreshing(false), remaining);
    });
  }, [
    activeSessionId,
    activeChatId,
    selectedThread,
    invalidateInbox,
    refetchMessages,
    queryClient,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const typing = isInboxEditableTarget(e.target);
      const mod = isInboxModKey(e);
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          e.preventDefault();
          return;
        }
        if (messageSearchOpen) {
          setMessageSearchOpen(false);
          setMessageSearchQuery('');
          setMessageSearchMatchId(null);
          e.preventDefault();
          return;
        }
        if (typing) {
          (e.target as HTMLElement).blur();
          e.preventDefault();
          return;
        }
        if (crmDrawerOpen) {
          setCrmDrawerOpen(false);
          e.preventDefault();
          return;
        }
        if (selectedThread) {
          backToList();
          e.preventDefault();
        }
        return;
      }

      if (typing && !(mod && (key === 'k' || key === 'f'))) return;

      if (mod && key === 'f' && selectedThread) {
        e.preventDefault();
        setMessageSearchOpen(true);
        return;
      }

      if (mod && key === 'k') {
        e.preventDefault();
        focusSearch();
        return;
      }

      if (!mod && key === '/' && !typing) {
        e.preventDefault();
        focusSearch();
        return;
      }

      if (mod && e.shiftKey && key === 'k') {
        e.preventDefault();
        dispatchOpenCommandPalette();
        return;
      }

      if (mod && e.shiftKey && key === 'p' && selectedThread && canWrite) {
        e.preventDefault();
        dispatchOpenQuickReplies();
        return;
      }

      if (mod && e.shiftKey && key === 't' && selectedThread && canWrite) {
        e.preventDefault();
        dispatchOpenTransfer({ sessionId: selectedThread.sessionId, chatId: selectedThread.chatId });
        setTransferModalOpen(true);
        return;
      }

      if (mod && e.shiftKey && key === 'd' && selectedThread && canWrite) {
        e.preventDefault();
        dispatchOpenResolve({ sessionId: selectedThread.sessionId, chatId: selectedThread.chatId });
        return;
      }

      if (mod && e.shiftKey && key === 'n') {
        e.preventDefault();
        setNewChatOpen(true);
        return;
      }

      if (mod && key === 'e') {
        e.preventDefault();
        if (selectedThread) focusComposer();
        else setNewChatOpen(true);
        return;
      }

      if (mod && e.shiftKey && key === 'a' && canSend && !sending) {
        e.preventDefault();
        handleAttachImageClick();
        return;
      }

      if (mod && e.shiftKey && key === 'r') {
        e.preventDefault();
        handleManualRefresh();
        return;
      }

      if (mod && key === 'i') {
        e.preventDefault();
        toggleShowCustomerPanel();
        return;
      }

      if (mod && key === 'b') {
        e.preventDefault();
        toggleShowChatList();
        return;
      }

      if (e.key === '?' && !mod && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }

      if (e.altKey && !mod && !e.shiftKey && !typing) {
        if (key === ']') {
          e.preventDefault();
          navigateOpenTab(1);
          return;
        }
        if (key === '[') {
          e.preventDefault();
          navigateOpenTab(-1);
          return;
        }
      }

      if (!mod && !e.altKey && !e.shiftKey && !typing) {
        if (key === 'n') {
          e.preventDefault();
          navigateTriage('unread');
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          if (selectedThread && canWrite) {
            replyToLastInbound();
          } else {
            navigateTriage('needs_reply');
          }
          return;
        }
        const filterIndex = Number.parseInt(e.key, 10);
        if (filterIndex >= 1 && filterIndex <= INBOX_CONVERSATION_FILTERS.length) {
          e.preventDefault();
          setActiveFilter(INBOX_CONVERSATION_FILTERS[filterIndex - 1]);
          return;
        }
      }

      if (e.altKey && !mod && !e.shiftKey && selectedThread) {
        const tabByKey: Record<string, OpenComposerTabDetail> = {
          '1': 'reply',
          '2': 'notes',
          '3': 'followup',
          '4': 'quote',
        };
        const tab = tabByKey[key];
        if (tab) {
          e.preventDefault();
          dispatchComposerTab(tab);
          return;
        }
      }

      if (!mod && !e.altKey && !typing) {
        if (key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          navigateConversation(1);
          return;
        }
        if (key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          navigateConversation(-1);
          return;
        }
        if (e.key === 'Enter' && selectedThread) {
          const activeEl = document.activeElement as HTMLElement | null;
          if (activeEl?.closest('[data-conversation-key]')) {
            e.preventDefault();
            focusComposer();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedThread,
    backToList,
    crmDrawerOpen,
    shortcutsOpen,
    messageSearchOpen,
    focusSearch,
    focusComposer,
    canSend,
    sending,
    setActiveFilter,
    toggleShowCustomerPanel,
    toggleShowChatList,
    navigateConversation,
    navigateTriage,
    navigateOpenTab,
    canWrite,
    replyToLastInbound,
    setTransferModalOpen,
    refetchSessions,
    refetchConversations,
    refetchMessages,
    activeChatId,
    handleManualRefresh,
  ]);

  const composerPlaceholder = !canWrite
    ? t('inbox.cannotSendNoWrite')
    : !canSend
      ? t('inbox.cannotSendDisconnected')
      : t('inbox.placeholder');

  const sessionStatusKey = threadSession?.status ?? selectedSession?.status;
  const activeSendSession =
    viewMode === 'all' ? threadSession ?? null : selectedSession ?? null;

  const closeNewChat = useCallback(() => setNewChatOpen(false), []);

  const handleNewChatOpen = useCallback(
    (targetSessionId: string, chatId: string) => {
      setNewChatOpen(false);
      if (viewMode === 'one' && targetSessionId !== sessionId) {
        setSessionId(targetSessionId);
      }
      openThread({ sessionId: targetSessionId, chatId });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations', 'all'] });
    },
    [viewMode, sessionId, openThread, queryClient],
  );

  const loadMoreConversations = useCallback(() => {
    if (!canLoadMoreConversations || loadingMoreConversations) return;
    const next = unifiedConversations.data?.nextCursor;
    if (next) setConversationCursor(next);
  }, [
    canLoadMoreConversations,
    loadingMoreConversations,
    unifiedConversations.data?.nextCursor,
  ]);

  const selectSessionRail = (id: string) => {
    if (!confirmLeaveIfDirty()) return;
    setSessionId(id);
    setViewMode('one');
    setSelectedThread(null);
    setComposerError(null);
  };

  const recommendSingleSession =
    viewMode === 'all' && unifiedConversations.data?.recommendSingleSession === true;

  const switchToSingleAccount = useCallback(() => {
    const ready = allSessions.find(s => s.status === 'ready') ?? allSessions[0];
    if (!ready) return;
    if (!confirmLeaveIfDirty()) return;
    setViewMode('one');
    setSessionId(ready.id);
    setSelectedThread(null);
    setComposerError(null);
  }, [allSessions, confirmLeaveIfDirty, setViewMode]);

  return {
    t,
    canWrite,
    allSessions,
    loadingSessions,
    sessionsInitialLoad,
    sessionStartPending,
    isSessionConnecting,
    qrModal,
    linkPreflight,
    closeQrModal,
    continueQrInBackground,
    confirmLinkPreflight,
    cancelLinkPreflight,
    retrySessionFlow,
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
    trainingLearnPrompt,
    dismissTrainingLearnPrompt: () => setTrainingLearnPrompt(null),
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    searchPanelOpen,
    setSearchPanelOpen,
    channelFilter,
    setChannelFilter,
    messageSearchOpen,
    setMessageSearchOpen,
    messageSearchQuery,
    setMessageSearchQuery,
    messageSearchMatchId,
    setMessageSearchMatchId,
    prefetchThread,
    togglePinThread,
    isThreadPinned,
    savedViews,
    applySavedView,
    saveCurrentInboxView,
    deleteSavedView,
    navigateTriage,
    activeFilter,
    setActiveFilter,
    hideGroups,
    setHideGroups,
    filteredUnreadCount,
    resetInboxFilters,
    markAllFilteredRead,
    activeChatTypeFilter,
    setActiveChatTypeFilter,
    selectedGroupMember,
    setSelectedGroupMember,
    groupMemberMessageFilter,
    setGroupMemberMessageFilter,
    visibleMessages,
    leadSourceFilter,
    setLeadSourceFilter,
    conversationSort,
    setConversationSort,
    isMobile,
    isCompact,
    containerWidth,
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
    searchInputRef,
    composerInputRef,
    selectedSession,
    threadSession,
    sessionReady,
    threadReady,
    anySessionReady,
    anyBackgroundSyncing,
    syncingChatsEmpty,
    connectedReadySessionCount,
    showSessionLabel,
    conversations,
    filteredConversations,
    unifiedTotal: conversationTotal,
    queueCounts,
    largeAccountMode,
    largeAccountRecentWindowActive,
    largeAccountActiveSinceDays: effectiveActiveSinceDays,
    threadTotal: unifiedConversations.data?.threadTotal,
    recommendSingleSession,
    showAllLargeAccountHistory: () => setLargeAccountShowAllHistory(true),
    switchToSingleAccount,
    preferClientQueueCounts,
    loadMoreConversations,
    canLoadMoreConversations,
    loadingMoreConversations,
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
    loadingOlderMessages,
    displayMessages,
    confirmLeaveIfDirty,
    openThread,
    closeOpenTab,
    navigateOpenTab,
    transferModalOpen,
    setTransferModalOpen,
    handleStartSession,
    backToList,
    handleSend,
    handleAttachImageClick,
    handleImageFileChange,
    handleComposerKeyDown,
    handleManualRefresh,
    handleRefreshChat,
    inboxListRefreshing,
    chatRefreshing,
    backgroundSyncing,
    composerPlaceholder,
    sessionStatusKey,
    activeSendSession,
    invalidateInbox,
    selectSessionRail,
    setOlderMessageOffset,
    shortcutsOpen,
    setShortcutsOpen,
    addOptimisticMessage,
    removeOptimisticMessage,
    newChatOpen,
    closeNewChat,
    handleNewChatOpen,
    quoteReply,
    startQuoteReply,
    clearQuoteReply,
    replyToLastInbound,
    aiTakeoverSendConfirmOpen,
    confirmAiTakeoverSend,
    cancelAiTakeoverSend,
  };
}

export type InboxController = ReturnType<typeof useInboxController>;
