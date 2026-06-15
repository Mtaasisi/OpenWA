import { useMemo, useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  WifiOff,
  User,
  MessageSquare,
  X,
  LogOut,
  LayoutDashboard,
  Palette,
} from 'lucide-react';
import { performLogout } from '../lib/logout';
import { channelsUrl } from '../lib/channel-routes';
import { settingsSectionHref } from '../components/settings/settings-nav-registry';
import type { Conversation } from '../services/api';
import { InboxContactAvatar } from '../components/InboxContactAvatar';
import { InboxConversationPreview } from '../components/InboxConversationPreview';
import { InboxConversationListInfiniteScroll } from '../components/InboxConversationListInfiniteScroll';
import { InboxVirtualConversationList } from '../components/InboxVirtualConversationList';
import { InboxVirtualMessageList } from '../components/InboxVirtualMessageList';
import { InboxThreadEventRow } from '../components/inbox-workspace/InboxThreadEventRow';
import '../components/inbox-workspace/InboxThreadEventRow.css';
import { InboxMessageSearch } from '../components/InboxMessageSearch';
import { dispatchOpenNewChat } from '../lib/inbox-events';
import '../components/inbox-speed.css';
import { InboxActiveSendAccount } from '../components/InboxActiveSendAccount';
import { InboxLargeAccountBanner } from '../components/InboxLargeAccountBanner';
import '../components/InboxLargeAccountBanner.css';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import {
  avatarInitials,
  formatChatIdLabelI18n,
  formatMessageTime,
  getConversationTitle,
  getChatKind,
  shouldShowChatKindBadge,
  sessionAccentColor,
  messageDateKey,
  conversationListCrmBadges,
} from './inbox-helpers';
import { enrichConversationIdentity } from '../lib/inbox-customer-display';
import { INBOX_MESSAGE_PAGE_SIZE } from '../hooks/queries';
import { isLinkedSessionRecovering } from '../lib/linked-session-recovery';
import { formatUnreadCount, type InboxController } from './useInboxController';
import { InboxTacticalMessageBubble } from './InboxTacticalMessageBubble';
import { InboxAlbumMessageBubble } from './InboxAlbumMessageBubble';
import { InboxKeyboardShortcutsDialog } from './InboxKeyboardShortcutsDialog';
import { Portal } from '../components/ModalOverlay';
import { ChatTypeFilter, InboxCrmPanelRouter } from '../components/inbox-crm';
import { InboxGroupMemberContextStrip } from '../components/InboxGroupMemberContextStrip';
import { InboxInteraktActionModals } from '../components/InboxInteraktActionModals';
import { InboxInteraktAiStatusStrip } from '../components/InboxInteraktAiStatusStrip';
import { InboxAiTrainingLearnStrip } from '../components/InboxAiTrainingLearnStrip';
import {
  InboxListHeader,
  InboxChatHeader,
  InboxComposer,
  type InteraktComposerTab,
} from '../components/inbox-workspace';
import { channelSupportsAction } from '../lib/channels';
import {
  OPENWA_COMPOSER_TAB_EVENT,
  OPENWA_SCHEDULE_FOLLOWUP_EVENT,
  type OpenComposerTabDetail,
} from '../lib/inbox-events';
import { inferConversationType } from '../lib/conversation-types';
import { useGroupParticipants } from '../hooks/useGroupParticipants';
import { resolveGroupPersonalTarget } from '../lib/group-action-target';
import {
  getGroupMessageSenderId,
  getGroupMessageSenderLabel,
  resolveGroupMemberMessageHighlight,
} from '../lib/group-participants';
import { useInboxAiTyping } from '../hooks/useInboxAiTyping';
import { useInboxAiSendQueue } from '../hooks/useInboxAiSendQueue';
import { InboxContextMenu } from '../components/InboxContextMenu';
import { InboxQuoteReplyBar } from '../components/InboxQuoteReplyBar';
import { useInboxContextMenu } from '../hooks/useInboxContextMenu';
import { useInboxLongPress } from '../hooks/useInboxLongPress';
import './InboxTactical.css';

