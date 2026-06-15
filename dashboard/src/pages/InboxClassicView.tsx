import { useMemo, useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, RefreshCw, Search, ArrowLeft, MessageSquare, X, User, Inbox, ChevronDown } from 'lucide-react';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { InboxComposerTools } from '../components/InboxComposerTools';
import { InboxAiTrainingLearnStrip } from '../components/InboxAiTrainingLearnStrip';
import { InboxAssigneeSelect } from '../components/InboxAssigneeSelect';
import { InboxResolveChatButton } from '../components/InboxResolveChatButton';
import { useTheme } from '../hooks/useTheme';
import { InboxInteraktActionModals } from '../components/InboxInteraktActionModals';
import {
  type InteraktComposerTab,
} from '../components/InboxInteraktChatHeader';
import { channelSupportsAction } from '../lib/channels';
import { InboxInteraktAiStatusStrip } from '../components/InboxInteraktAiStatusStrip';
import { InboxHealthStrip } from '../components/inbox-workspace/InboxHealthStrip';
import '../components/inbox-workspace/InboxHealthStrip.css';
import { InboxLargeAccountBanner } from '../components/InboxLargeAccountBanner';
import '../components/InboxLargeAccountBanner.css';
import type { Session } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Portal } from '../components/ModalOverlay';
import { InboxContactAvatar } from '../components/InboxContactAvatar';
import { InboxActiveSendAccount } from '../components/InboxActiveSendAccount';
import { InboxConversationCrmBadges } from '../components/InboxConversationCrmBadges';
import { InboxConversationPreview } from '../components/InboxConversationPreview';
import { InboxStitchListRowStack } from '../components/InboxStitchListRowStack';
import { InboxConversationListInfiniteScroll } from '../components/InboxConversationListInfiniteScroll';
import { InboxVirtualConversationList } from '../components/InboxVirtualConversationList';
import { InboxStitchConversationList } from '../components/InboxStitchConversationList';
import { InboxVirtualMessageList } from '../components/InboxVirtualMessageList';
import { InboxThreadEventRow } from '../components/inbox-workspace/InboxThreadEventRow';
import '../components/inbox-workspace/InboxThreadEventRow.css';
import { InboxMessageSearch } from '../components/InboxMessageSearch';
import {
  OPENWA_COMPOSER_TAB_EVENT,
  OPENWA_SCHEDULE_FOLLOWUP_EVENT,
  dispatchOpenNewChat,
  type OpenComposerTabDetail,
  type InboxActionThreadDetail,
} from '../lib/inbox-events';
import '../components/inbox-speed.css';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import { InboxMessageBubble } from './InboxMessageBubble';
import { InboxAlbumMessageBubble } from './InboxAlbumMessageBubble';
import { InboxKeyboardShortcutsDialog } from './InboxKeyboardShortcutsDialog';
import { InboxCrmPanelRouter } from '../components/inbox-crm';
import { ConversationTypeBadge } from '../components/inbox-crm';
import { ChatTypeFilter } from '../components/inbox-crm';
import { InboxGroupComposerNotice } from '../components/InboxGroupComposerNotice';
import { InboxGroupMemberContextStrip } from '../components/InboxGroupMemberContextStrip';
import { inferConversationType } from '../lib/conversation-types';
import {
  getGroupMessageSenderId,
  getGroupMessageSenderLabel,
  resolveGroupMemberMessageHighlight,
} from '../lib/group-participants';
import { useGroupParticipants } from '../hooks/useGroupParticipants';
import { resolveGroupPersonalTarget } from '../lib/group-action-target';
import {
  formatChatIdLabelI18n,
  conversationStatusChips,
  getConversationTitle,
  getChatKind,
  shouldShowChatKindBadge,
  sessionAccentColor,
  formatMessageTime,
  formatInteraktBubbleTime,
  formatConversationListTime,
  insertComposerText,
  pipelineStageLabelShort,
  pipelineStageLabelFull,
} from './inbox-helpers';
import { normalizeInboxFilter, INBOX_ALL_FILTERS, getInboxFilterLabel } from './inbox-features';
import { resolveInboxFilterBadgeCount } from '../lib/inbox-queue-counts';
import { getInboxStaffId } from '../lib/inbox-staff-identity';
import { readStitchCrmTab, writeStitchCrmTab } from '../lib/inbox-stitch-profile';
import { isLinkedSessionRecovering } from '../lib/linked-session-recovery';
import { formatUnreadCount, INBOX_WIDTH_INTERAKT_INLINE, INBOX_WIDTH_STITCH_INLINE, type InboxController } from './useInboxController';
import { inboxModKeyLabel } from './inbox-shortcuts';
import { INBOX_MESSAGE_PAGE_SIZE } from '../hooks/queries';
import { useInboxAiTyping } from '../hooks/useInboxAiTyping';
import { useInboxAiSendQueue } from '../hooks/useInboxAiSendQueue';
import { LEAD_SOURCES, leadSourceLabel } from '../lib/lead-sources';
import { useShellInboxSearchPublisher } from '../lib/shell-inbox-search-context';
import type { LayoutOutletContext } from '../lib/layout-outlet-context';
import { InboxContextMenu } from '../components/InboxContextMenu';
import { InboxQuoteReplyBar } from '../components/InboxQuoteReplyBar';
import { useInboxContextMenu } from '../hooks/useInboxContextMenu';
import { useInboxLongPress } from '../hooks/useInboxLongPress';
import { useInboxPanelWidths } from '../hooks/useInboxPanelWidths';
import { InboxPanelResizeHandle } from '../components/InboxPanelResizeHandle';
import {
  InboxListHeader,
  InboxChatHeader,
  InboxComposer,
} from '../components/inbox-workspace';
import { InboxStitchAiSuggestionsPanel } from '../components/InboxStitchAiSuggestionsPanel';
import { InboxTacticalView } from './inbox-tactical-shell';
import './Inbox.css';

type StatusChipKind = 'needs_reply' | 'replied' | 'group' | 'resolved' | 'follow_up' | 'autopilot_paused';

function StatusChip({ kind }: { kind: StatusChipKind }) {
  const { t } = useTranslation();
  const labels: Record<StatusChipKind, string> = {
    needs_reply: t('inbox.chipNeedsReply'),
    replied: t('inbox.chipReplied'),
    group: t('inbox.chipGroup'),
    resolved: t('inbox.chipResolved'),
    follow_up: t('inbox.chipFollowUp'),
    autopilot_paused: t('inbox.chipAutopilotPaused'),
  };
  return <span className={`inbox-status-chip inbox-status-chip--${kind}`}>{labels[kind]}</span>;
}

export function InboxClassicView({
  ctrl,
  layoutCtx,
  variant: variantProp,
}: {
  ctrl: InboxController;
  layoutCtx?: LayoutOutletContext;
  variant?: import('./inbox-workspace-types').InboxVariant;
}) {
  if (variantProp === 'tactical') {
    return <InboxTacticalView ctrl={ctrl} />;
  }
  return <InboxClassicViewMain ctrl={ctrl} layoutCtx={layoutCtx} variant={variantProp} />;
}

