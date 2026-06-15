import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { OPENWA_OPEN_TRANSFER_EVENT, type InboxActionThreadDetail } from '../lib/inbox-events';
import type { Conversation } from '../services/api';
import {
  getInteraktContactPhoneLine,
  getInteraktHeaderIdentity,
  isGroupChat,
  shouldShowSessionLabel,
} from '../pages/inbox-helpers';
import { InboxResolveChatButton } from './InboxResolveChatButton';
import { InboxInteraktHeaderPauseAi } from './InboxInteraktHeaderPauseAi';
import { InboxTransferChatModal } from './InboxTransferChatModal';
import type { Session } from '../services/api';

export type InteraktComposerTab = 'reply' | 'notes' | 'followup' | 'quote';

interface Props {
  thread: { sessionId: string; chatId: string };
  conversation: Conversation | undefined;
  contactTitle: string;
  canWrite: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onCrmUpdated: () => void;
  onSendQuote?: () => void;
  onScheduleFollowup?: () => void;
  showQuoteAction?: boolean;
  showFollowupAction?: boolean;
  onToggleCrmPanel?: () => void;
  crmPanelOpen?: boolean;
  showCrmPanelToggle?: boolean;
  /** @deprecated use showCrmPanelToggle + onToggleCrmPanel */
  onOpenCrmPanel?: () => void;
  /** @deprecated use showCrmPanelToggle + onToggleCrmPanel */
  showCrmToggle?: boolean;
  allSessions?: Session[];
  onTransferred?: (toSessionId: string, chatId: string) => void;
  /** CRM target when a group member is selected (resolve, pause AI, transfer). Defaults to thread. */
  crmTarget?: { sessionId: string; chatId: string; conversation?: Conversation };
  showResolveAction?: boolean;
  /** When inspecting a group member, shown in the group header subtitle. */
  selectedGroupMemberLabel?: string | null;
  onRefreshChat?: () => void;
  refreshingChat?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export function InboxInteraktChatHeader({
  thread,
  conversation,
  contactTitle,
  canWrite,
  showBack,
  onBack,
  onCrmUpdated,
  onSendQuote,
  onScheduleFollowup,
  showQuoteAction = true,
  showFollowupAction = true,
  onToggleCrmPanel,
  crmPanelOpen = false,
  showCrmPanelToggle = false,
  onOpenCrmPanel,
  showCrmToggle,
  allSessions = [],
  onTransferred,
  crmTarget,
  showResolveAction = true,
  selectedGroupMemberLabel,
  onRefreshChat,
  refreshingChat = false,
  isPinned = false,
  onTogglePin,
  onContextMenu,
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

  const showSessionLabel = shouldShowSessionLabel(allSessions);
  const identity = conversation
    ? getInteraktHeaderIdentity(conversation, t, { showSessionLabel })
    : { title: contactTitle, subtitle: null as string | null };
  const contactPhone = conversation ? getInteraktContactPhoneLine(conversation) : null;

  const chatKind = isGroupChat(thread.chatId) ? 'group' : 'private';
  const channelLabel = t('inbox.interakt.whatsappChannel');
  const sessionStatusText = conversation
    ? t(`sessionStatus.${conversation.accountStatus ?? conversation.sessionStatus}`, {
        defaultValue: conversation.accountStatus ?? conversation.sessionStatus,
      })
    : null;
  const crmPanelToggleLabel = crmPanelOpen
    ? t('inbox.hideCustomerPanel')
    : t('inbox.groupCrm.showPanel');
  const resolveTarget = crmTarget ?? {
    sessionId: thread.sessionId,
    chatId: thread.chatId,
    conversation,
  };

  return (
    <header className="inbox-interakt-chat-header" onContextMenu={onContextMenu}>
      <div className="inbox-interakt-chat-header__left">
        {showBack && onBack && (
          <button type="button" className="inbox-interakt-chat-header__back inbox-interakt-chat-header__back--mobile" onClick={onBack} aria-label={t('inbox.backToList')}>
            <MaterialSymbol name="arrow_back" size={20} className="inbox-interakt-chat-header__back-icon" />
          </button>
        )}
        <div className="inbox-interakt-chat-header__identity">
          <div className="inbox-interakt-chat-header__name-row">
            <h2 className="inbox-interakt-chat-header__name">{identity.title}</h2>
          </div>
          <p className="inbox-interakt-chat-header__subtitle">
            {chatKind === 'group' ? (
              selectedGroupMemberLabel ? (
                <>
                  <span className="inbox-interakt-chat-header__member-crm">
                    {t('inbox.groupCrm.personalActionsFor', { name: selectedGroupMemberLabel })}
                  </span>
                  {sessionStatusText && (
                    <>
                      {' · '}
                      <span className="inbox-interakt-chat-header__wa-dot" aria-hidden />
                      {sessionStatusText}
                    </>
                  )}
                </>
              ) : sessionStatusText ? (
                <>
                  <span className="inbox-interakt-chat-header__wa-dot" aria-hidden />
                  {sessionStatusText}
                </>
              ) : null
            ) : (
              <>
                <span className="inbox-interakt-chat-header__wa-dot" aria-hidden />
                {contactPhone && (
                  <>
                    <span className="inbox-interakt-chat-header__phone">{contactPhone}</span>
                    {' · '}
                  </>
                )}
                {channelLabel}
                {sessionStatusText && (
                  <>
                    {' · '}
                    {sessionStatusText}
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="inbox-interakt-chat-header__right inbox-interakt-chat-header__actions-row">
        <div className="inbox-interakt-chat-header__primary-actions">
          <InboxInteraktHeaderPauseAi
            sessionId={resolveTarget.sessionId}
            chatId={resolveTarget.chatId}
          />
          {showQuoteAction && (
            <button
              type="button"
              className="inbox-interakt-header-action inbox-interakt-header-action--outline"
              onClick={() => onSendQuote?.()}
            >
              <MaterialSymbol name="attach_money" size={16} />
              <span>{t('inbox.interakt.sendQuote')}</span>
            </button>
          )}
          {showFollowupAction && (
            <button
              type="button"
              className="inbox-interakt-header-action inbox-interakt-header-action--outline"
              onClick={() => onScheduleFollowup?.()}
            >
              <MaterialSymbol name="notifications_active" size={16} />
              <span>{t('inbox.interakt.followupShort')}</span>
            </button>
          )}
          {canWrite && allSessions.length > 1 && (
            <button
              type="button"
              className="inbox-interakt-header-action inbox-interakt-header-action--outline"
              onClick={() => setTransferOpen(true)}
            >
              <MaterialSymbol name="swap_horiz" size={16} />
              <span>{t('inbox.transfer.button', { defaultValue: 'Transfer' })}</span>
            </button>
          )}
        </div>
        {onTogglePin && (
          <button
            type="button"
            className={[
              'inbox-interakt-header-action',
              'inbox-interakt-header-action--outline',
              isPinned ? 'inbox-interakt-chat-header__pin--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onTogglePin}
            aria-pressed={isPinned}
            aria-label={t('inbox.pinnedChat.toggle')}
            title={t('inbox.pinnedChat.toggle')}
          >
            <MaterialSymbol name={isPinned ? 'keep' : 'keep_off'} size={16} />
          </button>
        )}
        {onRefreshChat && (
          <button
            type="button"
            className={[
              'inbox-interakt-header-action',
              'inbox-interakt-header-action--outline',
              'inbox-interakt-chat-header__refresh',
              refreshingChat ? 'inbox-interakt-chat-header__refresh--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onRefreshChat}
            disabled={refreshingChat}
            aria-label={t('inbox.refreshChat')}
            title={t('inbox.refreshChatHint')}
          >
            <MaterialSymbol
              name="refresh"
              size={16}
              className={refreshingChat ? 'inbox-interakt-chat-header__refresh-icon--spin' : undefined}
            />
          </button>
        )}
        <span className="inbox-interakt-chat-header__divider" aria-hidden />
        {showResolveAction && (
          <InboxResolveChatButton
            sessionId={resolveTarget.sessionId}
            chatId={resolveTarget.chatId}
            conversation={resolveTarget.conversation ?? conversation}
            canWrite={canWrite}
            onUpdated={onCrmUpdated}
            variant="interakt"
          />
        )}
        {showCrmPanelToggle && onToggleCrmPanel ? (
          <button
            type="button"
            className={[
              'inbox-interakt-header-action',
              'inbox-interakt-header-action--outline',
              'inbox-interakt-chat-header__crm-toggle',
              crmPanelOpen ? 'inbox-interakt-chat-header__crm-toggle--open' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleCrmPanel}
            aria-pressed={crmPanelOpen}
            aria-label={crmPanelToggleLabel}
            title={crmPanelToggleLabel}
          >
            <MaterialSymbol name={crmPanelOpen ? 'right_panel_close' : 'groups'} size={16} />
          </button>
        ) : showCrmToggle && onOpenCrmPanel ? (
          <button
            type="button"
            className="inbox-interakt-header-action inbox-interakt-header-action--outline inbox-interakt-chat-header__crm-toggle"
            onClick={onOpenCrmPanel}
          >
            <MaterialSymbol name="account_circle" size={16} />
            <span>{t('inbox.interakt.tabCustomer360')}</span>
          </button>
        ) : null}
        <div className="inbox-interakt-chat-header__mobile-menu">
          <button
            type="button"
            className="inbox-interakt-chat-header__mobile-menu-btn"
            aria-expanded={mobileMenuOpen}
            aria-label={t('inbox.interakt.headerActionsMenu')}
            onClick={() => setMobileMenuOpen(v => !v)}
          >
            <MaterialSymbol name="more_horiz" size={22} />
          </button>
          {mobileMenuOpen && (
            <div className="inbox-interakt-chat-header__mobile-menu-panel" role="menu">
              <InboxInteraktHeaderPauseAi
                sessionId={resolveTarget.sessionId}
                chatId={resolveTarget.chatId}
                className="inbox-interakt-header-action--menu"
              />
              {showQuoteAction && (
                <button
                  type="button"
                  role="menuitem"
                  className="inbox-interakt-header-action inbox-interakt-header-action--outline inbox-interakt-header-action--menu"
                  onClick={() => {
                    onSendQuote?.();
                    setMobileMenuOpen(false);
                  }}
                >
                  {t('inbox.interakt.sendQuote')}
                </button>
              )}
              {showFollowupAction && (
                <button
                  type="button"
                  role="menuitem"
                  className="inbox-interakt-header-action inbox-interakt-header-action--outline inbox-interakt-header-action--menu"
                  onClick={() => {
                    onScheduleFollowup?.();
                    setMobileMenuOpen(false);
                  }}
                >
                  {t('inbox.interakt.followupShort')}
                </button>
              )}
              {onRefreshChat && (
                <button
                  type="button"
                  role="menuitem"
                  className="inbox-interakt-header-action inbox-interakt-header-action--outline inbox-interakt-header-action--menu"
                  disabled={refreshingChat}
                  onClick={() => {
                    onRefreshChat();
                    setMobileMenuOpen(false);
                  }}
                >
                  <MaterialSymbol name="refresh" size={16} />
                  {t('inbox.refreshChat')}
                </button>
              )}
              {showResolveAction && (
                <InboxResolveChatButton
                  sessionId={resolveTarget.sessionId}
                  chatId={resolveTarget.chatId}
                  conversation={resolveTarget.conversation ?? conversation}
                  canWrite={canWrite}
                  onUpdated={() => {
                    onCrmUpdated();
                    setMobileMenuOpen(false);
                  }}
                  variant="interakt"
                  menuItem
                />
              )}
              {showCrmPanelToggle && onToggleCrmPanel ? (
                <button
                  type="button"
                  role="menuitem"
                  className={[
                    'inbox-interakt-header-action',
                    'inbox-interakt-header-action--outline',
                    'inbox-interakt-header-action--menu',
                    'inbox-interakt-chat-header__crm-toggle',
                    crmPanelOpen ? 'inbox-interakt-chat-header__crm-toggle--open' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onToggleCrmPanel();
                    setMobileMenuOpen(false);
                  }}
                  aria-pressed={crmPanelOpen}
                >
                  <MaterialSymbol name={crmPanelOpen ? 'right_panel_close' : 'groups'} size={16} />
                  {crmPanelOpen ? t('inbox.hideCustomerPanel') : t('inbox.groupCrm.showPanel')}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <InboxTransferChatModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        fromSessionId={resolveTarget.sessionId}
        chatId={resolveTarget.chatId}
        sessions={allSessions}
        onTransferred={(toSessionId, chatId) => {
          onTransferred?.(toSessionId, chatId);
          onCrmUpdated();
        }}
      />
    </header>
  );
}
