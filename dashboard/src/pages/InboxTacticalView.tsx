import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  WifiOff,
  ArrowLeft,
  User,
  Users,
  MessageSquare,
  X,
  LogOut,
  LayoutDashboard,
  Palette,
} from 'lucide-react';
import { performLogout } from '../lib/logout';
import type { Conversation } from '../services/api';
import {
  avatarInitials,
  conversationStatusChips,
  formatChatIdLabelI18n,
  formatMessageTime,
  getConversationTitle,
  getChatKind,
  shouldShowChatKindBadge,
  sessionAccentColor,
  type ChatKind,
  messageDateKey,
  type ConversationFilter,
} from './inbox-helpers';
import { INBOX_MESSAGE_PAGE_SIZE } from '../hooks/queries';
import { formatUnreadCount, type InboxController } from './useInboxController';
import { InboxTacticalMessageBubble } from './InboxTacticalMessageBubble';
import { InboxTacticalCrmPanel } from './InboxTacticalCrmPanel';
import './InboxTactical.css';

const TAC_FILTERS: ConversationFilter[] = ['all', 'unread', 'needs_reply', 'private', 'groups', 'resolved'];

function tacChatKindIcon(kind: ChatKind) {
  return kind === 'group' ? Users : User;
}

function tacChatKindLabel(kind: ChatKind, t: (k: string) => string): string {
  return kind === 'group' ? t('inbox.chatBadgeGroup') : t('inbox.chatBadgeDirect');
}

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
  if (conv.customerName) chips.push({ key: 'id', label: t('inbox.tactical.chipIdentified'), tone: 'primary' });
  if (conv.lastDirection === 'incoming' && !conv.resolved) {
    chips.push({ key: 'urgent', label: t('inbox.tactical.chipUrgent'), tone: 'warning' });
  }
  return chips;
}

interface Props {
  ctrl: InboxController;
}