function InboxClassicViewMain({
  ctrl,
  layoutCtx,
  variant: variantProp,
}: {
  ctrl: InboxController;
  layoutCtx?: LayoutOutletContext;
  variant?: import('./inbox-workspace-types').InboxVariant;
}) {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const isInterakt = variantProp ? variantProp === 'interakt' : activeTheme.effects === 'interakt';
  const isStitch = variantProp === 'stitch';
  const isKitInbox = isInterakt || isStitch;
  const interaktV2Shell = layoutCtx?.interaktV2Shell ?? false;
  const stitchV1Shell = layoutCtx?.stitchV1Shell ?? false;
  const [interaktCrmTab, setInteraktCrmTab] = useState<'details' | 'timeline'>('details');
  const [composerTab, setComposerTab] = useState<InteraktComposerTab>('reply');
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const customerNotesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stitchComposerStackRef = useRef<HTMLDivElement | null>(null);
  const inboxContextMenu = useInboxContextMenu(ctrl);
  const {
    allSessions,
    sessionStartPending,
    isSessionConnecting,
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
    searchQuery,
    setSearchQuery,
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
    activeFilter,
    setActiveFilter,
    hideGroups,
    setHideGroups,
    filteredUnreadCount,
    resetInboxFilters,
    markAllFilteredRead,
    canWrite,
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
    setCrmDirty,
    wsReconnecting,
    messagesEndRef,
    selectedSession,
    threadSession,
    activeSendSession,
    connectedReadySessionCount,
    showSessionLabel,
    sessionReady,
    canSend,
    setComposerError,
    displayMessages,
    showSyncing,
    showConversationsLoader,
    showMessagesLoader,
    totalUnread,
    conversations,
    filteredConversations,
    unifiedTotal,
    queueCounts,
    largeAccountMode,
    largeAccountRecentWindowActive,
    largeAccountActiveSinceDays,
    threadTotal,
    showAllLargeAccountHistory,
    recommendSingleSession,
    switchToSingleAccount,
    preferClientQueueCounts,
    loadMoreConversations,
    canLoadMoreConversations,
    loadingMoreConversations,
    activeSessionId,
    messageListItems,
    canLoadOlder,
    fetchingMessages,
    loadingOlderMessages,
    confirmLeaveIfDirty,
    openThread,
    handleStartSession,
    backToList,
    handleSend,
    handleAttachImageClick,
    handleImageFileChange,
    handleComposerKeyDown,
    imageInputRef,
    handleManualRefresh,
    handleRefreshChat,
    inboxListRefreshing,
    chatRefreshing,
    backgroundSyncing,
    composerPlaceholder,
    activeChatId,
    sessionStatusKey,
    invalidateInbox,
    anySessionReady,
    anyBackgroundSyncing,
    syncingChatsEmpty,
    setOlderMessageOffset,
    searchInputRef,
    composerInputRef,
    shortcutsOpen,
    setShortcutsOpen,
    addOptimisticMessage,
    removeOptimisticMessage,
    quoteReply,
    clearQuoteReply,
    trainingLearnPrompt,
    dismissTrainingLearnPrompt,
  } = ctrl;

  const handleGlobalSearchOpenThread = useCallback(
    (sessionId: string, chatId: string) => openThread({ sessionId, chatId }),
    [openThread],
  );

  const shellSearchBinding = useMemo(
    () => ({
      searchInputRef,
      openThread: handleGlobalSearchOpenThread,
      applyListSearch: setSearchQuery,
    }),
    [searchInputRef, handleGlobalSearchOpenThread, setSearchQuery],
  );

  useShellInboxSearchPublisher(
    (interaktV2Shell && isInterakt) || (stitchV1Shell && isStitch),
    shellSearchBinding,
  );

  const convLongPressTarget = useRef<import('../services/api').Conversation | null>(null);
  const convLongPress = useInboxLongPress((x, y) => {
    const conv = convLongPressTarget.current;
    if (conv) inboxContextMenu.presentConversationMenuAt(x, y, conv);
  });

  const messageLongPressTarget = useRef<{
    message: import('../services/api').InboxMessage;
    sessionId: string;
    thread?: { sessionId: string; chatId: string };
    openLightbox?: () => void;
  } | null>(null);
  const messageLongPress = useInboxLongPress((x, y) => {
    const target = messageLongPressTarget.current;
    if (!target) return;
    inboxContextMenu.presentMessageMenuAt(x, y, target.message, {
      sessionId: target.sessionId,
      thread: target.thread,
      openLightbox: target.openLightbox,
    });
  });

  const crmLongPress = useInboxLongPress((x, y) => {
    if (selectedConv) inboxContextMenu.presentCrmMenuAt(x, y, selectedConv);
  });

  useEffect(() => {
    if (!isStitch || !selectedThread) {
      if (!isStitch) setInteraktCrmTab('details');
      return;
    }
    setInteraktCrmTab(
      readStitchCrmTab(selectedThread.sessionId, selectedThread.chatId) ?? 'details',
    );
  }, [isStitch, selectedThread?.sessionId, selectedThread?.chatId]);

  const handleInteraktCrmTabChange = useCallback(
    (tab: 'details' | 'timeline') => {
      setInteraktCrmTab(tab);
      if (isStitch && selectedThread) {
        writeStitchCrmTab(selectedThread.sessionId, selectedThread.chatId, tab);
      }
    },
    [isStitch, selectedThread],
  );

  const modKey = inboxModKeyLabel();
  const aiTyping = useInboxAiTyping(activeSessionId || undefined, activeChatId || undefined);
  const aiSendQueue = useInboxAiSendQueue(activeSessionId || undefined, activeChatId || undefined);

  const badgeCountOptions = useMemo(
    () => ({
      myStaffId: getInboxStaffId(),
      queueCounts,
      preferClientQueueCounts,
    }),
    [queueCounts, preferClientQueueCounts],
  );

  const showChatKindBadges = shouldShowChatKindBadge(filteredConversations);

  const stitchListSections = useMemo(() => {
    if (!isStitch) return null;
    const pinned = filteredConversations.filter(c =>
      isThreadPinned({ sessionId: c.sessionId, chatId: c.chatId }),
    );
    const pinnedKeys = new Set(pinned.map(c => `${c.sessionId}:${c.chatId}`));
    const recent = filteredConversations.filter(
      c => !pinnedKeys.has(`${c.sessionId}:${c.chatId}`),
    );
    return { pinned, recent };
  }, [isStitch, filteredConversations, isThreadPinned]);

  const renderStitchConversationRow = useCallback(
    (conv: import('../services/api').Conversation, showPinIcon: boolean) => {
      const isActive =
        selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
      const title = getConversationTitle(conv, t);
      const chatKind = getChatKind(conv.chatId);
      return (
        <button
          key={`${conv.sessionId}:${conv.chatId}`}
          type="button"
          className={`inbox-conversation-item inbox-conversation-item--${chatKind} inbox-conversation-item--stitch ${isActive ? 'active' : ''} ${conv.hasUnread ? 'inbox-conversation-item--unread' : ''}`}
          data-conversation-key={`${conv.sessionId}:${conv.chatId}`}
          tabIndex={isActive ? 0 : -1}
          onClick={() => openThread({ sessionId: conv.sessionId, chatId: conv.chatId })}
          onContextMenu={e => inboxContextMenu.showConversationMenu(e, conv)}
          onTouchStart={e => {
            convLongPressTarget.current = conv;
            convLongPress.onTouchStart(e);
          }}
          onTouchEnd={convLongPress.onTouchEnd}
          onTouchMove={convLongPress.onTouchMove}
          onTouchCancel={convLongPress.onTouchCancel}
          onMouseEnter={() => prefetchThread(conv.sessionId, conv.chatId)}
          onFocus={() => prefetchThread(conv.sessionId, conv.chatId)}
        >
          <InboxContactAvatar
            sessionId={conv.sessionId}
            chatId={conv.chatId}
            chatKind={chatKind}
            title={title}
            profilePicUrl={conv.profilePicUrl}
            sessionStatus={conv.sessionStatus}
            showChatKindIndicator={showChatKindBadges}
            iconFallback={chatKind === 'group'}
            fetchWhenVisible
          />
          <div className="inbox-conversation-item-top">
            <div className="inbox-conversation-item-main">
              {viewMode === 'all' && showSessionLabel && (
                <span
                  className="inbox-session-badge"
                  style={
                    {
                      '--inbox-session-accent': sessionAccentColor(conv.sessionId),
                    } as CSSProperties
                  }
                  title={`${conv.sessionName} (${conv.accountStatus ?? conv.sessionStatus})`}
                >
                  {conv.sessionName}
                  <span className={`inbox-session-badge__dot inbox-session-badge__dot--${conv.accountStatus ?? conv.sessionStatus}`} />
                </span>
              )}
              <InboxStitchListRowStack
                conv={conv}
                title={title}
                isActive={isActive}
                showPinIcon={showPinIcon}
                contactTyping={
                  aiTyping &&
                  selectedThread?.sessionId === conv.sessionId &&
                  selectedThread?.chatId === conv.chatId
                }
              />
            </div>
          </div>
        </button>
      );
    },
    [
      selectedThread?.sessionId,
      selectedThread?.chatId,
      t,
      openThread,
      inboxContextMenu,
      convLongPress,
      prefetchThread,
      viewMode,
      showSessionLabel,
      showChatKindBadges,
      aiTyping,
    ],
  );

  const stitchSuggestionContextKey = useMemo(() => {
    if (!isStitch) return null;
    const lastMessage = displayMessages[displayMessages.length - 1];
    return lastMessage?.id ?? lastMessage?.createdAt ?? selectedConv?.lastMessageAt ?? null;
  }, [isStitch, displayMessages, selectedConv?.lastMessageAt]);

  const stitchLastMessage = useMemo(() => {
    if (!isStitch) return null;
    const list = visibleMessages.length > 0 ? visibleMessages : displayMessages;
    return list[list.length - 1] ?? null;
  }, [isStitch, visibleMessages, displayMessages]);

  const stitchShowAiSuggestions = stitchLastMessage?.direction === 'incoming';

  const scrollStitchMessagesToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!isStitch || !selectedThread) return;
    scrollStitchMessagesToBottom();
  }, [
    isStitch,
    selectedThread?.sessionId,
    selectedThread?.chatId,
    displayMessages,
    visibleMessages,
    stitchShowAiSuggestions,
    scrollStitchMessagesToBottom,
  ]);

  useEffect(() => {
    if (!isStitch) return;
    const stack = stitchComposerStackRef.current;
    if (!stack) return;
    const observer = new ResizeObserver(() => scrollStitchMessagesToBottom());
    observer.observe(stack);
    return () => observer.disconnect();
  }, [
    isStitch,
    selectedThread?.sessionId,
    selectedThread?.chatId,
    scrollStitchMessagesToBottom,
  ]);

  const { panelStyle, resizing, startResize } = useInboxPanelWidths();

  const formatBubbleTime = isKitInbox ? formatInteraktBubbleTime : formatMessageTime;

  const crmInlineVisible =
    showCustomerPanel &&
    !isMobile &&
    (isStitch
      ? containerWidth >= INBOX_WIDTH_STITCH_INLINE
      : isKitInbox
        ? containerWidth >= INBOX_WIDTH_INTERAKT_INLINE
        : !isCompact);

  const crmDrawerMode =
    showCustomerPanel &&
    !crmInlineVisible &&
    (isMobile ||
      isCompact ||
      (isStitch && containerWidth < INBOX_WIDTH_STITCH_INLINE) ||
      (isInterakt && containerWidth < INBOX_WIDTH_INTERAKT_INLINE));

  const crmPanelOpen = crmInlineVisible || (crmDrawerMode && crmDrawerOpen);

  const handleCrmPanelToggle = useCallback(() => {
    if (crmPanelOpen) {
      if (crmDrawerOpen) setCrmDrawerOpen(false);
      if (crmInlineVisible) toggleShowCustomerPanel();
      else setShowCustomerPanel(false);
      return;
    }
    setShowCustomerPanel(true);
    if (crmDrawerMode) setCrmDrawerOpen(true);
  }, [
    crmPanelOpen,
    crmDrawerOpen,
    crmInlineVisible,
    crmDrawerMode,
    setCrmDrawerOpen,
    setShowCustomerPanel,
    toggleShowCustomerPanel,
  ]);

  const wasInteraktRef = useRef(isInterakt);
  useEffect(() => {
    wasInteraktRef.current = isInterakt;
  }, [isInterakt]);

  useEffect(() => {
    if (!isKitInbox) return;
    const normalized = normalizeInboxFilter(activeFilter);
    if (normalized !== activeFilter) setActiveFilter(normalized);
  }, [isKitInbox, activeFilter, setActiveFilter]);

  useEffect(() => {
    const onComposerTab = (event: Event) => {
      const tab = (event as CustomEvent<OpenComposerTabDetail>).detail;
      if (tab === 'followup') {
        setFollowupModalOpen(true);
        return;
      }
      if (tab) setComposerTab(tab);
    };
    window.addEventListener(OPENWA_COMPOSER_TAB_EVENT, onComposerTab);
    return () => window.removeEventListener(OPENWA_COMPOSER_TAB_EVENT, onComposerTab);
  }, []);

  useEffect(() => {
    const onScheduleFollowup = (event: Event) => {
      const detail = (event as CustomEvent<InboxActionThreadDetail>).detail;
      if (!detail) return;
      if (
        !selectedThread ||
        detail.sessionId !== selectedThread.sessionId ||
        detail.chatId !== selectedThread.chatId
      ) {
        openThread(detail);
      }
      setFollowupModalOpen(true);
    };
    window.addEventListener(OPENWA_SCHEDULE_FOLLOWUP_EVENT, onScheduleFollowup);
    return () => window.removeEventListener(OPENWA_SCHEDULE_FOLLOWUP_EVENT, onScheduleFollowup);
  }, [openThread, selectedThread?.sessionId, selectedThread?.chatId]);

  const bodyClassName = [
    'inbox-body',
    isInterakt ? 'inbox-body--interakt' : '',
    isStitch ? 'inbox-body--stitch' : '',
    isCompact ? 'inbox-body--compact' : 'inbox-body--wide',
    isMobile ? 'inbox-body--mobile' : '',
    !crmInlineVisible ? 'inbox-body--no-crm' : '',
    collapseChatList ? 'inbox-body--no-list' : '',
    isMobile && mobilePane === 'list' ? 'show-list' : '',
    isMobile && mobilePane === 'chat' ? 'show-chat' : '',
    resizing ? 'inbox-body--resizing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isGroupThread =
    selectedThread != null &&
    inferConversationType(selectedThread.chatId, selectedConv) === 'group';

  const { participants: groupParticipants } = useGroupParticipants(
    selectedThread?.sessionId,
    selectedThread?.chatId,
    displayMessages,
    threadSession?.status,
    isGroupThread,
  );

  const handleSelectGroupMember = useCallback(
    (memberId: string | null) => {
      setSelectedGroupMember(memberId);
      if (memberId && crmDrawerMode) {
        setCrmDrawerOpen(true);
      }
    },
    [crmDrawerMode, setCrmDrawerOpen, setSelectedGroupMember],
  );

  const resolveGroupSender = useCallback(
    (message: import('../services/api').InboxMessage) => {
      if (!isGroupThread || message.direction !== 'incoming') return undefined;
      const chatId = getGroupMessageSenderId(message);
      if (!chatId) return undefined;
      const enriched = groupParticipants.find(p => p.id === chatId);
      return {
        chatId,
        label:
          enriched?.label ??
          getGroupMessageSenderLabel(message, chatId, t),
        selected: selectedGroupMember === chatId,
      };
    },
    [isGroupThread, groupParticipants, selectedGroupMember, t],
  );

  const resolveMemberHighlight = useCallback(
    (message: import('../services/api').InboxMessage) =>
      resolveGroupMemberMessageHighlight(message, selectedGroupMember, groupMemberMessageFilter),
    [selectedGroupMember, groupMemberMessageFilter],
  );

  const handleGroupMemberContextMenu = useCallback(
    (event: React.MouseEvent, memberId: string) => {
      const member = groupParticipants.find(p => p.id === memberId);
      inboxContextMenu.showGroupMemberMenu(event, memberId, {
        memberPhone: member?.phone ?? null,
        isFiltered: groupMemberMessageFilter && selectedGroupMember === memberId,
        onSelectMember: () => handleSelectGroupMember(memberId),
        onToggleMemberFilter: () => {
          if (groupMemberMessageFilter && selectedGroupMember === memberId) {
            setGroupMemberMessageFilter(false);
            setSelectedGroupMember(null);
          } else {
            setSelectedGroupMember(memberId);
            setGroupMemberMessageFilter(true);
          }
        },
      });
    },
    [
      groupParticipants,
      groupMemberMessageFilter,
      selectedGroupMember,
      handleSelectGroupMember,
      setGroupMemberMessageFilter,
      setSelectedGroupMember,
      inboxContextMenu,
    ],
  );

  const handleComposerContextMenu = useCallback(
    (event: React.MouseEvent) => {
      inboxContextMenu.showComposerMenu(event, {
        hasDraft: Boolean(draft.trim()),
        onAttach: handleAttachImageClick,
        onClearDraft: () => setDraft(''),
        onMessageSearch: () => setMessageSearchOpen(true),
      });
    },
    [draft, handleAttachImageClick, inboxContextMenu, setDraft, setMessageSearchOpen],
  );

  const bindMessageTouchMenu = useCallback(
    (
      message: import('../services/api').InboxMessage,
      options: {
        sessionId: string;
        thread?: { sessionId: string; chatId: string };
        openLightbox?: () => void;
      },
    ) => ({
      onTouchStart: (e: React.TouchEvent) => {
        messageLongPressTarget.current = { message, ...options };
        messageLongPress.onTouchStart(e);
      },
      onTouchEnd: messageLongPress.onTouchEnd,
      onTouchMove: messageLongPress.onTouchMove,
      onTouchCancel: messageLongPress.onTouchCancel,
    }),
    [messageLongPress],
  );

  const handleThreadContextMenu = useCallback(
    (event: React.MouseEvent) => {
      inboxContextMenu.showThreadMenu(event, {
        canLoadOlder,
        onRefresh: handleRefreshChat,
        onLoadOlder: () => setOlderMessageOffset(v => v + INBOX_MESSAGE_PAGE_SIZE),
        onScrollToBottom: () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
        onSearchInChat: () => setMessageSearchOpen(true),
      });
    },
    [
      canLoadOlder,
      handleRefreshChat,
      inboxContextMenu,
      messagesEndRef,
      setMessageSearchOpen,
      setOlderMessageOffset,
    ],
  );

  const renderMessageListItem = useCallback(
    (item: (typeof messageListItems)[number]) => {
      if (item.kind === 'date') {
        return (
          <div
            key={item.key}
            className={[
              'inbox-date-separator',
              isInterakt ? 'inbox-date-separator--interakt' : '',
              isStitch ? 'inbox-date-separator--stitch' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {item.label}
          </div>
        );
      }
      if (item.kind === 'thread_event') {
        return (
          <InboxThreadEventRow
            key={item.key}
            event={item.event}
            formatTime={formatBubbleTime}
            variant={isStitch ? 'stitch' : isInterakt ? 'interakt' : 'classic'}
          />
        );
      }
      if (item.kind === 'album') {
        const groupSender = resolveGroupSender(item.messages[0]);
        return (
          <InboxAlbumMessageBubble
            key={item.key}
            messages={item.messages}
            sessionId={activeSessionId}
            sessionStatus={threadSession?.status}
            formatTime={formatBubbleTime}
            interaktLayout={isInterakt}
            stitchLayout={isStitch}
            contactChatId={selectedThread?.chatId}
            contactTitle={selectedConv ? getConversationTitle(selectedConv, t) : undefined}
            profilePicUrl={selectedConv?.profilePicUrl}
            groupSender={groupSender}
            onGroupSenderClick={handleSelectGroupMember}
            onGroupSenderContextMenu={handleGroupMemberContextMenu}
            memberHighlight={resolveMemberHighlight(item.messages[0])}
            stackCompact={item.stackCompact}
            stackContinues={item.stackContinues}
            onContextMenu={
              selectedThread
                ? e =>
                    inboxContextMenu.showMessageMenu(e, item.messages[item.messages.length - 1], {
                      sessionId: activeSessionId,
                      thread: selectedThread,
                    })
                : undefined
            }
            touchMenuHandlers={
              selectedThread
                ? bindMessageTouchMenu(item.messages[item.messages.length - 1], {
                    sessionId: activeSessionId,
                    thread: selectedThread,
                  })
                : undefined
            }
          />
        );
      }
      const groupSender = resolveGroupSender(item.message);
      return (
        <InboxMessageBubble
          key={item.key}
          message={item.message}
          sessionId={activeSessionId}
          sessionStatus={threadSession?.status}
          formatTime={formatBubbleTime}
          interaktLayout={isInterakt}
          stitchLayout={isStitch}
          contactChatId={selectedThread?.chatId}
          contactTitle={selectedConv ? getConversationTitle(selectedConv, t) : undefined}
          profilePicUrl={selectedConv?.profilePicUrl}
          groupSender={groupSender}
          onGroupSenderClick={handleSelectGroupMember}
          onGroupSenderContextMenu={handleGroupMemberContextMenu}
          memberHighlight={resolveMemberHighlight(item.message)}
          stackCompact={item.stackCompact}
          stackContinues={item.stackContinues}
          touchMenuHandlers={
            selectedThread
              ? bindMessageTouchMenu(item.message, {
                  sessionId: activeSessionId,
                  thread: selectedThread,
                  openLightbox: () => undefined,
                })
              : undefined
          }
          onContextMenu={(e, helpers) =>
            selectedThread
              ? inboxContextMenu.showMessageMenu(e, item.message, {
                  sessionId: activeSessionId,
                  thread: selectedThread,
                  openLightbox: helpers.openLightbox,
                })
              : undefined
          }
        />
      );
    },
    [
      isInterakt,
      resolveGroupSender,
      activeSessionId,
      threadSession?.status,
      formatBubbleTime,
      selectedThread?.chatId,
      selectedConv,
      t,
      handleSelectGroupMember,
      bindMessageTouchMenu,
      handleGroupMemberContextMenu,
      resolveMemberHighlight,
      inboxContextMenu,
      selectedThread,
    ],
  );

  const selectedMemberStats = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember),
    [groupParticipants, selectedGroupMember],
  );

  const selectedMemberLabel = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember)?.label ?? null,
    [groupParticipants, selectedGroupMember],
  );

  const selectedMemberPhone = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember)?.phone ?? null,
    [groupParticipants, selectedGroupMember],
  );

  const personalCrmTarget = useMemo(
    () =>
      selectedThread
        ? resolveGroupPersonalTarget(
            selectedThread.sessionId,
            selectedThread.chatId,
            selectedConv,
            selectedGroupMember,
            selectedMemberLabel,
            groupParticipants,
          )
        : null,
    [selectedThread, selectedConv, selectedGroupMember, selectedMemberLabel, groupParticipants],
  );

  const crmPanel = (hideTitle = false) => (
    <InboxCrmPanelRouter
      allSessions={allSessions}
      onOpenThread={(sessionId, chatId) => openThread({ sessionId, chatId })}
      thread={selectedThread}
      conversation={selectedConv}
      canWrite={canWrite}
      formatTime={formatBubbleTime}
      onCrmUpdated={() => invalidateInbox(selectedThread ?? undefined)}
      onDirtyChange={setCrmDirty}
      onStartSession={handleStartSession}
      addOptimisticMessage={addOptimisticMessage}
      removeOptimisticMessage={removeOptimisticMessage}
      hideTitle={hideTitle}
      interaktLayout={isInterakt || isStitch}
      stitchLayout={isStitch}
      recentMessages={displayMessages}
      interaktActiveTab={isKitInbox ? interaktCrmTab : undefined}
      onInteraktTabChange={isKitInbox ? handleInteraktCrmTabChange : undefined}
      interaktTabsInAside={isKitInbox}
      customerNotesInputRef={isKitInbox ? customerNotesInputRef : undefined}
      onScheduleFollowup={isKitInbox ? openScheduleFollowupModal : undefined}
      selectedGroupMember={selectedGroupMember}
      onSelectGroupMember={handleSelectGroupMember}
      sessionStatus={threadSession?.status}
    />
  );

  const allowPersonalComposerActions = !isGroupThread || Boolean(selectedGroupMember);
  const showComposerQuote =
    channelSupportsAction('whatsapp', 'quote') && allowPersonalComposerActions;
  const showComposerFollowup =
    channelSupportsAction('whatsapp', 'follow_up') && allowPersonalComposerActions;

  const openScheduleFollowupModal = useCallback(() => {
    if (!showComposerFollowup) return;
    setFollowupModalOpen(true);
  }, [showComposerFollowup]);

  const scheduleModalThread = personalCrmTarget ?? selectedThread;
  const scheduleModalConversation = personalCrmTarget?.conversation ?? selectedConv;

  const showInteraktSendAccount =
    activeSendSession != null &&
    !(activeSendSession.status === 'ready' && connectedReadySessionCount === 1);
  const showInteraktComposerMeta = showInteraktSendAccount || isGroupThread;

  useEffect(() => {
    setComposerTab('reply');
  }, [selectedThread?.sessionId, selectedThread?.chatId]);

  return (
    <div
      className={[
        'inbox-page',
        isInterakt ? 'inbox-page--interakt' : '',
        isStitch ? 'inbox-page--stitch' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {!isKitInbox && (
      <div className="inbox-toolbar">
        <div className="inbox-toolbar-row inbox-toolbar-row--title">
          <PageHeader title={t('inbox.title')} subtitle={t('inbox.subtitle')} />
        </div>
        <div className="inbox-toolbar-row inbox-toolbar-row--controls">
          <div className="inbox-view-toggle" role="group" aria-label={t('inbox.session')}>
            <button
              type="button"
              className={viewMode === 'all' ? 'active' : ''}
              onClick={() => {
                if (!confirmLeaveIfDirty()) return;
                setViewMode('all');
                setComposerError(null);
              }}
            >
              {t('inbox.allAccounts')}
            </button>
            <button
              type="button"
              className={viewMode === 'one' ? 'active' : ''}
              onClick={() => {
                if (!confirmLeaveIfDirty()) return;
                setViewMode('one');
                setComposerError(null);
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
                  setComposerError(null);
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
            className={`btn-icon inbox-chat-list-toggle ${showChatList ? 'is-on' : ''}`}
            onClick={toggleShowChatList}
            title={showChatList ? t('inbox.hideChatList') : t('inbox.showChatList')}
            aria-label={showChatList ? t('inbox.hideChatList') : t('inbox.showChatList')}
            aria-pressed={showChatList}
          >
            <MessageSquare size={18} />
          </button>
          <button
            type="button"
            className={`btn-icon inbox-customer-panel-toggle ${showCustomerPanel ? 'is-on' : ''}`}
            onClick={toggleShowCustomerPanel}
            title={showCustomerPanel ? t('inbox.hideCustomerPanel') : t('inbox.showCustomerPanel')}
            aria-label={showCustomerPanel ? t('inbox.hideCustomerPanel') : t('inbox.showCustomerPanel')}
            aria-pressed={showCustomerPanel}
          >
            <User size={18} />
          </button>
          <button
            type="button"
            className="btn-icon inbox-pin-btn"
            onClick={() => {
              if (!selectedThread) return;
              togglePinThread(selectedThread);
            }}
            title={t('inbox.pinnedChat.toggle')}
            aria-label={t('inbox.pinnedChat.toggle')}
            aria-pressed={selectedThread ? isThreadPinned(selectedThread) : false}
            disabled={!selectedThread}
          >
            <MaterialSymbol
              name={selectedThread && isThreadPinned(selectedThread) ? 'keep' : 'keep_off'}
              size={18}
            />
          </button>
          <button
            type="button"
            className={`btn-icon inbox-refresh-btn ${showSyncing ? 'inbox-refresh-btn--active' : ''}`}
            onClick={handleManualRefresh}
            title={t('inbox.refreshHint')}
            aria-label={t('inbox.refresh')}
          >
            <RefreshCw size={18} />
          </button>
          {(showSyncing || anyBackgroundSyncing) && (
            <span
              className="inbox-sync-indicator"
              title={
                anyBackgroundSyncing && !showSyncing
                  ? t('sessions.qr.subline.syncingHint')
                  : t('inbox.refreshHint')
              }
            >
              {anyBackgroundSyncing && !showSyncing
                ? t('sessions.backgroundSyncing')
                : t('inbox.syncingInbox')}
            </span>
          )}
          {wsReconnecting && <span className="inbox-sync-indicator">{t('inbox.reconnecting')}</span>}
          {viewMode === 'one' &&
            selectedSession &&
            !sessionReady &&
            canWrite &&
            !isLinkedSessionRecovering(selectedSession) && (
            <>
              <span className="inbox-hint">{t('inbox.sessionNotReady')}</span>
              <button
                type="button"
                className="inbox-start-btn"
                disabled={
                  sessionStartPending ||
                  (selectedSession.status ? isSessionConnecting(selectedSession.status) : false)
                }
                onClick={() => handleStartSession(sessionId)}
              >
                {sessionStartPending ? <Loader2 className="animate-spin" size={16} /> : null}
                {t('inbox.startSession')}
              </button>
            </>
          )}
          {canSend && <span className="inbox-hint inbox-hint--ok">{t('inbox.connected')}</span>}
        </div>
      </div>
      )}

      <div
        className={bodyClassName}
        style={
          isStitch
            ? ({
                '--inbox-list-w': '18rem',
                '--inbox-crm-w': '380px',
                '--stitch-crm-panel-w': '380px',
              } as CSSProperties)
            : panelStyle
        }
      >
        <aside
          className={[
            'inbox-conversations',
            isInterakt ? 'inbox-conversations--interakt' : '',
            isStitch ? 'inbox-conversations--stitch' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={t('inbox.panelChats')}
        >
          {!isKitInbox && <div className="inbox-panel-kicker">{t('inbox.panelChats')}</div>}
          {isKitInbox ? (
            <>
            <InboxListHeader
              variant={isStitch ? 'stitch' : 'interakt'}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchInputRef={searchInputRef}
              searchPanelOpen={searchPanelOpen}
              setSearchPanelOpen={setSearchPanelOpen}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              hideGroups={hideGroups}
              setHideGroups={setHideGroups}
              listCount={filteredConversations.length}
              totalCount={unifiedTotal}
              leadSourceFilter={leadSourceFilter}
              setLeadSourceFilter={setLeadSourceFilter}
              conversationSort={conversationSort}
              setConversationSort={setConversationSort}
              conversations={conversations}
              viewMode={viewMode}
              sessionId={sessionId}
              sessions={allSessions}
              channelFilter={channelFilter}
              setChannelFilter={setChannelFilter}
              onNewChat={() => dispatchOpenNewChat()}
              filteredUnreadCount={filteredUnreadCount}
              canMarkAllRead={canWrite}
              onMarkAllRead={() => void markAllFilteredRead()}
              onResetFilters={resetInboxFilters}
              savedViews={savedViews}
              onApplySavedView={applySavedView}
              onSaveCurrentView={saveCurrentInboxView}
              onDeleteSavedView={deleteSavedView}
              canSaveView={canWrite}
              onContextMenu={e =>
                inboxContextMenu.showListHeaderMenu(e, {
                  unreadCount: filteredUnreadCount,
                  onRefresh: handleManualRefresh,
                  onMarkAllRead: () => void markAllFilteredRead(),
                  onFocusSearch: () => searchInputRef.current?.focus(),
                })
              }
              onReopenSidebar={
                layoutCtx?.interaktSidebarClosed ? layoutCtx.reopenInteraktSidebar : undefined
              }
              onAccountChange={value => {
                if (!confirmLeaveIfDirty()) return;
                if (value === 'all') {
                  setViewMode('all');
                } else {
                  setViewMode('one');
                  setSessionId(value);
                }
                setComposerError(null);
              }}
              onRefresh={isKitInbox ? handleManualRefresh : undefined}
              refreshing={isKitInbox ? inboxListRefreshing : undefined}
              backgroundSyncing={isStitch ? backgroundSyncing : undefined}
              queueCounts={queueCounts}
              preferClientQueueCounts={preferClientQueueCounts}
            />
            {!isStitch ? (
            <InboxHealthStrip
              conversations={conversations}
              activeSessionId={activeSessionId}
              sessionStatus={selectedConv?.sessionStatus ?? threadSession?.status}
              queueCounts={queueCounts}
            />
            ) : null}
            {largeAccountMode ? (
              <InboxLargeAccountBanner
                threadTotal={threadTotal}
                activeSinceDays={largeAccountActiveSinceDays}
                recentWindowActive={largeAccountRecentWindowActive}
                unifiedView={recommendSingleSession}
                onShowAllHistory={showAllLargeAccountHistory}
                onFocusSearch={() => searchInputRef.current?.focus()}
                onSwitchToSingleAccount={switchToSingleAccount}
              />
            ) : null}
            </>
          ) : (
            <>
              <div
                className="inbox-conversations-header"
                onContextMenu={e =>
                  inboxContextMenu.showListHeaderMenu(e, {
                    unreadCount: filteredUnreadCount,
                    onRefresh: handleManualRefresh,
                    onMarkAllRead: () => void markAllFilteredRead(),
                    onFocusSearch: () => searchInputRef.current?.focus(),
                  })
                }
              >
                <span>{t('inbox.conversations')}</span>
                {totalUnread > 0 && (
                  <span className="inbox-unread-badge inbox-unread-badge--header">
                    {formatUnreadCount(totalUnread)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-icon inbox-new-chat-btn"
                  onClick={() => dispatchOpenNewChat()}
                  title={t('inbox.newChat')}
                  aria-label={t('inbox.newChat')}
                >
                  <MessageSquare size={16} />
                </button>
              </div>
              <InboxHealthStrip
                conversations={conversations}
                activeSessionId={activeSessionId}
                sessionStatus={selectedConv?.sessionStatus ?? threadSession?.status}
                queueCounts={queueCounts}
              />
              {largeAccountMode ? (
                <InboxLargeAccountBanner
                  threadTotal={threadTotal}
                  activeSinceDays={largeAccountActiveSinceDays}
                  recentWindowActive={largeAccountRecentWindowActive}
                  unifiedView={recommendSingleSession}
                  onShowAllHistory={showAllLargeAccountHistory}
                  onFocusSearch={() => searchInputRef.current?.focus()}
                  onSwitchToSingleAccount={switchToSingleAccount}
                />
              ) : null}
              <div className="inbox-list-toolbar">
                <div className="inbox-search-wrap">
                  <Search size={16} className="inbox-search-icon" aria-hidden />
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="inbox-search-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('inbox.searchPlaceholder')}
                    aria-label={t('inbox.searchPlaceholder')}
                    title={t('inbox.searchShortcutTitle', { mod: modKey })}
                  />
                </div>
                <div className="inbox-filter-chips inbox-filter-chips--with-type" role="tablist" aria-label={t('inbox.filters')}>
                  <ChatTypeFilter
                    active={activeChatTypeFilter}
                    onChange={setActiveChatTypeFilter}
                  />
                  {INBOX_ALL_FILTERS.map(key => {
                    const badgeCount = resolveInboxFilterBadgeCount(
                      key,
                      conversations,
                      searchQuery,
                      badgeCountOptions,
                    );
                    const showBadge =
                      badgeCount > 0 &&
                      (key === 'needs_human' ||
                        key === 'unread' ||
                        key === 'ai_opt_out' ||
                        key === 'needs_reply' ||
                        key === 'assigned_to_me' ||
                        key === 'overdue');
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={activeFilter === key}
                        className={`inbox-filter-chip ${activeFilter === key ? 'active' : ''}`}
                        onClick={() => setActiveFilter(key)}
                      >
                        {getInboxFilterLabel(key, t)}
                        {showBadge && (
                          <span className="inbox-filter-chip__count" aria-label={String(badgeCount)}>
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <label className="inbox-source-filter">
                  <span className="inbox-source-filter__label">{t('leadSources.inboxFilter')}</span>
                  <select
                    value={leadSourceFilter}
                    onChange={e => setLeadSourceFilter(e.target.value)}
                    aria-label={t('leadSources.inboxFilter')}
                  >
                    <option value="">{t('pipeline.allSources')}</option>
                    {LEAD_SOURCES.map(src => (
                      <option key={src} value={src}>{leadSourceLabel(src, t)}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`inbox-sort-toggle${conversationSort === 'newest' ? ' is-active' : ''}`}
                  onClick={() => setConversationSort(conversationSort === 'newest' ? 'oldest' : 'newest')}
                  title={conversationSort === 'newest' ? t('inbox.interakt.listNewest') : t('inbox.interakt.listOldest')}
                >
                  {conversationSort === 'newest' ? t('inbox.interakt.listNewest') : t('inbox.interakt.listOldest')}
                  <ChevronDown size={12} aria-hidden />
                </button>
              </div>
            </>
          )}

          <div ref={conversationListRef} className="inbox-conversation-list">
            {viewMode === 'one' && selectedSession && !sessionReady && (
              <InboxActiveSendAccount
                session={selectedSession}
                connectedReadyCount={connectedReadySessionCount}
                onReconnect={handleStartSession}
                className="inbox-send-account--list"
              />
            )}
            {showConversationsLoader && (
              <div className="inbox-state-banner">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!showConversationsLoader && conversations.length === 0 && (
              <div
                className={`inbox-empty-state inbox-empty-state--compact${
                  isStitch
                    ? ' inbox-stitch-empty inbox-stitch-empty--list'
                    : isKitInbox
                      ? ' inbox-interakt-empty'
                      : ''
                }`}
              >
                {isStitch ? (
                  <div className="inbox-stitch-empty__icon" aria-hidden>
                    <MaterialSymbol name="mail" size={28} />
                  </div>
                ) : isKitInbox ? (
                  <Inbox size={28} strokeWidth={1.5} aria-hidden />
                ) : null}
                <p
                  className={
                    isStitch
                      ? 'inbox-stitch-empty__title'
                      : isKitInbox
                        ? 'inbox-interakt-empty__title'
                        : undefined
                  }
                >
                  {syncingChatsEmpty
                    ? t('sessions.qr.subline.syncing')
                    : anySessionReady
                      ? t('inbox.noConversations')
                      : t('inbox.noConversationsOffline')}
                </p>
                {isStitch && anySessionReady && !syncingChatsEmpty ? (
                  <p className="inbox-stitch-empty__desc">{t('inbox.stitch.emptyListDesc')}</p>
                ) : null}
                {isKitInbox && syncingChatsEmpty && (
                  <p className="inbox-interakt-empty__desc">{t('sessions.qr.subline.syncingHint')}</p>
                )}
                {isKitInbox && anySessionReady && !syncingChatsEmpty && !isStitch && (
                  <p className="inbox-interakt-empty__desc">{t('inbox.interakt.emptyListHint')}</p>
                )}
              </div>
            )}
            {!showConversationsLoader && conversations.length > 0 && filteredConversations.length === 0 && (
              <div
                className={`inbox-empty-state inbox-empty-state--compact${
                  isStitch
                    ? ' inbox-stitch-empty inbox-stitch-empty--list'
                    : isKitInbox
                      ? ' inbox-interakt-empty'
                      : ''
                }`}
              >
                {isStitch ? (
                  <div className="inbox-stitch-empty__icon" aria-hidden>
                    <MaterialSymbol name="search" size={24} />
                  </div>
                ) : isKitInbox ? (
                  <MaterialSymbol name="search" size={24} />
                ) : null}
                <p
                  className={
                    isStitch
                      ? 'inbox-stitch-empty__title'
                      : isKitInbox
                        ? 'inbox-interakt-empty__title'
                        : undefined
                  }
                >
                  {t('inbox.noFilterResults')}
                </p>
                {isStitch ? (
                  <p className="inbox-stitch-empty__desc">{t('inbox.stitch.emptyFilterDesc')}</p>
                ) : isKitInbox ? (
                  <p className="inbox-interakt-empty__desc">{t('inbox.interakt.emptyFilterHint')}</p>
                ) : null}
              </div>
            )}
            {isStitch && stitchListSections ? (
              <InboxStitchConversationList
                pinned={stitchListSections.pinned}
                recent={stitchListSections.recent}
                pinnedLabel={t('inbox.stitch.listPinned')}
                recentLabel={t('inbox.stitch.listRecent')}
                renderRow={renderStitchConversationRow}
              />
            ) : (
            <InboxVirtualConversationList
              items={filteredConversations}
              scrollRootRef={conversationListRef}
              getKey={conv => `${conv.sessionId}:${conv.chatId}`}
              renderItem={conv => {
              const isActive =
                selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
              const title = getConversationTitle(conv, t);
              const chatKind = getChatKind(conv.chatId);
              return (
                <button
                  type="button"
                  className={`inbox-conversation-item inbox-conversation-item--${chatKind} ${isInterakt ? 'inbox-conversation-item--interakt inbox-interakt-conversation-item' : ''} ${isStitch ? 'inbox-conversation-item--stitch' : ''} ${isActive ? 'active' : ''} ${conv.hasUnread ? 'inbox-conversation-item--unread' : ''}`}
                  data-conversation-key={`${conv.sessionId}:${conv.chatId}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => openThread({ sessionId: conv.sessionId, chatId: conv.chatId })}
                  onContextMenu={e => inboxContextMenu.showConversationMenu(e, conv)}
                  onTouchStart={e => {
                    convLongPressTarget.current = conv;
                    convLongPress.onTouchStart(e);
                  }}
                  onTouchEnd={convLongPress.onTouchEnd}
                  onTouchMove={convLongPress.onTouchMove}
                  onTouchCancel={convLongPress.onTouchCancel}
                  onMouseEnter={() => prefetchThread(conv.sessionId, conv.chatId)}
                  onFocus={() => prefetchThread(conv.sessionId, conv.chatId)}
                >
                  <InboxContactAvatar
                    sessionId={conv.sessionId}
                    chatId={conv.chatId}
                    chatKind={chatKind}
                    title={title}
                    profilePicUrl={conv.profilePicUrl}
                    sessionStatus={conv.sessionStatus}
                    showChatKindIndicator={showChatKindBadges}
                    iconFallback={chatKind === 'group'}
                    fetchWhenVisible
                  />
                  <div className="inbox-conversation-item-top">
                    <div className="inbox-conversation-item-main">
                      {viewMode === 'all' && showSessionLabel && (
                        <span
                          className="inbox-session-badge"
                          style={
                            {
                              '--inbox-session-accent': sessionAccentColor(conv.sessionId),
                            } as CSSProperties
                          }
                          title={`${conv.sessionName} (${conv.accountStatus ?? conv.sessionStatus})`}
                        >
                          {conv.sessionName}
                          <span className={`inbox-session-badge__dot inbox-session-badge__dot--${conv.accountStatus ?? conv.sessionStatus}`} />
                        </span>
                      )}
                      {isStitch ? (
                        <InboxStitchListRowStack
                          conv={conv}
                          title={title}
                          isActive={isActive}
                          showPinIcon={isThreadPinned({
                            sessionId: conv.sessionId,
                            chatId: conv.chatId,
                          })}
                          contactTyping={
                            aiTyping &&
                            selectedThread?.sessionId === conv.sessionId &&
                            selectedThread?.chatId === conv.chatId
                          }
                        />
                      ) : interaktV2Shell ? (
                        <div className="inbox-conversation-wa-stack">
                          <div className="inbox-conversation-wa-row inbox-conversation-wa-row--top">
                            <div className="inbox-conversation-name inbox-conversation-name--wa">{title}</div>
                            <span className="inbox-conversation-time inbox-conversation-time--wa">
                              {formatConversationListTime(conv.lastMessageAt, t)}
                            </span>
                          </div>
                          <div className="inbox-conversation-wa-row inbox-conversation-wa-row--bottom">
                            <div className="inbox-conversation-preview-row-wrap">
                              <InboxConversationPreview conv={conv} unread={conv.hasUnread} />
                            </div>
                            {conv.unreadCount > 0 || conv.hasUnread ? (
                              <span
                                className="inbox-unread-badge inbox-unread-badge--wa-list"
                                aria-label={t('inbox.unreadCount', {
                                  count: Math.max(conv.unreadCount ?? 0, 1),
                                })}
                              >
                                {formatUnreadCount(Math.max(conv.unreadCount ?? 0, 1))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                      <div className="inbox-conversation-row-top">
                        <div className="inbox-conversation-name-row">
                          {!isInterakt && (
                            <ConversationTypeBadge chatId={conv.chatId} conversation={conv} />
                          )}
                          <div className="inbox-conversation-name">{title}</div>
                          {!isInterakt && conv.stage && (
                            <span
                              className="inbox-conversation-stage inbox-stage-pill"
                              title={pipelineStageLabelFull(conv.stage, t)}
                            >
                              {pipelineStageLabelShort(conv.stage, t)}
                            </span>
                          )}
                        </div>
                          <span className="inbox-conversation-time">
                            {isInterakt
                              ? formatConversationListTime(conv.lastMessageAt, t)
                              : formatMessageTime(conv.lastMessageAt)}
                          </span>
                      </div>
                      {!isInterakt && !isStitch && (
                        <div className="inbox-conversation-subid">{formatChatIdLabelI18n(conv.chatId, t)}</div>
                      )}
                      {!isStitch ? <InboxConversationPreview conv={conv} unread={conv.hasUnread} /> : null}
                        </>
                      )}
                      {isInterakt && !interaktV2Shell && (
                        <InboxConversationCrmBadges
                          conv={conv}
                          className="inbox-interakt-conversation-chips"
                          listRow
                        />
                      )}
                      {!isInterakt && !isStitch && (
                      <div className="inbox-conversation-chips">
                        <InboxConversationCrmBadges conv={conv} inline />
                        {conv.leadSource && (
                          <LeadSourceBadge source={conv.leadSource} className="lead-source-badge--sm" />
                        )}
                        {conv.aiHandlingState === 'waiting_human' && (
                          <span className="inbox-ai-state-pill">{t('inbox.aiStateWaitingHuman')}</span>
                        )}
                        {conv.aiHandlingState === 'ai_handling' && (
                          <span className="inbox-ai-state-pill inbox-ai-state-pill--active">{t('inbox.aiStateHandling')}</span>
                        )}
                        {conversationStatusChips(conv).filter(chip => chip !== 'group').map(chip => (
                          <StatusChip key={chip} kind={chip} />
                        ))}
                      </div>
                      )}
                    </div>
                    {isInterakt && !interaktV2Shell && conv.hasUnread ? (
                      <span className="inbox-interakt-unread-dot" aria-label={t('inbox.unread')} />
                    ) : null}
                    {!isInterakt && !isStitch && conv.unreadCount > 0 && (
                      <span className="inbox-unread-badge" aria-label={t('inbox.unreadCount', { count: conv.unreadCount })}>
                        {formatUnreadCount(conv.unreadCount)}
                      </span>
                    )}
                  </div>
                </button>
              );
            }}
            />
            )}
            <InboxConversationListInfiniteScroll
              scrollRootRef={conversationListRef}
              enabled={canLoadMoreConversations && conversations.length > 0}
              loading={loadingMoreConversations}
              onLoadMore={loadMoreConversations}
            />
          </div>
          {!isMobile && !collapseChatList ? (
            <InboxPanelResizeHandle
              side="list"
              active={resizing === 'list'}
              onPointerDown={startX => startResize('list', startX)}
            />
          ) : null}
        </aside>

        <section className="inbox-thread" aria-label={t('inbox.panelMessages')}>
          {!isKitInbox && <div className="inbox-panel-kicker inbox-panel-kicker--thread">{t('inbox.panelMessages')}</div>}
          {!selectedThread ? (
            <div className={`inbox-thread-empty${isStitch ? ' inbox-stitch-thread-empty' : isKitInbox ? ' inbox-interakt-thread-empty' : ''}`}>
              <div className={`inbox-empty-state${isStitch ? ' inbox-stitch-empty inbox-stitch-empty--thread' : isKitInbox ? ' inbox-interakt-empty inbox-interakt-empty--thread' : ''}`}>
                {isStitch ? (
                  <div className="inbox-stitch-empty__icon" aria-hidden>
                    <MaterialSymbol name="forum" size={32} />
                  </div>
                ) : isKitInbox ? (
                  <MaterialSymbol name="forum" size={36} />
                ) : null}
                <p className={isStitch ? 'inbox-stitch-empty__title' : isKitInbox ? 'inbox-interakt-empty__title' : 'inbox-empty-state-title'}>
                  {isStitch
                    ? t('inbox.stitch.emptyThreadTitle')
                    : isKitInbox
                      ? t('inbox.interakt.emptyThreadTitle')
                      : t('inbox.selectConversationTitle')}
                </p>
                <p className={isStitch ? 'inbox-stitch-empty__desc' : isKitInbox ? 'inbox-interakt-empty__desc' : 'inbox-empty-state-desc'}>
                  {isStitch
                    ? t('inbox.stitch.emptyThreadDesc')
                    : isKitInbox
                      ? t('inbox.interakt.emptyThreadDesc')
                      : t('inbox.selectConversation')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {isKitInbox ? (
                <InboxChatHeader
                  variant={isStitch ? 'stitch' : 'interakt'}
                  thread={selectedThread}
                  conversation={selectedConv}
                  contactTitle={
                    selectedConv ? getConversationTitle(selectedConv, t) : formatChatIdLabelI18n(selectedThread.chatId, t)
                  }
                  canWrite={canWrite}
                  showBack={isMobile || collapseChatList}
                  onBack={backToList}
                  onCrmUpdated={() => invalidateInbox(selectedThread)}
                  onSendQuote={() => setComposerTab('quote')}
                  onScheduleFollowup={openScheduleFollowupModal}
                  showQuoteAction={showComposerQuote}
                  showFollowupAction={showComposerFollowup}
                  showCrmPanelToggle={Boolean(selectedThread)}
                  crmPanelOpen={crmPanelOpen}
                  onToggleCrmPanel={handleCrmPanelToggle}
                  allSessions={allSessions}
                  onTransferred={(toSessionId, chatId) => openThread({ sessionId: toSessionId, chatId })}
                  crmTarget={personalCrmTarget ?? undefined}
                  showResolveAction={!isGroupThread || Boolean(selectedGroupMember)}
                  selectedGroupMemberLabel={selectedMemberLabel}
                  onRefreshChat={handleRefreshChat}
                  refreshingChat={chatRefreshing}
                  isPinned={isThreadPinned(selectedThread)}
                  onTogglePin={() => togglePinThread(selectedThread)}
                  {...(isStitch
                    ? { contactTyping: aiTyping, sessionStatus: threadSession?.status }
                    : {})}
                  onContextMenu={
                    selectedConv
                      ? e =>
                          inboxContextMenu.showHeaderMenu(e, selectedConv, {
                            crmPanelOpen,
                            onRefreshChat: handleRefreshChat,
                            onToggleCrmPanel: handleCrmPanelToggle,
                          })
                      : undefined
                  }
                />
              ) : (
              <header
                className="inbox-chat-header"
                onContextMenu={
                  selectedConv
                    ? e =>
                        inboxContextMenu.showHeaderMenu(e, selectedConv, {
                          crmPanelOpen,
                          onRefreshChat: handleRefreshChat,
                          onToggleCrmPanel: handleCrmPanelToggle,
                        })
                    : undefined
                }
              >
                {(isMobile || collapseChatList) && (
                  <button type="button" className="inbox-back-btn" onClick={backToList} aria-label={t('inbox.backToList')}>
                    <ArrowLeft size={20} />
                  </button>
                )}
                <InboxContactAvatar
                  sessionId={selectedThread.sessionId}
                  chatId={selectedThread.chatId}
                  chatKind={getChatKind(selectedThread.chatId)}
                  title={
                    selectedConv
                      ? getConversationTitle(selectedConv)
                      : formatChatIdLabelI18n(selectedThread.chatId, t)
                  }
                  profilePicUrl={selectedConv?.profilePicUrl}
                  sessionStatus={selectedConv?.sessionStatus ?? threadSession?.status}
                />
                <div className="inbox-chat-header-main">
                  {viewMode === 'all' && showSessionLabel && (
                    <span
                      className="inbox-session-badge"
                      style={
                        {
                          '--inbox-session-accent': sessionAccentColor(selectedThread.sessionId),
                        } as CSSProperties
                      }
                      title={selectedThread.sessionId}
                    >
                      {selectedConv?.sessionName ?? threadSession?.name}
                    </span>
                  )}
                  {sessionStatusKey && (
                    <span className={`inbox-session-status inbox-session-status--${sessionStatusKey}`}>
                      {t('inbox.sessionStatusLabel')}: {t(`sessionStatus.${sessionStatusKey}`, { defaultValue: sessionStatusKey })}
                    </span>
                  )}
                  <div className="inbox-chat-header-title">
                    {selectedConv ? getConversationTitle(selectedConv) : formatChatIdLabelI18n(selectedThread.chatId, t)}
                  </div>
                  <div className="inbox-chat-header-subid">{formatChatIdLabelI18n(selectedThread.chatId, t)}</div>
                  <div className="inbox-chat-header-meta">
                    {aiTyping && (
                      <span className="inbox-ai-typing-pill">{t('inbox.aiTyping')}</span>
                    )}
                    {selectedConv &&
                      conversationStatusChips(selectedConv).map(chip => <StatusChip key={chip} kind={chip} />)}
                  </div>
                </div>
                <div className="inbox-chat-header-actions">
                  <button
                    type="button"
                    className={`btn-icon inbox-chat-refresh-btn${fetchingMessages ? ' inbox-refresh-btn--active' : ''}`}
                    onClick={handleRefreshChat}
                    disabled={fetchingMessages}
                    title={t('inbox.refreshChatHint')}
                    aria-label={t('inbox.refreshChat')}
                  >
                    <RefreshCw size={18} className={fetchingMessages ? 'animate-spin' : undefined} />
                  </button>
                  <InboxAssigneeSelect
                    sessionId={personalCrmTarget?.sessionId ?? selectedThread.sessionId}
                    chatId={personalCrmTarget?.chatId ?? selectedThread.chatId}
                    canWrite={canWrite}
                    onAssigned={() => invalidateInbox(selectedThread)}
                    variant="classic"
                  />
                  {(!isGroupThread || selectedGroupMember) && personalCrmTarget && (
                    <InboxResolveChatButton
                      sessionId={personalCrmTarget.sessionId}
                      chatId={personalCrmTarget.chatId}
                      conversation={personalCrmTarget.conversation ?? selectedConv}
                      canWrite={canWrite}
                      onUpdated={() => invalidateInbox(selectedThread)}
                      variant="classic"
                    />
                  )}
                </div>
                {isCompact && showCustomerPanel && (
                  <button
                    type="button"
                    className="inbox-crm-drawer-btn"
                    onClick={() => setCrmDrawerOpen(true)}
                    aria-label={t('inbox.customerDrawer')}
                  >
                    <User size={18} />
                  </button>
                )}
              </header>
              )}

              {isInterakt && selectedThread && (
                <InboxInteraktAiStatusStrip
                  sessionId={selectedThread.sessionId}
                  chatId={selectedThread.chatId}
                  aiTyping={aiTyping}
                  aiSendQueue={aiSendQueue}
                />
              )}

              {isGroupThread && selectedGroupMember && selectedMemberLabel && selectedThread && (
                <InboxGroupMemberContextStrip
                  sessionId={selectedThread.sessionId}
                  groupChatId={selectedThread.chatId}
                  memberId={selectedGroupMember}
                  memberLabel={selectedMemberLabel}
                  messageCount={selectedMemberStats?.messageCount}
                  filterActive={groupMemberMessageFilter}
                  onToggleFilter={() => setGroupMemberMessageFilter(v => !v)}
                  onClear={() => setSelectedGroupMember(null)}
                  onOpenPrivateChat={
                    selectedThread
                      ? () => openThread({ sessionId: selectedThread.sessionId, chatId: selectedGroupMember })
                      : undefined
                  }
                  variant={isKitInbox ? 'interakt' : 'default'}
                />
              )}

              <InboxMessageSearch
                open={messageSearchOpen}
                query={messageSearchQuery}
                onQueryChange={setMessageSearchQuery}
                onClose={() => {
                  setMessageSearchOpen(false);
                  setMessageSearchQuery('');
                  setMessageSearchMatchId(null);
                }}
                messages={visibleMessages}
                activeMatchId={messageSearchMatchId}
                onActiveMatchChange={setMessageSearchMatchId}
              />

              <div
                ref={messagesScrollRef}
                className={[
                  'inbox-messages',
                  isInterakt ? 'inbox-messages--interakt' : '',
                  isStitch ? 'inbox-messages--stitch' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onContextMenu={handleThreadContextMenu}
              >
                {canLoadOlder && (
                  <button
                    type="button"
                    className="inbox-load-older-btn"
                    disabled={loadingOlderMessages}
                    onClick={() => setOlderMessageOffset(v => v + INBOX_MESSAGE_PAGE_SIZE)}
                  >
                    {loadingOlderMessages ? <Loader2 className="animate-spin" size={16} /> : t('inbox.loadOlder')}
                  </button>
                )}
                {showMessagesLoader && (
                  <div className="inbox-state-banner">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                )}
                {!showMessagesLoader && displayMessages.length === 0 && (
                  <div className="inbox-empty-state inbox-empty-state--compact">
                    <p>{t('inbox.noMessages')}</p>
                  </div>
                )}
                {!showMessagesLoader &&
                  displayMessages.length > 0 &&
                  visibleMessages.length === 0 &&
                  groupMemberMessageFilter && (
                    <div className="inbox-empty-state inbox-empty-state--compact">
                      <p>{t('inbox.groupCrm.filterMemberEmpty')}</p>
                    </div>
                  )}
                {messageListItems.length > 0 && (
                  <InboxVirtualMessageList
                    items={messageListItems}
                    scrollRootRef={messagesScrollRef}
                    getKey={item => item.key}
                    renderItem={item => renderMessageListItem(item)}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                className={[
                  'inbox-composer-wrap',
                  isInterakt ? 'inbox-composer-wrap--interakt' : '',
                  isStitch ? 'inbox-composer-wrap--stitch' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {!isKitInbox && (
                  <InboxActiveSendAccount
                    session={activeSendSession}
                    connectedReadyCount={connectedReadySessionCount}
                    onReconnect={handleStartSession}
                  />
                )}
                {trainingLearnPrompt && selectedThread ? (
                  <InboxAiTrainingLearnStrip
                    prompt={trainingLearnPrompt}
                    onDismiss={dismissTrainingLearnPrompt}
                    variant={isKitInbox ? 'interakt' : 'classic'}
                  />
                ) : null}
                {composerError && (
                  <div className="inbox-composer-error" role="alert">
                    {composerError}
                  </div>
                )}
                {quoteReply ? (
                  <InboxQuoteReplyBar
                    quote={quoteReply}
                    onClear={clearQuoteReply}
                    variant={isKitInbox ? 'interakt' : 'classic'}
                  />
                ) : null}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="inbox-composer-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={e => void handleImageFileChange(e)}
                />
                {isStitch && selectedThread ? (
                  <div className="inbox-stitch-composer-stack" ref={stitchComposerStackRef}>
                    {isGroupThread ? (
                      <InboxGroupComposerNotice
                        selectedGroupMember={selectedGroupMember}
                        selectedGroupMemberLabel={selectedMemberLabel}
                        variant="interakt"
                      />
                    ) : null}
                    <InboxStitchAiSuggestionsPanel
                      thread={selectedThread}
                      conversation={selectedConv}
                      canWrite={canWrite}
                      draft={draft}
                      setDraft={setDraft}
                      composerInputRef={composerInputRef}
                      contextKey={stitchSuggestionContextKey}
                      enabled={stitchShowAiSuggestions}
                    />
                    <InboxComposer
                      variant="stitch"
                      stitchWithAiPanel={stitchShowAiSuggestions && canWrite}
                      thread={selectedThread}
                      conversation={selectedConv}
                      sessionStatus={threadSession?.status}
                      sendSession={activeSendSession}
                      canWrite={canWrite}
                      canSend={canSend}
                      sending={sending}
                      draft={draft}
                      setDraft={setDraft}
                      onSend={() => void handleSend()}
                      composerInputRef={composerInputRef}
                      onComposerKeyDown={handleComposerKeyDown}
                      onAttachClick={handleAttachImageClick}
                      onCrmUpdated={() => invalidateInbox(selectedThread)}
                      onQuoteSent={() => void invalidateInbox()}
                      onStartSession={handleStartSession}
                      addOptimisticMessage={addOptimisticMessage}
                      removeOptimisticMessage={removeOptimisticMessage}
                      activeTab={composerTab}
                      onActiveTabChange={setComposerTab}
                      onOpenScheduleModal={openScheduleFollowupModal}
                      selectedGroupMember={selectedGroupMember}
                      selectedGroupMemberLabel={selectedMemberLabel}
                      selectedGroupMemberPhone={selectedMemberPhone}
                      onComposerContextMenu={handleComposerContextMenu}
                    />
                  </div>
                ) : isInterakt && selectedThread ? (
                  <div className="inbox-interakt-composer-stack">
                  {showInteraktComposerMeta && (
                    <div className="inbox-composer-meta">
                      {showInteraktSendAccount && (
                        <InboxActiveSendAccount
                          session={activeSendSession}
                          connectedReadyCount={connectedReadySessionCount}
                          onReconnect={handleStartSession}
                          variant="interakt"
                        />
                      )}
                      {isGroupThread && (
                        <InboxGroupComposerNotice
                          selectedGroupMember={selectedGroupMember}
                          selectedGroupMemberLabel={selectedMemberLabel}
                          variant="interakt"
                        />
                      )}
                    </div>
                  )}
                  <InboxComposer
                    variant="interakt"
                    thread={selectedThread}
                    conversation={selectedConv}
                    sessionStatus={threadSession?.status}
                    sendSession={activeSendSession}
                    canWrite={canWrite}
                    canSend={canSend}
                    sending={sending}
                    draft={draft}
                    setDraft={setDraft}
                    onSend={() => void handleSend()}
                    composerInputRef={composerInputRef}
                    onComposerKeyDown={handleComposerKeyDown}
                    onAttachClick={handleAttachImageClick}
                    onCrmUpdated={() => invalidateInbox(selectedThread)}
                    onQuoteSent={() => void invalidateInbox()}
                    onStartSession={handleStartSession}
                    addOptimisticMessage={addOptimisticMessage}
                    removeOptimisticMessage={removeOptimisticMessage}
                    activeTab={composerTab}
                    onActiveTabChange={setComposerTab}
                    onOpenScheduleModal={openScheduleFollowupModal}
                    selectedGroupMember={selectedGroupMember}
                    selectedGroupMemberLabel={selectedMemberLabel}
                    selectedGroupMemberPhone={selectedMemberPhone}
                    onComposerContextMenu={handleComposerContextMenu}
                  />
                  </div>
                ) : (
                  <>
                  {isGroupThread && (
                    <InboxGroupComposerNotice
                      selectedGroupMember={selectedGroupMember}
                      selectedGroupMemberLabel={selectedMemberLabel}
                    />
                  )}
                  <form
                    className="inbox-composer inbox-composer--tools"
                    onSubmit={e => {
                      e.preventDefault();
                      void handleSend();
                    }}
                  >
                    {selectedThread && (
                      <InboxComposerTools
                        variant="classic"
                        sessionId={selectedThread.sessionId}
                        chatId={selectedThread.chatId}
                        conversation={selectedConv}
                        sessionStatus={threadSession?.status}
                        canWrite={canWrite}
                        canSend={canSend}
                        sending={sending}
                        onInsertQuickReply={text => setDraft(text)}
                        onAppendComposer={snippet => {
                          const el = composerInputRef.current;
                          if (!el) {
                            setDraft(draft + snippet);
                            return;
                          }
                          const { value, cursor } = insertComposerText(
                            draft,
                            snippet,
                            el.selectionStart,
                            el.selectionEnd,
                          );
                          setDraft(value);
                          requestAnimationFrame(() => {
                            el.focus();
                            el.setSelectionRange(cursor, cursor);
                          });
                        }}
                        onFocusComposer={() => composerInputRef.current?.focus()}
                        onAttachClick={handleAttachImageClick}
                        onQuoteSent={() => void invalidateInbox()}
                        onProductSent={() => void invalidateInbox()}
                        addOptimisticMessage={addOptimisticMessage}
                        removeOptimisticMessage={removeOptimisticMessage}
                        onStartSession={handleStartSession}
                        selectedGroupMember={selectedGroupMember}
                        personalCrmSessionId={personalCrmTarget?.sessionId}
                        personalCrmChatId={personalCrmTarget?.chatId}
                        personalCrmConversation={personalCrmTarget?.conversation ?? selectedConv}
                      />
                    )}
                    <textarea
                      ref={composerInputRef}
                      rows={2}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      onContextMenu={handleComposerContextMenu}
                      placeholder={composerPlaceholder}
                      disabled={!canWrite || sending}
                      aria-label={composerPlaceholder}
                    />
                    <button
                      type="submit"
                      className={canSend ? 'inbox-send-btn' : 'inbox-send-btn inbox-send-btn--disabled'}
                      disabled={!canSend || sending || !draft.trim()}
                      aria-label={t('inbox.placeholder')}
                    >
                      {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </form>
                  </>
                )}
                {!isInterakt && !isStitch && (
                <p className="inbox-composer-hint">
                  {t('inbox.composerHint')}
                  <span className="inbox-composer-hint__shortcuts">
                    {t('inbox.keyboardShortcutsHint', { mod: modKey })}
                  </span>
                </p>
                )}
              </div>
            </>
          )}
        </section>

        {crmInlineVisible && (
          <aside
            className={[
              'inbox-crm-panel',
              isInterakt ? 'inbox-crm-panel--interakt' : '',
              isStitch ? 'inbox-crm-panel--stitch' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={t('inbox.panelCustomer')}
            onContextMenu={
              selectedConv
                ? e => inboxContextMenu.showCrmMenu(e, selectedConv)
                : undefined
            }
            {...crmLongPress}
          >
            {!isMobile && !isStitch ? (
              <InboxPanelResizeHandle
                side="crm"
                active={resizing === 'crm'}
                onPointerDown={startX => startResize('crm', startX)}
              />
            ) : null}
            {isKitInbox && (
              <>
                {isStitch ? (
                  <div className="inbox-stitch-crm-tabs-bar">
                    <div
                      className="inbox-stitch-crm-tabs"
                      role="tablist"
                      aria-label={t('inbox.customerPanel')}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={interaktCrmTab === 'details'}
                        className={`inbox-stitch-crm-tabs__btn${interaktCrmTab === 'details' ? ' is-active' : ''}`}
                        onClick={() => handleInteraktCrmTabChange('details')}
                      >
                        {t('inbox.stitch.tabCustomer')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={interaktCrmTab === 'timeline'}
                        className={`inbox-stitch-crm-tabs__btn${interaktCrmTab === 'timeline' ? ' is-active' : ''}`}
                        onClick={() => handleInteraktCrmTabChange('timeline')}
                      >
                        {t('inbox.interakt.tabActivity')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="inbox-crm-panel-aside-tabs"
                    role="tablist"
                    aria-label={t('inbox.customerPanel')}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={interaktCrmTab === 'details'}
                      className={`inbox-crm-panel-aside-tabs__btn${interaktCrmTab === 'details' ? ' is-active' : ''}`}
                      onClick={() => handleInteraktCrmTabChange('details')}
                    >
                      {t('inbox.interakt.tabCustomer360')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={interaktCrmTab === 'timeline'}
                      className={`inbox-crm-panel-aside-tabs__btn${interaktCrmTab === 'timeline' ? ' is-active' : ''}`}
                      onClick={() => handleInteraktCrmTabChange('timeline')}
                    >
                      {t('inbox.interakt.tabActivity')}
                    </button>
                    <button
                      type="button"
                      className="inbox-crm-panel-aside-tabs__close"
                      onClick={handleCrmPanelToggle}
                      aria-label={t('inbox.hideCustomerPanel')}
                      title={t('inbox.hideCustomerPanel')}
                    >
                      <MaterialSymbol name="right_panel_close" size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
            {crmPanel(true)}
          </aside>
        )}
      </div>

      {crmDrawerMode && crmDrawerOpen && (
        <Portal>
          <div className="inbox-crm-drawer-overlay" onClick={() => setCrmDrawerOpen(false)}>
            <aside
              className={`inbox-crm-drawer${
                isStitch ? ' inbox-crm-drawer--stitch' : isKitInbox ? ' inbox-crm-drawer--interakt' : ''
              }`}
              onClick={e => e.stopPropagation()}
              onContextMenu={
                selectedConv
                  ? e => inboxContextMenu.showCrmMenu(e, selectedConv)
                  : undefined
              }
              {...crmLongPress}
              aria-label={t('inbox.customerPanel')}
            >
              {!isStitch ? (
                <div className="inbox-crm-drawer-header">
                  <h3>{t('inbox.customerPanel')}</h3>
                  <button type="button" className="btn-icon" onClick={() => setCrmDrawerOpen(false)} aria-label={t('inbox.closeDrawer')}>
                    <X size={20} />
                  </button>
                </div>
              ) : null}
              {crmPanel(true)}
            </aside>
          </div>
        </Portal>
      )}
      <InboxKeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {isKitInbox && scheduleModalThread && (
        <InboxInteraktActionModals
          thread={scheduleModalThread}
          conversation={scheduleModalConversation}
          canWrite={canWrite}
          quoteOpen={false}
          followupOpen={followupModalOpen}
          onCloseQuote={() => {}}
          onCloseFollowup={() => setFollowupModalOpen(false)}
          onCrmUpdated={() => invalidateInbox(selectedThread ?? undefined)}
          onQuoteSent={() => void invalidateInbox()}
        />
      )}
      {inboxContextMenu.menu ? (
        <InboxContextMenu state={inboxContextMenu.menu} onClose={inboxContextMenu.closeMenu} />
      ) : null}
    </div>
  );
}
