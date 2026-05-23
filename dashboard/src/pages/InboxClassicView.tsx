import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, RefreshCw, Search, ArrowLeft, User, Users, MessageSquare, X, Paperclip } from 'lucide-react';
import type { Session } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { InboxMessageBubble } from './InboxMessageBubble';
import { InboxCustomerPanel } from './InboxCustomerPanel';
import {
  formatChatIdLabelI18n,
  conversationStatusChips,
  getConversationTitle,
  getChatKind,
  shouldShowChatKindBadge,
  sessionAccentColor,
  type ChatKind,
  formatMessageTime,
} from './inbox-helpers';
import { formatUnreadCount, type InboxController } from './useInboxController';
import { INBOX_MESSAGE_PAGE_SIZE } from '../hooks/queries';
import './Inbox.css';

const FILTER_KEYS = ['all', 'unread', 'needs_reply', 'private', 'groups', 'resolved'] as const;

type StatusChipKind = 'needs_reply' | 'replied' | 'group' | 'resolved' | 'follow_up';

function chatKindIcon(kind: ChatKind) {
  return kind === 'group' ? Users : User;
}

function chatKindLabel(kind: ChatKind, t: ReturnType<typeof useTranslation>['t']): string {
  return kind === 'group' ? t('inbox.chatBadgeGroup') : t('inbox.chatBadgeDirect');
}

function InboxAvatar({ chatKind }: { chatKind: ChatKind }) {
  const Icon = chatKindIcon(chatKind);
  return (
    <span className={`inbox-avatar inbox-avatar--${chatKind}`} aria-hidden>
      <Icon size={chatKind === 'group' ? 18 : 16} strokeWidth={2.25} />
    </span>
  );
}

function StatusChip({ kind }: { kind: StatusChipKind }) {
  const { t } = useTranslation();
  const labels: Record<StatusChipKind, string> = {
    needs_reply: t('inbox.chipNeedsReply'),
    replied: t('inbox.chipReplied'),
    group: t('inbox.chipGroup'),
    resolved: t('inbox.chipResolved'),
    follow_up: t('inbox.chipFollowUp'),
  };
  return <span className={`inbox-status-chip inbox-status-chip--${kind}`}>{labels[kind]}</span>;
}