export function InboxTacticalView({ ctrl }: Props) {
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
    canSend,
    canWrite,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    filteredConversations,
    conversations,
    showConversationsLoader,
    showMessagesLoader,
    messageListItems,
    canLoadOlder,
    fetchingMessages,
    draft,
    setDraft,
    sending,
    composerError,
    handleSend,
    handleAttachImageClick,
    handleImageFileChange,
    handleComposerKeyDown,
    handleManualRefresh,
    handleStartSession,
    sessionStartPending,
    isSessionConnecting,
    showThreadDisconnected,
    sessionStatusKey,
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
  } = ctrl;

  const showChatKindBadges = shouldShowChatKindBadge(filteredConversations);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toolbarSession =
    viewMode === 'one'
      ? allSessions.find(s => s.id === sessionId)
      : selectedThread
        ? allSessions.find(s => s.id === selectedThread.sessionId)
        : allSessions.find(s => s.status === 'ready') ?? allSessions[0];

  const statusUpper = (sessionStatusKey ?? 'offline').toUpperCase().replace(/_/g, '_');

  const composerPlaceholder = !canWrite
    ? t('inbox.cannotSendNoWrite')
    : !canSend
      ? t('inbox.cannotSendDisconnected')
      : t('inbox.tactical.composerPlaceholder');

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

  const crmPanel = (
    <InboxTacticalCrmPanel
      ctrl={{
        selectedThread,
        selectedConv,
        canWrite,
        setCrmDirty,
        invalidateInbox,
      }}
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
              title={t('inbox.refresh')}
            >
              <RefreshCw size={16} />
            </button>
            {canSend && <span>{t('inbox.tactical.connected')}</span>}
            {canSend && <span className="tac-connected__dot" />}
          </div>
          {viewMode === 'one' && selectedSession && !sessionReady && canWrite && (
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
                    to="/settings?section=appearance"
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
                  title={s.name}
                >
                  <span className="tac-rail__node-inner">{avatarInitials(s.name)}</span>
                  {s.status === 'ready' && <span className="tac-rail__node-dot" />}
                </button>
              );
            })}
            <Link to="/sessions" className="tac-rail__add" title={t('inbox.goToSessions')}>
              <span className="material-symbols-outlined">add</span>
            </Link>
          </nav>
          <Link to="/settings" className="tac-rail__settings" title={t('nav.settings')}>
            <span className="material-symbols-outlined">settings</span>
          </Link>
        </aside>

        <section className="tac-list" aria-label={t('inbox.panelChats')}>
          <div className="tac-panel-kicker">{t('inbox.panelChats')}</div>
          <header className="tac-list__header">
            <div className="tac-search-row">
              <div className="tac-search">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('inbox.tactical.searchPlaceholder')}
                />
              </div>
              {totalUnread > 0 && (
                <div className="tac-list__unread">
                  <span>{formatUnreadCount(totalUnread)}</span>
                </div>
              )}
            </div>
            <div className="tac-filters">
              {TAC_FILTERS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={activeFilter === key ? 'active' : ''}
                  onClick={() => setActiveFilter(key)}
                >
                  {t(`inbox.filter.${key}`)}
                </button>
              ))}
            </div>
          </header>

          <div className="tac-list__scroll scroll-minimal">
            {showConversationsLoader && (
              <div className="tac-loading">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {!showConversationsLoader && conversations.length === 0 && (
              <p className="tac-empty">{anySessionReady ? t('inbox.noConversations') : t('inbox.noConversationsOffline')}</p>
            )}
            {filteredConversations.map(conv => {
              const active =
                selectedThread?.sessionId === conv.sessionId && selectedThread?.chatId === conv.chatId;
              const title = getConversationTitle(conv);
              const chips = tacListChips(conv, t);
              const chatKind = getChatKind(conv.chatId);
              const KindIcon = tacChatKindIcon(chatKind);
              return (
                <button
                  key={`${conv.sessionId}:${conv.chatId}`}
                  type="button"
                  className={`tac-conv tac-conv--${chatKind} ${active ? 'active' : ''}`}
                  onClick={() => openThread({ sessionId: conv.sessionId, chatId: conv.chatId })}
                >
                  <div className="tac-conv__avatar-wrap">
                    <div className={`tac-conv__avatar tac-conv__avatar--${chatKind}`}>
                      <KindIcon size={chatKind === 'group' ? 18 : 16} strokeWidth={2.25} />
                    </div>
                    {viewMode === 'all' && (
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
                        {showChatKindBadges && (
                          <span className={`tac-conv__type tac-conv__type--${chatKind}`}>
                            {tacChatKindLabel(chatKind, t)}
                          </span>
                        )}
                        <h3>{title}</h3>
                      </div>
                      <span className="tac-conv__time">{formatMessageTime(conv.lastMessageAt)}</span>
                    </div>
                    <p className="tac-conv__id">
                      {t('inbox.tactical.chatId', {
                        id: formatChatIdLabelI18n(conv.chatId, t),
                      })}
                    </p>
                    <p className="tac-conv__preview">{conv.lastPreview || t('inbox.noPreview')}</p>
                    <div className="tac-conv__chips">
                      {chips.map(c => (
                        <span key={c.key} className={`tac-conv__chip tac-conv__chip--${c.tone}`}>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
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
              <header className="tac-chat-header">
                <div className="tac-chat-header__left">
                  {(isMobile || collapseChatList) && (
                    <button
                      type="button"
                      className="tac-back-btn"
                      onClick={backToList}
                      aria-label={t('inbox.backToList')}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <div className="tac-chat-header__avatar">
                    {avatarInitials(
                      selectedConv
                        ? getConversationTitle(selectedConv)
                        : formatChatIdLabelI18n(selectedThread.chatId, t),
                    )}
                  </div>
                  <div>
                    <div className="tac-chat-header__title-row">
                      <h2>
                        {selectedConv
                          ? getConversationTitle(selectedConv)
                          : formatChatIdLabelI18n(selectedThread.chatId, t)}
                      </h2>
                      {sessionStatusKey === 'ready' && (
                        <span className="tac-ready-pill">{statusUpper}</span>
                      )}
                    </div>
                    <div className="tac-chat-header__meta">
                      <span>
                        {selectedConv?.sessionName ?? threadSession?.name} //{' '}
                        {formatChatIdLabelI18n(selectedThread.chatId, t)}
                      </span>
                      {selectedConv &&
                        conversationStatusChips(selectedConv).slice(0, 2).map(chip => {
                          const labels: Record<string, string> = {
                            needs_reply: t('inbox.tactical.chipClient'),
                            group: t('inbox.chipGroup'),
                            resolved: t('inbox.chipResolved'),
                            replied: t('inbox.chipReplied'),
                            follow_up: t('inbox.tactical.chipVip'),
                          };
                          return (
                            <span key={chip} className="tac-header-chip">
                              {labels[chip] ?? chip}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                </div>
                <div className="tac-chat-header__actions">
                  {isCompact && showCustomerPanel && (
                    <button
                      type="button"
                      className="tac-icon-frame"
                      aria-label={t('inbox.customerDrawer')}
                      onClick={() => setCrmDrawerOpen(true)}
                    >
                      <User size={18} />
                    </button>
                  )}
                </div>
              </header>

              {showThreadDisconnected && threadSession && canWrite && (
                <div className="tac-disconnected">
                  <p>{t('inbox.disconnectedBannerThread')}</p>
                  <button
                    type="button"
                    className="tac-start-btn"
                    disabled={
                      sessionStartPending ||
                      (threadSession.status ? isSessionConnecting(threadSession.status) : false)
                    }
                    onClick={() => handleStartSession(selectedThread.sessionId)}
                  >
                    {sessionStartPending && <Loader2 className="animate-spin" size={14} />}
                    {t('inbox.startSession')} ({threadSession.name})
                  </button>
                </div>
              )}

              <div className="tac-messages scroll-minimal" id="chat-stage">
                {canLoadOlder && (
                  <button
                    type="button"
                    className="tac-load-older"
                    disabled={fetchingMessages}
                    onClick={() => setOlderMessageOffset(v => v + INBOX_MESSAGE_PAGE_SIZE)}
                  >
                    <span className="material-symbols-outlined">history</span>
                    {fetchingMessages ? (
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
                {messageListItems.map(item => {
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
                  return (
                    <InboxTacticalMessageBubble
                      key={item.key}
                      message={item.message}
                      sessionId={activeSessionId}
                      formatTime={formatMessageTime}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <footer className="tac-composer-footer">
                {composerError && <div className="tac-composer-error">{composerError}</div>}
                {!canSend && canWrite && threadSession && (
                  <button
                    type="button"
                    className="tac-composer-start"
                    onClick={() => handleStartSession(selectedThread.sessionId)}
                  >
                    {t('inbox.startSession')}
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="tac-composer-file-input"
                  tabIndex={-1}
                  aria-hidden
                  onChange={e => void handleImageFileChange(e)}
                />
                <div className="tac-composer-box">
                  <div className="tac-composer-inner">
                    <textarea
                      rows={2}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={composerPlaceholder}
                      disabled={!canWrite || sending}
                    />
                    <div className="tac-composer-bar">
                      <div className="tac-composer-tools">
                        <button
                          type="button"
                          className="tac-tool"
                          disabled={!canSend || sending}
                          title={t('inbox.attachImage')}
                          aria-label={t('inbox.attachImage')}
                          onClick={handleAttachImageClick}
                        >
                          <span className="material-symbols-outlined">attach_file</span>
                        </button>
                        <button type="button" className="tac-tool" disabled title={t('inbox.tactical.terminalSoon')}>
                          <span className="material-symbols-outlined">terminal</span>
                        </button>
                      </div>
                      <div className="tac-composer-send-row">
                        <span>{t('inbox.tactical.enterToSend')}</span>
                        <button
                          type="button"
                          className="tac-send"
                          disabled={!canSend || sending || !draft.trim()}
                          onClick={() => void handleSend()}
                        >
                          {sending ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <span className="material-symbols-outlined">send</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          )}
        </section>

        {showCustomerPanel && !isCompact && crmPanel}
      </div>

      {showCustomerPanel && isCompact && crmDrawerOpen && (
        <div className="tac-crm-drawer-overlay" onClick={() => setCrmDrawerOpen(false)}>
          <aside
            className="tac-crm-drawer"
            onClick={e => e.stopPropagation()}
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
      )}
    </div>
  );
}