function formatTacticalDateLabel(iso: string, t: (k: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const datePart = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayLabel =
    d.toDateString() === now.toDateString()
      ? t('inbox.dateToday').toUpperCase()
      : d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  return `${dayLabel} // ${datePart.replace(/\//g, '.')}`;
}

function tacListChips(conv: Conversation, t: InboxController['t']) {
  const chips: { key: string; label: string; tone: 'primary' | 'warning' | 'secondary' | 'muted' }[] = [];
  const identity = enrichConversationIdentity(conv);
  if (identity.customerName || identity.customerPhone) {
    chips.push({ key: 'id', label: t('inbox.tactical.chipIdentified'), tone: 'primary' });
  }
  if (conv.lastDirection === 'incoming' && !conv.resolved) {
    chips.push({ key: 'urgent', label: t('inbox.tactical.chipUrgent'), tone: 'warning' });
  }
  for (const badge of conversationListCrmBadges(conv, t, { listRow: true })) {
    chips.push({
      key: badge.key,
      label: badge.label,
      tone:
        badge.tone === 'overdue'
          ? 'warning'
          : badge.tone === 'stage'
            ? 'primary'
            : badge.tone === 'priority'
              ? 'warning'
              : 'secondary',
    });
  }
  if (conv.threadTier === 'warm') {
    chips.push({ key: 'warm-tier', label: t('inbox.largeAccount.warmTierChip'), tone: 'muted' });
  }
  return chips;
}

interface Props {
  ctrl: InboxController;
}

export function InboxTacticalView({ ctrl }: Props) {
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const customerNotesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [interaktCrmTab, setInteraktCrmTab] = useState<'details' | 'timeline'>('details');
  const [composerTab, setComposerTab] = useState<InteraktComposerTab>('reply');
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const inboxContextMenu = useInboxContextMenu(ctrl);
  const {
    t,
    allSessions,
    viewMode,
    setViewMode,
    sessionId,
    setSessionId,
    selectedThread,
    selectedConv,
    threadSession,
    activeSendSession,
    connectedReadySessionCount,
    showSessionLabel,
    canSend,
    canWrite,
    searchQuery,
    setSearchQuery,
    prefetchThread,
    messageSearchOpen,
    setMessageSearchOpen,
    messageSearchQuery,
    setMessageSearchQuery,
    messageSearchMatchId,
    setMessageSearchMatchId,
    activeFilter,
    setActiveFilter,
    leadSourceFilter,
    setLeadSourceFilter,
    filteredConversations,
    conversations,
    queueCounts,
    preferClientQueueCounts,
    largeAccountMode,
    largeAccountRecentWindowActive,
    largeAccountActiveSinceDays,
    threadTotal,
    showAllLargeAccountHistory,
    recommendSingleSession,
    switchToSingleAccount,
    loadMoreConversations,
    canLoadMoreConversations,
    loadingMoreConversations,
    showConversationsLoader,
    showMessagesLoader,
    messageListItems,
    canLoadOlder,
    loadingOlderMessages,
    draft,
    setDraft,
    sending,
    composerError,
    handleSend,
    handleAttachImageClick,
    handleImageFileChange,
    handleComposerKeyDown,
    handleManualRefresh,
    handleRefreshChat,
    chatRefreshing,
    handleStartSession,
    sessionStartPending,
    isSessionConnecting,
    wsReconnecting,
    showSyncing,
    totalUnread,
    openThread,
    confirmLeaveIfDirty,
    messagesEndRef,
    imageInputRef,
    activeSessionId,
    setOlderMessageOffset,
    setCrmDirty,
    invalidateInbox,
    selectSessionRail,
    anySessionReady,
    syncingChatsEmpty,
    displayMessages,
    isMobile,
    isCompact,
    showCustomerPanel,
    toggleShowCustomerPanel,
    showChatList,
    toggleShowChatList,
    collapseChatList,
    mobilePane,
    crmDrawerOpen,
    setCrmDrawerOpen,
    backToList,
    sessionReady,
    selectedSession,
    searchInputRef,
    composerInputRef,
    shortcutsOpen,
    setShortcutsOpen,
    addOptimisticMessage,
    removeOptimisticMessage,
    activeChatId,
    conversationSort,
    setConversationSort,
    activeChatTypeFilter,
    setActiveChatTypeFilter,
    selectedGroupMember,
    setSelectedGroupMember,
    groupMemberMessageFilter,
    setGroupMemberMessageFilter,
    visibleMessages,
    filteredUnreadCount,
    markAllFilteredRead,
    quoteReply,
    clearQuoteReply,
    channelFilter,
    setChannelFilter,
    hideGroups,
    setHideGroups,
    resetInboxFilters,
    togglePinThread,
    isThreadPinned,
    savedViews,
    applySavedView,
    saveCurrentInboxView,
    deleteSavedView,
    searchPanelOpen,
    setSearchPanelOpen,
    trainingLearnPrompt,
    dismissTrainingLearnPrompt,
  } = ctrl;

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


  const aiTyping = useInboxAiTyping(activeSessionId || undefined, activeChatId || undefined);
  const aiSendQueue = useInboxAiSendQueue(activeSessionId || undefined, activeChatId || undefined);

  const showChatKindBadges = shouldShowChatKindBadge(filteredConversations);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toolbarSession =
    viewMode === 'one'
      ? allSessions.find(s => s.id === sessionId)
      : selectedThread
        ? allSessions.find(s => s.id === selectedThread.sessionId)
        : allSessions.find(s => s.status === 'ready') ?? allSessions[0];

  const tacRootClass = [
    'tactical-inbox',
    isCompact ? 'tac--compact' : 'tac--wide',
    isMobile ? 'tac--mobile' : '',
    !showCustomerPanel ? 'tac--no-crm' : '',
    collapseChatList ? 'tac--no-list' : '',
    isMobile && mobilePane === 'list' ? 'tac--show-list' : '',
    isMobile && mobilePane === 'chat' ? 'tac--show-chat' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const conversationType = selectedThread
    ? inferConversationType(selectedThread.chatId, selectedConv)
    : null;
  const isGroupThread = conversationType === 'group';

  const allowPersonalComposerActions = !isGroupThread || Boolean(selectedGroupMember);
  const showComposerQuote =
    channelSupportsAction('whatsapp', 'quote') && allowPersonalComposerActions;
  const showComposerFollowup =
    channelSupportsAction('whatsapp', 'follow_up') && allowPersonalComposerActions;

  const openScheduleFollowupModal = useCallback(() => {
    if (!showComposerFollowup) return;
    setFollowupModalOpen(true);
  }, [showComposerFollowup]);

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
    const onScheduleFollowup = () => setFollowupModalOpen(true);
    window.addEventListener(OPENWA_SCHEDULE_FOLLOWUP_EVENT, onScheduleFollowup);
    return () => window.removeEventListener(OPENWA_SCHEDULE_FOLLOWUP_EVENT, onScheduleFollowup);
  }, []);

  const handleSelectGroupMember = useCallback(
    (memberId: string | null) => {
      setSelectedGroupMember(memberId);
      if (memberId && isCompact) {
        setCrmDrawerOpen(true);
      }
    },
    [isCompact, setCrmDrawerOpen, setSelectedGroupMember],
  );

  const { participants: groupParticipants } = useGroupParticipants(
    selectedThread?.sessionId,
    selectedThread?.chatId,
    displayMessages,
    threadSession?.status,
    isGroupThread,
  );

  const selectedMemberLabel = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember)?.label ?? null,
    [groupParticipants, selectedGroupMember],
  );

  const selectedMemberPhone = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember)?.phone ?? null,
    [groupParticipants, selectedGroupMember],
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

  const crmPanelOpen = isCompact ? crmDrawerOpen : showCustomerPanel;

  const handleCrmPanelToggle = useCallback(() => {
    if (isCompact) {
      setCrmDrawerOpen(open => !open);
      return;
    }
    toggleShowCustomerPanel();
  }, [isCompact, setCrmDrawerOpen, toggleShowCustomerPanel]);

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

  const selectedMemberStats = useMemo(
    () => groupParticipants.find(p => p.id === selectedGroupMember),
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
            selectedMemberPhone,
          )
        : null,
    [selectedThread, selectedConv, selectedGroupMember, selectedMemberLabel, groupParticipants, selectedMemberPhone],
  );

  const scheduleModalThread = personalCrmTarget ?? selectedThread;
  const scheduleModalConversation = personalCrmTarget?.conversation ?? selectedConv;

  const crmPanel = (
    <InboxCrmPanelRouter
      allSessions={allSessions}
      onOpenThread={(sessionId, chatId) => openThread({ sessionId, chatId })}
      thread={selectedThread}
      conversation={selectedConv}
      canWrite={canWrite}
      formatTime={formatMessageTime}
      onCrmUpdated={() => invalidateInbox(selectedThread ?? undefined)}
      onDirtyChange={setCrmDirty}
      onStartSession={handleStartSession}
      addOptimisticMessage={addOptimisticMessage}
      removeOptimisticMessage={removeOptimisticMessage}
      hideTitle={false}
      interaktLayout
      recentMessages={displayMessages}
      interaktActiveTab={interaktCrmTab}
      onInteraktTabChange={setInteraktCrmTab}
      interaktTabsInAside
      customerNotesInputRef={customerNotesInputRef}
      onScheduleFollowup={openScheduleFollowupModal}
      selectedGroupMember={selectedGroupMember}
      onSelectGroupMember={handleSelectGroupMember}
      sessionStatus={threadSession?.status}
    />
  );

  return (
    <div className={tacRootClass}>
      <header className="tac-toolbar">
        <div className="tac-toolbar__left">
          <div className="tac-brand">
            <span className="material-symbols-outlined">terminal</span>
            <span className="tac-brand__title">{t('inbox.tactical.brand')}</span>
            {totalUnread > 0 && (
              <span className="tac-brand__badge">{formatUnreadCount(totalUnread)}</span>
            )}
          </div>
          <div className="tac-toolbar__divider" />
          <div className="tac-mode-toggle">
            <button
              type="button"
              className={viewMode === 'all' ? 'active' : ''}
              onClick={() => {
                if (!confirmLeaveIfDirty()) return;
                setViewMode('all');
              }}
            >
              {t('inbox.tactical.allAccounts')}
            </button>
            <button
              type="button"
              className={viewMode === 'one' ? 'active' : ''}
              onClick={() => {
                if (!confirmLeaveIfDirty()) return;
                setViewMode('one');
              }}
            >
              {t('inbox.tactical.singleNode')}
            </button>
          </div>
          <label className="tac-session-pill">
            <span className="tac-session-pill__dot" />
            <select
              className="tac-session-pill__select"
              value={viewMode === 'one' ? sessionId : toolbarSession?.id ?? ''}
              onChange={e => {
                setSessionId(e.target.value);
                setViewMode('one');
              }}
            >
              {allSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {t('inbox.tactical.sessionLabel', { name: s.name })}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="tac-session-pill__chev" aria-hidden />
          </label>
        </div>

        <div className="tac-toolbar__right">
          {wsReconnecting && (
            <div className="tac-ws-status" id="ws-status">
              <span>{t('inbox.reconnecting')}</span>
              <WifiOff size={14} />
            </div>
          )}
          {showSyncing && (
            <div className="tac-sync">
              <span>{t('inbox.syncing')}</span>
              <RefreshCw size={14} className="animate-spin" />
            </div>
          )}
          <div className="tac-connected">
            <button
              type="button"
              className={`tac-icon-btn tac-chat-list-toggle ${showChatList ? 'is-on' : ''}`}
              onClick={toggleShowChatList}
              title={showChatList ? t('inbox.hideChatList') : t('inbox.showChatList')}
              aria-label={showChatList ? t('inbox.hideChatList') : t('inbox.showChatList')}
              aria-pressed={showChatList}
            >
              <MessageSquare size={16} />
            </button>
            <button
              type="button"
              className={`tac-icon-btn tac-customer-panel-toggle ${showCustomerPanel ? 'is-on' : ''}`}
              onClick={toggleShowCustomerPanel}
              title={showCustomerPanel ? t('inbox.hideCustomerPanel') : t('inbox.showCustomerPanel')}
              aria-label={showCustomerPanel ? t('inbox.hideCustomerPanel') : t('inbox.showCustomerPanel')}
              aria-pressed={showCustomerPanel}
            >
              <User size={16} />
            </button>
            <button
              type="button"
              className="tac-icon-btn"
              onClick={handleManualRefresh}
              title={t('inbox.refreshHint')}
              aria-label={t('inbox.refresh')}
            >
              <RefreshCw size={16} />
            </button>
            {canSend && <span>{t('inbox.tactical.connected')}</span>}
            {canSend && <span className="tac-connected__dot" />}
          </div>
          {viewMode === 'one' &&
            selectedSession &&
            !sessionReady &&
            canWrite &&
            !isLinkedSessionRecovering(selectedSession) && (
            <>
              <div className="tac-toolbar__divider" />
              <button
                type="button"
                className="tac-start-btn tac-start-btn--toolbar"
                disabled={
                  sessionStartPending ||
                  (selectedSession.status ? isSessionConnecting(selectedSession.status) : false)
                }
                onClick={() => handleStartSession(sessionId)}
              >
                {sessionStartPending ? <Loader2 className="animate-spin" size={14} /> : null}
                {t('inbox.startSession')}
              </button>
            </>
          )}
          <div className="tac-toolbar__divider" />
          <div className="tac-user-menu">
            <button
              type="button"
              className="tac-user-avatar"
              title={t('common.actions')}
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen(v => !v)}
            >
              {avatarInitials(t('common.appName'))}
            </button>
            {userMenuOpen && (
              <>
                <button
                  type="button"
                  className="tac-user-menu-backdrop"
                  aria-label={t('common.close')}
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="tac-user-menu-panel" role="menu">
                  <Link to="/" className="tac-user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <LayoutDashboard size={16} />
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    to={settingsSectionHref('appearance')}
                    className="tac-user-menu-item"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Palette size={16} />
                    {t('nav.settings')}
                  </Link>
                  <button
                    type="button"
                    className="tac-user-menu-item tac-user-menu-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      performLogout();
                    }}
                  >
                    <LogOut size={16} />
                    {t('common.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="tac-body">
        <aside className="tac-rail">
          <nav className="tac-rail__nav">
            {allSessions.map(s => {
              const active = viewMode === 'one' && sessionId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`tac-rail__node ${active ? 'active' : ''}`}
                  onClick={() => selectSessionRail(s.id)}
                  onContextMenu={e => inboxContextMenu.showSessionMenu(e, s, s.status === 'ready')}
                  title={s.name}
                >
                  <span className="tac-rail__node-inner">{avatarInitials(s.name)}</span>
                  {s.status === 'ready' && <span className="tac-rail__node-dot" />}
                </button>
              );
            })}
            <Link to={channelsUrl({ channel: 'whatsapp', add: true })} className="tac-rail__add" title={t('channels.addChannel')}>
              <span className="material-symbols-outlined">add</span>
            </Link>
          </nav>
          <Link to="/settings" className="tac-rail__settings" title={t('nav.settings')}>
            <span className="material-symbols-outlined">settings</span>
          </Link>
        </aside>

        <section className="tac-list" aria-label={t('inbox.panelChats')}>
          <div className="tac-panel-kicker">{t('inbox.panelChats')}</div>
          <InboxListHeader
            variant="tactical"
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
            totalCount={conversations.length}
            leadSourceFilter={leadSourceFilter}
            setLeadSourceFilter={setLeadSourceFilter}
            conversationSort={conversationSort}
            setConversationSort={setConversationSort}
            viewMode={viewMode}
            sessionId={sessionId}
            sessions={allSessions}
            onAccountChange={value => {
              if (value === 'all') {
                if (!confirmLeaveIfDirty()) return;
                setViewMode('all');
                return;
              }
              if (!confirmLeaveIfDirty()) return;
              setSessionId(value);
              setViewMode('one');
            }}
            conversations={conversations}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            onNewChat={() => dispatchOpenNewChat()}
            filteredUnreadCount={filteredUnreadCount}
            canMarkAllRead={filteredUnreadCount > 0 && canWrite}
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
            queueCounts={queueCounts}
            preferClientQueueCounts={preferClientQueueCounts}
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
          <div className="tac-list__type-filter">
            <ChatTypeFilter
              active={activeChatTypeFilter}
              onChange={setActiveChatTypeFilter}
              variant="tactical"
            />
          </div>

          <div ref={conversationListRef} className="tac-list__scroll scroll-minimal">
            {viewMode === 'one' && selectedSession && !sessionReady && (
              <InboxActiveSendAccount
                session={selectedSession}
                connectedReadyCount={connectedReadySessionCount}
                onReconnect={handleStartSession}
                className="inbox-send-account--list"
              />
            )}
            {showConversationsLoader && (
              <div className="tac-loading">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!showConversationsLoader && conversations.length === 0 && (
              <p className="tac-empty">
                {syncingChatsEmpty
                  ? t('sessions.qr.subline.syncing')
                  : anySessionReady
                    ? t('inbox.noConversations')
                    : t('inbox.noConversationsOffline')}
              </p>
            )}
            <InboxVirtualConversationList
              items={filteredConversations}
              scrollRootRef={conversationListRef}
              estimateSize={108}
              getKey={conv => `${conv.sessionId}:${conv.chatId}`}
              renderItem={conv => {
              const active =
                selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
              const title = getConversationTitle(conv);
              const chips = tacListChips(conv, t);
              const chatKind = getChatKind(conv.chatId);
              return (
                <button
                  type="button"
                  className={`tac-conv tac-conv--${chatKind} ${active ? 'active' : ''}`}
                  data-conversation-key={`${conv.sessionId}:${conv.chatId}`}
                  tabIndex={active ? 0 : -1}
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
                  <div className="tac-conv__avatar-wrap">
                    <InboxContactAvatar
                      sessionId={conv.sessionId}
                      chatId={conv.chatId}
                      chatKind={chatKind}
                      title={title}
                      profilePicUrl={conv.profilePicUrl}
                      sessionStatus={conv.sessionStatus}
                      className={`tac-conv__avatar tac-conv__avatar--${chatKind}`}
                      showChatKindIndicator={showChatKindBadges}
                      iconFallback={chatKind === 'group'}
                      fetchWhenVisible
                    />
                    {viewMode === 'all' && showSessionLabel && (
                      <span
                        className="tac-conv__node-tag"
                        style={
                          {
                            '--inbox-session-accent': sessionAccentColor(conv.sessionId),
                          } as CSSProperties
                        }
                        title={conv.sessionName}
                      >
                        {conv.sessionName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="tac-conv__main">
                    <div className="tac-conv__row">
                      <div className="tac-conv__title-row">
                        <h3>{title}</h3>
                      </div>
                      <span className="tac-conv__time">{formatMessageTime(conv.lastMessageAt)}</span>
                    </div>
                    <p className="tac-conv__id">
                      {t('inbox.tactical.chatId', {
                        id: formatChatIdLabelI18n(conv.chatId, t),
                      })}
                    </p>
                    <InboxConversationPreview conv={conv} className="tac-conv__preview" />
                    <div className="tac-conv__chips">
                      {conv.leadSource && (
                        <LeadSourceBadge source={conv.leadSource} className="lead-source-badge--sm" />
                      )}
                      {chips.map(c => (
                        <span key={c.key} className={`tac-conv__chip tac-conv__chip--${c.tone}`}>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            }}
            />
            <InboxConversationListInfiniteScroll
              scrollRootRef={conversationListRef}
              enabled={canLoadMoreConversations && conversations.length > 0}
              loading={loadingMoreConversations}
              onLoadMore={loadMoreConversations}
            />
          </div>
        </section>

        <section className="tac-thread" aria-label={t('inbox.panelMessages')}>
          <div className="tac-panel-kicker">{t('inbox.panelMessages')}</div>
          <div className="tac-thread__grid" />
          {!selectedThread ? (
            <div className="tac-thread__empty">
              <p>{t('inbox.selectConversationTitle')}</p>
              <p className="tac-thread__empty-sub">{t('inbox.selectConversation')}</p>
            </div>
          ) : (
            <>
              <InboxChatHeader
                variant="tactical"
                thread={selectedThread}
                conversation={selectedConv}
                contactTitle={
                  selectedConv
                    ? getConversationTitle(selectedConv, t)
                    : formatChatIdLabelI18n(selectedThread.chatId, t)
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

              {selectedThread ? (
                <InboxInteraktAiStatusStrip
                  sessionId={selectedThread.sessionId}
                  chatId={selectedThread.chatId}
                  aiTyping={aiTyping}
                  aiSendQueue={aiSendQueue}
                />
              ) : null}

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
                className="tac-messages scroll-minimal"
                id="chat-stage"
                onContextMenu={handleThreadContextMenu}
              >
                {canLoadOlder && (
                  <button
                    type="button"
                    className="tac-load-older"
                    disabled={loadingOlderMessages}
                    onClick={() => setOlderMessageOffset(v => v + INBOX_MESSAGE_PAGE_SIZE)}
                  >
                    <span className="material-symbols-outlined">history</span>
                    {loadingOlderMessages ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      t('inbox.tactical.loadOlder')
                    )}
                  </button>
                )}
                {showMessagesLoader && (
                  <div className="tac-loading">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
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
                    variant="tactical"
                  />
                )}
                {!showMessagesLoader &&
                  displayMessages.length > 0 &&
                  visibleMessages.length === 0 &&
                  groupMemberMessageFilter && (
                    <div className="tac-empty tac-empty--compact">{t('inbox.groupCrm.filterMemberEmpty')}</div>
                  )}
                {messageListItems.length > 0 && (
                  <InboxVirtualMessageList
                    items={messageListItems}
                    scrollRootRef={messagesScrollRef}
                    getKey={item => item.key}
                    renderItem={item => {
                      if (item.kind === 'date') {
                        const dk = item.key.replace(/^date-/, '');
                        const msg = displayMessages.find(m => messageDateKey(m.createdAt) === dk);
                        const label = msg
                          ? formatTacticalDateLabel(msg.createdAt, t)
                          : item.label.toUpperCase();
                        return (
                          <div key={item.key} className="tac-date-sep">
                            <div className="tac-date-sep__line" />
                            <span>{label}</span>
                            <div className="tac-date-sep__line" />
                          </div>
                        );
                      }
                      if (item.kind === 'thread_event') {
                        return (
                          <InboxThreadEventRow
                            key={item.key}
                            event={item.event}
                            formatTime={formatMessageTime}
                            variant="tactical"
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
                            formatTime={formatMessageTime}
                            tactical
                            groupSender={groupSender}
                            onGroupSenderClick={handleSelectGroupMember}
                            onGroupSenderContextMenu={handleGroupMemberContextMenu}
                            memberHighlight={resolveMemberHighlight(item.messages[0])}
                            onContextMenu={
                              selectedThread
                                ? e =>
                                    inboxContextMenu.showMessageMenu(
                                      e,
                                      item.messages[item.messages.length - 1],
                                      {
                                        sessionId: activeSessionId,
                                        thread: selectedThread,
                                      },
                                    )
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
                        <InboxTacticalMessageBubble
                          key={item.key}
                          message={item.message}
                          sessionId={activeSessionId}
                          sessionStatus={threadSession?.status}
                          formatTime={formatMessageTime}
                          groupSender={groupSender}
                          onGroupSenderClick={handleSelectGroupMember}
                          onGroupSenderContextMenu={handleGroupMemberContextMenu}
                          memberHighlight={resolveMemberHighlight(item.message)}
                          touchMenuHandlers={
                            selectedThread
                              ? bindMessageTouchMenu(item.message, {
                                  sessionId: activeSessionId,
                                  thread: selectedThread,
                                })
                              : undefined
                          }
                          onContextMenu={
                            selectedThread
                              ? (e, helpers) =>
                                  inboxContextMenu.showMessageMenu(e, item.message, {
                                    sessionId: activeSessionId,
                                    thread: selectedThread,
                                    openLightbox: helpers.openLightbox,
                                  })
                              : undefined
                          }
                        />
                      );
                    }}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>

              <footer className="tac-composer-footer">
                <InboxActiveSendAccount
                  session={activeSendSession}
                  connectedReadyCount={connectedReadySessionCount}
                  className="tac-send-account"
                  variant="tactical"
                  onReconnect={handleStartSession}
                />
                {trainingLearnPrompt && selectedThread ? (
                  <InboxAiTrainingLearnStrip
                    prompt={trainingLearnPrompt}
                    onDismiss={dismissTrainingLearnPrompt}
                    variant="interakt"
                  />
                ) : null}
                {composerError && <div className="tac-composer-error">{composerError}</div>}
                {quoteReply ? (
                  <InboxQuoteReplyBar quote={quoteReply} onClear={clearQuoteReply} variant="tactical" />
                ) : null}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="tac-composer-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={e => void handleImageFileChange(e)}
                />
                {selectedThread ? (
                  <InboxComposer
                    variant="tactical"
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
                ) : null}
              </footer>
            </>
          )}
        </section>

        {showCustomerPanel && !isCompact ? (
          <div
            className="tac-crm-wrap"
            onContextMenu={selectedConv ? e => inboxContextMenu.showCrmMenu(e, selectedConv) : undefined}
            {...crmLongPress}
          >
            {crmPanel}
          </div>
        ) : null}
      </div>

      {showCustomerPanel && isCompact && crmDrawerOpen && (
        <Portal>
          <div className="tac-crm-drawer-overlay" onClick={() => setCrmDrawerOpen(false)}>
            <aside
              className="tac-crm-drawer"
              onClick={e => e.stopPropagation()}
              onContextMenu={
                selectedConv ? e => inboxContextMenu.showCrmMenu(e, selectedConv) : undefined
              }
              {...crmLongPress}
              aria-label={t('inbox.customerPanel')}
            >
              <header className="tac-crm-drawer__header">
                <span>{t('inbox.customerPanel')}</span>
                <button
                  type="button"
                  className="tac-icon-frame"
                  onClick={() => setCrmDrawerOpen(false)}
                  aria-label={t('inbox.closeDrawer')}
                >
                  <X size={18} />
                </button>
              </header>
              {crmPanel}
            </aside>
          </div>
        </Portal>
      )}
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
      <InboxKeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {inboxContextMenu.menu ? (
        <InboxContextMenu state={inboxContextMenu.menu} onClose={inboxContextMenu.closeMenu} />
      ) : null}
    </div>
  );
}