export function InboxClassicView({ ctrl }: { ctrl: InboxController }) {
  const { t } = useTranslation();
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
    activeFilter,
    setActiveFilter,
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
    setCrmDirty,
    wsReconnecting,
    messagesEndRef,
    selectedSession,
    threadSession,
    sessionReady,
    canSend,
    setComposerError,
    displayMessages,
    canWrite,
    showSyncing,
    showConversationsLoader,
    showMessagesLoader,
    totalUnread,
    conversations,
    filteredConversations,
    activeSessionId,
    messageListItems,
    canLoadOlder,
    fetchingMessages,
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
    composerPlaceholder,
    showThreadDisconnected,
    sessionStatusKey,
    invalidateInbox,
    anySessionReady,
    setOlderMessageOffset,
  } = ctrl;

  const showChatKindBadges = shouldShowChatKindBadge(filteredConversations);

  const bodyClassName = [
    'inbox-body',
    isCompact ? 'inbox-body--compact' : 'inbox-body--wide',
    isMobile ? 'inbox-body--mobile' : '',
    !showCustomerPanel ? 'inbox-body--no-crm' : '',
    collapseChatList ? 'inbox-body--no-list' : '',
    isMobile && mobilePane === 'list' ? 'show-list' : '',
    isMobile && mobilePane === 'chat' ? 'show-chat' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const crmPanel = (hideTitle = false) => (
    <InboxCustomerPanel
      thread={selectedThread}
      conversation={selectedConv}
      canWrite={canWrite}
      formatTime={formatMessageTime}
      onCrmUpdated={() => invalidateInbox(selectedThread ?? undefined)}
      onDirtyChange={setCrmDirty}
      hideTitle={hideTitle}
    />
  );

  return (
    <div className="inbox-page">
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
            className={`btn-icon inbox-refresh-btn ${showSyncing ? 'inbox-refresh-btn--active' : ''}`}
            onClick={handleManualRefresh}
            title={t('inbox.refresh')}
            aria-label={t('inbox.refresh')}
          >
            <RefreshCw size={18} />
          </button>
          {showSyncing && <span className="inbox-sync-indicator">{t('inbox.syncing')}</span>}
          {wsReconnecting && <span className="inbox-sync-indicator">{t('inbox.reconnecting')}</span>}
          {viewMode === 'one' && selectedSession && !sessionReady && canWrite && (
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

      <div className={bodyClassName}>
        <aside className="inbox-conversations" aria-label={t('inbox.panelChats')}>
          <div className="inbox-panel-kicker">{t('inbox.panelChats')}</div>
          <div className="inbox-conversations-header">
            <span>{t('inbox.conversations')}</span>
            {totalUnread > 0 && (
              <span className="inbox-unread-badge inbox-unread-badge--header">
                {formatUnreadCount(totalUnread)}
              </span>
            )}
          </div>

          <div className="inbox-list-toolbar">
            <div className="inbox-search-wrap">
              <Search size={16} className="inbox-search-icon" aria-hidden />
              <input
                type="search"
                className="inbox-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('inbox.searchPlaceholder')}
                aria-label={t('inbox.searchPlaceholder')}
              />
            </div>
            <div className="inbox-filter-chips" role="tablist" aria-label={t('inbox.filters')}>
              {FILTER_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === key}
                  className={`inbox-filter-chip ${activeFilter === key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(key)}
                >
                  {t(`inbox.filter.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="inbox-conversation-list">
            {showConversationsLoader && (
              <div className="inbox-state-banner">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!showConversationsLoader && conversations.length === 0 && (
              <div className="inbox-empty-state inbox-empty-state--compact">
                <p>{anySessionReady ? t('inbox.noConversations') : t('inbox.noConversationsOffline')}</p>
              </div>
            )}
            {!showConversationsLoader && conversations.length > 0 && filteredConversations.length === 0 && (
              <div className="inbox-empty-state inbox-empty-state--compact">
                <p>{t('inbox.noFilterResults')}</p>
              </div>
            )}
            {filteredConversations.map(conv => {
              const isActive =
                selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
              const chips = conversationStatusChips(conv);
              const title = getConversationTitle(conv);
              const chatKind = getChatKind(conv.chatId);
              return (
                <button
                  key={`${conv.sessionId}:${conv.chatId}`}
                  type="button"
                  className={`inbox-conversation-item inbox-conversation-item--${chatKind} ${isActive ? 'active' : ''} ${conv.hasUnread ? 'inbox-conversation-item--unread' : ''}`}
                  onClick={() => openThread({ sessionId: conv.sessionId, chatId: conv.chatId })}
                >
                  <InboxAvatar chatKind={chatKind} />
                  <div className="inbox-conversation-item-top">
                    <div className="inbox-conversation-item-main">
                      {viewMode === 'all' && (
                        <span
                          className="inbox-session-badge"
                          style={
                            {
                              '--inbox-session-accent': sessionAccentColor(conv.sessionId),
                            } as CSSProperties
                          }
                          title={conv.sessionId}
                        >
                          {conv.sessionName}
                        </span>
                      )}
                      <div className="inbox-conversation-row-top">
                        <div className="inbox-conversation-name-row">
                          {showChatKindBadges && (
                            <span className={`inbox-chat-type-badge inbox-chat-type-badge--${chatKind}`}>
                              {chatKindLabel(chatKind, t)}
                            </span>
                          )}
                          <div className="inbox-conversation-name">{title}</div>
                        </div>
                        <span className="inbox-conversation-time">{formatMessageTime(conv.lastMessageAt)}</span>
                      </div>
                      <div className="inbox-conversation-subid">{formatChatIdLabelI18n(conv.chatId, t)}</div>
                      <div className="inbox-conversation-preview">{conv.lastPreview || t('inbox.noPreview')}</div>
                      <div className="inbox-conversation-chips">
                        {chips.filter(chip => chip !== 'group').map(chip => (
                          <StatusChip key={chip} kind={chip} />
                        ))}
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="inbox-unread-badge" aria-label={t('inbox.unreadCount', { count: conv.unreadCount })}>
                        {formatUnreadCount(conv.unreadCount)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="inbox-thread" aria-label={t('inbox.panelMessages')}>
          <div className="inbox-panel-kicker inbox-panel-kicker--thread">{t('inbox.panelMessages')}</div>
          {!selectedThread ? (
            <div className="inbox-thread-empty">
              <div className="inbox-empty-state">
                <p className="inbox-empty-state-title">{t('inbox.selectConversationTitle')}</p>
                <p className="inbox-empty-state-desc">{t('inbox.selectConversation')}</p>
              </div>
            </div>
          ) : (
            <>
              <header className="inbox-chat-header">
                {(isMobile || collapseChatList) && (
                  <button type="button" className="inbox-back-btn" onClick={backToList} aria-label={t('inbox.backToList')}>
                    <ArrowLeft size={20} />
                  </button>
                )}
                <InboxAvatar chatKind={getChatKind(selectedThread.chatId)} />
                <div className="inbox-chat-header-main">
                  {viewMode === 'all' && (
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
                    {selectedConv &&
                      conversationStatusChips(selectedConv).map(chip => <StatusChip key={chip} kind={chip} />)}
                  </div>
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

              {showThreadDisconnected && threadSession && (
                <div className="inbox-disconnected-banner inbox-disconnected-banner--thread" role="status">
                  <p>{t('inbox.disconnectedBannerThread')}</p>
                  <p className="inbox-disconnected-hint">{t('inbox.storedHistoryHint')}</p>
                  <button
                    type="button"
                    className="inbox-start-btn inbox-start-btn--inline"
                    disabled={
                      sessionStartPending ||
                      (threadSession?.status ? isSessionConnecting(threadSession.status) : false)
                    }
                    onClick={() => handleStartSession(selectedThread.sessionId)}
                  >
                    {sessionStartPending ? <Loader2 className="animate-spin" size={14} /> : null}
                    {t('inbox.startSession')} ({threadSession.name})
                  </button>
                </div>
              )}

              <div className="inbox-messages">
                {canLoadOlder && (
                  <button
                    type="button"
                    className="inbox-load-older-btn"
                    disabled={fetchingMessages}
                    onClick={() => setOlderMessageOffset(v => v + INBOX_MESSAGE_PAGE_SIZE)}
                  >
                    {fetchingMessages ? <Loader2 className="animate-spin" size={16} /> : t('inbox.loadOlder')}
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
                {messageListItems.map(item =>
                  item.kind === 'date' ? (
                    <div key={item.key} className="inbox-date-separator">
                      {item.label}
                    </div>
                  ) : (
                    <InboxMessageBubble
                      key={item.key}
                      message={item.message}
                      sessionId={activeSessionId}
                      formatTime={formatMessageTime}
                    />
                  ),
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="inbox-composer-wrap">
                {composerError && (
                  <div className="inbox-composer-error" role="alert">
                    {composerError}
                  </div>
                )}
                {!canSend && canWrite && threadSession && (
                  <button
                    type="button"
                    className="inbox-composer-start-link"
                    onClick={() => handleStartSession(selectedThread.sessionId)}
                  >
                    {t('inbox.startSession')} ({threadSession.name})
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="inbox-composer-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={e => void handleImageFileChange(e)}
                />
                <form
                  className="inbox-composer"
                  onSubmit={e => {
                    e.preventDefault();
                    void handleSend();
                  }}
                >
                  <button
                    type="button"
                    className="inbox-attach-btn"
                    disabled={!canSend || sending}
                    title={t('inbox.attachImage')}
                    aria-label={t('inbox.attachImage')}
                    onClick={handleAttachImageClick}
                  >
                    <Paperclip size={18} />
                  </button>
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
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
                <p className="inbox-composer-hint">{t('inbox.composerHint')}</p>
              </div>
            </>
          )}
        </section>

        {showCustomerPanel && !isCompact && (
          <aside className="inbox-crm-panel" aria-label={t('inbox.panelCustomer')}>
            {crmPanel(true)}
          </aside>
        )}
      </div>

      {showCustomerPanel && isCompact && crmDrawerOpen && (
        <div className="inbox-crm-drawer-overlay" onClick={() => setCrmDrawerOpen(false)}>
          <aside
            className="inbox-crm-drawer"
            onClick={e => e.stopPropagation()}
            aria-label={t('inbox.customerPanel')}
          >
            <div className="inbox-crm-drawer-header">
              <h3>{t('inbox.customerPanel')}</h3>
              <button type="button" className="btn-icon" onClick={() => setCrmDrawerOpen(false)} aria-label={t('inbox.closeDrawer')}>
                <X size={20} />
              </button>
            </div>
            {crmPanel(true)}
          </aside>
        </div>
      )}
    </div>
  );
}
