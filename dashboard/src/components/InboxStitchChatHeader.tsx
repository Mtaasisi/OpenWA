import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxContactAvatar } from './InboxContactAvatar';
import { OPENWA_OPEN_TRANSFER_EVENT, type InboxActionThreadDetail } from '../lib/inbox-events';
import type { Conversation } from '../services/api';
import {
  getInteraktHeaderIdentity,
  isGroupChat,
  shouldShowSessionLabel,
} from '../pages/inbox-helpers';
import { InboxInteraktHeaderPauseAi } from './InboxInteraktHeaderPauseAi';
import { InboxTransferChatModal } from './InboxTransferChatModal';
import type { Session } from '../services/api';

interface Props {
  thread: { sessionId: string; chatId: string };
  conversation: Conversation | undefined;
  contactTitle: string;
  canWrite: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onCrmUpdated: () => void;
  onScheduleFollowup?: () => void;
  showFollowupAction?: boolean;
  onToggleCrmPanel?: () => void;
  crmPanelOpen?: boolean;
  showCrmPanelToggle?: boolean;
  allSessions?: Session[];
  onTransferred?: (toSessionId: string, chatId: string) => void;
  crmTarget?: { sessionId: string; chatId: string; conversation?: Conversation };
  selectedGroupMemberLabel?: string | null;
  onRefreshChat?: () => void;
  refreshingChat?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  contactTyping?: boolean;
  sessionStatus?: string;
}

export function InboxStitchChatHeader({
  thread,
  conversation,
  contactTitle,
  canWrite,
  showBack,
  onBack,
  onCrmUpdated,
  onScheduleFollowup,
  showFollowupAction = true,
  onToggleCrmPanel,
  crmPanelOpen = false,
  showCrmPanelToggle = false,
  allSessions = [],
  onTransferred,
  crmTarget,
  selectedGroupMemberLabel,
  onRefreshChat,
  refreshingChat = false,
  isPinned = false,
  onTogglePin,
  onContextMenu,
  contactTyping = false,
  sessionStatus,
}: Props) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    const onOpenTransfer = (event: Event) => {
      const detail = (event as CustomEvent<InboxActionThreadDetail>).detail;
      if (!detail || detail.sessionId !== thread.sessionId || detail.chatId !== thread.chatId) return;
      setTransferOpen(true);
    };
    window.addEventListener(OPENWA_OPEN_TRANSFER_EVENT, onOpenTransfer);
    return () => window.removeEventListener(OPENWA_OPEN_TRANSFER_EVENT, onOpenTransfer);
  }, [thread.sessionId, thread.chatId]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (target instanceof Element && target.closest('.inbox-stitch-chat-header__more')) return;
      setMobileMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const showSessionLabel = shouldShowSessionLabel(allSessions);
  const identity = conversation
    ? getInteraktHeaderIdentity(conversation, t, { showSessionLabel })
    : { title: contactTitle, subtitle: null as string | null };
  const chatKind = isGroupChat(thread.chatId) ? 'group' : 'private';
  const crmPanelToggleLabel = crmPanelOpen
    ? t('inbox.hideCustomerPanel')
    : t('inbox.stitch.details');

  const subtitle = contactTyping
    ? t('inbox.stitch.writing')
    : chatKind === 'group'
      ? selectedGroupMemberLabel
      : null;

  const closeOverflowMenu = () => setMobileMenuOpen(false);
  const showPauseAi = chatKind !== 'group';
  const showTransfer = canWrite && allSessions.length > 1;
  const hasOverflowMenu =
    showPauseAi ||
    showFollowupAction ||
    !!onTogglePin ||
    (showCrmPanelToggle && !!onToggleCrmPanel) ||
    !!onRefreshChat ||
    showTransfer;

  return (
    <header className="inbox-stitch-chat-header" onContextMenu={onContextMenu}>
      <div className="inbox-stitch-chat-header__left">
        {showBack && onBack ? (
          <button
            type="button"
            className="inbox-stitch-chat-header__back"
            onClick={onBack}
            aria-label={t('inbox.backToList')}
          >
            <MaterialSymbol name="arrow_back" size={20} />
          </button>
        ) : null}
        <InboxContactAvatar
          sessionId={thread.sessionId}
          chatId={thread.chatId}
          chatKind={chatKind}
          title={identity.title}
          profilePicUrl={conversation?.profilePicUrl}
          sessionStatus={sessionStatus ?? conversation?.sessionStatus}
          className="inbox-stitch-chat-header__avatar"
        />
        <div className="inbox-stitch-chat-header__identity">
          <p className="inbox-stitch-chat-header__name">{identity.title}</p>
          {subtitle ? (
            <p
              className={`inbox-stitch-chat-header__subtitle${
                contactTyping ? ' inbox-stitch-chat-header__subtitle--writing' : ''
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="inbox-stitch-chat-header__actions">
        <div className="inbox-stitch-chat-header__inline-actions">
          {showPauseAi ? (
            <InboxInteraktHeaderPauseAi
              sessionId={(crmTarget ?? thread).sessionId}
              chatId={(crmTarget ?? thread).chatId}
              className="inbox-stitch-chat-header__pause"
              iconName="pause_circle"
              iconWeight={400}
            />
          ) : null}
          {showFollowupAction ? (
            <button
              type="button"
              className="inbox-stitch-chat-header__action"
              onClick={() => onScheduleFollowup?.()}
            >
              <MaterialSymbol name="calendar_today" size={20} weight={200} />
              <span>{t('inbox.stitch.schedule')}</span>
            </button>
          ) : null}
          {onTogglePin ? (
            <button
              type="button"
              className={`inbox-stitch-chat-header__action${isPinned ? ' is-active' : ''}`}
              onClick={onTogglePin}
              aria-pressed={isPinned}
              title={t('inbox.pinnedChat.toggle')}
            >
              <MaterialSymbol name="push_pin" size={20} weight={200} filled={isPinned} />
              <span>{t('inbox.stitch.pin')}</span>
            </button>
          ) : null}
          {onRefreshChat ? (
            <button
              type="button"
              className={`inbox-stitch-chat-header__action inbox-stitch-chat-header__action--refresh${
                refreshingChat ? ' is-active' : ''
              }`}
              onClick={onRefreshChat}
              disabled={refreshingChat}
              aria-busy={refreshingChat}
              title={t('inbox.refreshChatHint')}
              aria-label={t('inbox.refreshChat')}
            >
              <MaterialSymbol name="refresh" size={20} weight={200} spin={refreshingChat} />
            </button>
          ) : null}
          {showCrmPanelToggle && onToggleCrmPanel ? (
            <button
              type="button"
              className={`inbox-stitch-chat-header__details${crmPanelOpen ? ' is-open' : ''}`}
              onClick={onToggleCrmPanel}
              aria-pressed={crmPanelOpen}
              aria-label={crmPanelToggleLabel}
              title={crmPanelToggleLabel}
            >
              <MaterialSymbol name="info" size={20} weight={crmPanelOpen ? 400 : 200} filled={crmPanelOpen} />
            </button>
          ) : null}
        </div>

        {hasOverflowMenu ? (
          <>
            <span className="inbox-stitch-chat-header__divider" aria-hidden />

            <button
              type="button"
              className="inbox-stitch-chat-header__more"
              aria-expanded={mobileMenuOpen}
              aria-label={t('inbox.interakt.headerActionsMenu')}
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              <MaterialSymbol name="more_horiz" size={20} weight={200} />
            </button>

            {mobileMenuOpen ? (
              <div className="inbox-stitch-chat-header__overflow-menu" role="menu">
                {showPauseAi ? (
                  <InboxInteraktHeaderPauseAi
                    sessionId={(crmTarget ?? thread).sessionId}
                    chatId={(crmTarget ?? thread).chatId}
                    iconName="pause_circle"
                    iconWeight={400}
                    appearance="menuItem"
                    onMenuSelect={closeOverflowMenu}
                  />
                ) : null}
                {showFollowupAction ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="inbox-stitch-chat-header__mobile-item"
                    onClick={() => {
                      onScheduleFollowup?.();
                      closeOverflowMenu();
                    }}
                  >
                    <MaterialSymbol name="calendar_today" size={18} />
                    {t('inbox.stitch.schedule')}
                  </button>
                ) : null}
                {onTogglePin ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="inbox-stitch-chat-header__mobile-item"
                    onClick={() => {
                      onTogglePin();
                      closeOverflowMenu();
                    }}
                  >
                    <MaterialSymbol name="push_pin" size={18} filled={isPinned} />
                    {t('inbox.stitch.pin')}
                  </button>
                ) : null}
                {showCrmPanelToggle && onToggleCrmPanel ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="inbox-stitch-chat-header__mobile-item"
                    onClick={() => {
                      onToggleCrmPanel();
                      closeOverflowMenu();
                    }}
                  >
                    <MaterialSymbol name="info" size={18} filled={crmPanelOpen} />
                    {t('inbox.stitch.details')}
                  </button>
                ) : null}
                {onRefreshChat ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="inbox-stitch-chat-header__mobile-item"
                    onClick={() => {
                      onRefreshChat();
                      closeOverflowMenu();
                    }}
                    disabled={refreshingChat}
                    aria-busy={refreshingChat}
                  >
                    <MaterialSymbol name="refresh" size={18} spin={refreshingChat} />
                    {t('inbox.refreshChat')}
                  </button>
                ) : null}
                {showTransfer ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="inbox-stitch-chat-header__mobile-item"
                    onClick={() => {
                      setTransferOpen(true);
                      closeOverflowMenu();
                    }}
                  >
                    <MaterialSymbol name="swap_horiz" size={18} />
                    {t('inbox.transfer.button', { defaultValue: 'Transfer' })}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <InboxTransferChatModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        fromSessionId={(crmTarget ?? thread).sessionId}
        chatId={(crmTarget ?? thread).chatId}
        sessions={allSessions}
        onTransferred={(toSessionId, chatId) => {
          onTransferred?.(toSessionId, chatId);
          onCrmUpdated();
        }}
      />
    </header>
  );
}
