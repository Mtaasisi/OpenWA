import { useTranslation } from 'react-i18next';
import { Paperclip } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import type { Conversation, InboxMessage } from '../services/api';
import type { InboxThemeVariant } from '../pages/inbox-features';
import { inferConversationType } from '../lib/conversation-types';
import { InboxQuickRepliesPicker } from './InboxQuickRepliesPicker';
import { InboxFollowupTemplatesPicker } from './InboxFollowupTemplatesPicker';
import { InboxInteraktEmojiPicker } from './InboxInteraktEmojiPicker';
import { InboxQuoteBuilder } from './InboxQuoteBuilder';
import { InboxProductPicker } from './InboxProductPicker';

interface Props {
  variant: InboxThemeVariant;
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
  sessionStatus?: string;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
  onInsertQuickReply: (text: string) => void;
  onAppendComposer: (text: string) => void;
  onFocusComposer: () => void;
  onAttachClick: () => void;
  onQuoteSent: () => void;
  onProductSent?: () => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  onStartSession?: (sessionId: string) => void;
  onNotesClick?: () => void;
  selectedGroupMember?: string | null;
  /** Personal CRM thread when a group member is selected (quotes, follow-ups). */
  personalCrmSessionId?: string;
  personalCrmChatId?: string;
  personalCrmConversation?: Conversation;
  /** Interakt composer tabs: hide duplicate notes/quote toolbar actions */
  tabLayout?: boolean;
  /** Stitch composer keeps attach in the footer bar instead */
  showAttachInToolbar?: boolean;
}

const TOOL_BTN: Record<InboxThemeVariant, string> = {
  interakt: 'inbox-interakt-tool-btn',
  classic: 'inbox-composer-tool-btn',
  tactical: 'tac-composer-tool-btn',
};

function GroupActionButton({
  className,
  symbol,
  label,
  onClick,
  disabled,
}: {
  className: string;
  symbol: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <MaterialSymbol name={symbol} size={20} />
      <span className="inbox-interakt-tool-btn__label">{label}</span>
    </button>
  );
}

export function InboxComposerTools({
  variant,
  sessionId,
  chatId,
  conversation,
  sessionStatus,
  canWrite,
  canSend,
  sending,
  onInsertQuickReply,
  onAppendComposer,
  onFocusComposer,
  onAttachClick,
  onQuoteSent,
  onProductSent,
  addOptimisticMessage,
  removeOptimisticMessage,
  onStartSession,
  onNotesClick,
  selectedGroupMember,
  personalCrmSessionId,
  personalCrmChatId,
  personalCrmConversation,
  tabLayout = false,
  showAttachInToolbar = true,
}: Props) {
  const { t } = useTranslation();
  const btn = TOOL_BTN[variant];
  const pickerVariant = variant === 'tactical' ? 'tactical' : variant === 'interakt' ? 'interakt' : undefined;
  const isGroup = inferConversationType(chatId, conversation) === 'group';
  const allowPersonalActions = !isGroup || Boolean(selectedGroupMember);
  const crmSessionId = personalCrmSessionId ?? sessionId;
  const crmChatId = personalCrmChatId ?? chatId;
  const crmConversation = personalCrmConversation ?? conversation;
  const crmCustomerName =
    crmConversation?.customerName ?? crmConversation?.displayName ?? conversation?.customerName;

  if (variant === 'interakt') {
    const attachButton = (
      <button
        type="button"
        className={btn}
        disabled={!canSend || sending || !canWrite}
        title={t('inbox.attachImage')}
        aria-label={t('inbox.attachImage')}
        onClick={onAttachClick}
      >
        <MaterialSymbol name="image" size={20} />
        <span className="inbox-interakt-tool-btn__label">{t('inbox.attachImage')}</span>
      </button>
    );

    return (
      <div className="inbox-interakt-composer-toolbar inbox-interakt-composer-toolbar--edition">
        <div className="inbox-interakt-composer-toolbar__grid">
          {isGroup ? (
            <>
              <GroupActionButton
                className={btn}
                symbol="send"
                label={t('inbox.groupComposer.postToGroup')}
                disabled={!canWrite}
                onClick={() => onFocusComposer()}
              />
              <GroupActionButton
                className={btn}
                symbol="description"
                label={t('inbox.groupComposer.internalNote')}
                disabled={!canWrite}
                onClick={() => onAppendComposer(`[${t('inbox.groupComposer.internalNote')}] `)}
              />
              <InboxProductPicker
                sessionId={sessionId}
                chatId={chatId}
                sessionStatus={sessionStatus}
                canWrite={canWrite}
                onSent={onProductSent}
                onStartSession={onStartSession}
                addOptimisticMessage={addOptimisticMessage}
                removeOptimisticMessage={removeOptimisticMessage}
                iconTrigger={{ className: btn, symbol: 'storefront' }}
                showToolbarLabel
              />
              <GroupActionButton
                className={btn}
                symbol="campaign"
                label={t('inbox.groupComposer.announcement')}
                disabled={!canWrite}
                onClick={() => onAppendComposer(`[${t('inbox.groupComposer.announcement')}] `)}
              />
              <GroupActionButton
                className={btn}
                symbol="post_add"
                label={t('inbox.groupComposer.campaignPost')}
                disabled={!canWrite}
                onClick={() => onAppendComposer(`[${t('inbox.groupComposer.campaignPost')}] `)}
              />
              {showAttachInToolbar ? attachButton : null}
            </>
          ) : (
            <>
              <InboxProductPicker
                sessionId={sessionId}
                chatId={chatId}
                sessionStatus={sessionStatus}
                canWrite={canWrite}
                onSent={onProductSent}
                onStartSession={onStartSession}
                addOptimisticMessage={addOptimisticMessage}
                removeOptimisticMessage={removeOptimisticMessage}
                iconTrigger={{ className: btn, symbol: 'storefront' }}
                showToolbarLabel
              />
              <InboxQuickRepliesPicker
                sessionId={sessionId}
                chatId={chatId}
                conversation={conversation}
                canWrite={canWrite}
                onInsert={onInsertQuickReply}
                onFocusComposer={onFocusComposer}
                buttonClassName={btn}
                triggerIcon="zap"
                panelTitle={t('quickReplies.title')}
                variant="interakt"
                showToolbarLabel
              />
              <InboxFollowupTemplatesPicker
                sessionId={sessionId}
                chatId={chatId}
                conversation={conversation}
                canWrite={canWrite}
                onInsert={onInsertQuickReply}
                onFocusComposer={onFocusComposer}
                buttonClassName={btn}
                showToolbarLabel
              />
              {showAttachInToolbar ? attachButton : null}
              {allowPersonalActions && !tabLayout && (
                <InboxQuoteBuilder
                  sessionId={sessionId}
                  chatId={chatId}
                  customerName={conversation?.customerName}
                  canWrite={canWrite}
                  onSent={onQuoteSent}
                  buttonClassName={btn}
                  triggerIcon="dollar"
                  variant="interakt"
                  showToolbarLabel
                />
              )}
              {!tabLayout && (
                <button
                  type="button"
                  className={btn}
                  title={t('inbox.interakt.customerNotes')}
                  aria-label={t('inbox.interakt.customerNotes')}
                  onClick={onNotesClick}
                >
                  <MaterialSymbol name="description" size={20} />
                  <span className="inbox-interakt-tool-btn__label">{t('inbox.interakt.customerNotes')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const wrapClass =
    variant === 'tactical' ? 'tac-composer-tools' : 'inbox-composer-tools';

  return (
    <div className={wrapClass}>
      {isGroup ? (
        <>
          <GroupActionButton
            className={btn}
            symbol="send"
            label={t('inbox.groupComposer.postToGroup')}
            disabled={!canWrite}
            onClick={() => onFocusComposer()}
          />
          <InboxProductPicker
            sessionId={sessionId}
            chatId={chatId}
            sessionStatus={sessionStatus}
            canWrite={canWrite}
            onSent={onProductSent}
            onStartSession={onStartSession}
            addOptimisticMessage={addOptimisticMessage}
            removeOptimisticMessage={removeOptimisticMessage}
            iconTrigger={{ className: btn }}
          />
          {allowPersonalActions && (
            <>
              <InboxQuoteBuilder
                sessionId={crmSessionId}
                chatId={crmChatId}
                customerName={crmCustomerName}
                canWrite={canWrite}
                onSent={onQuoteSent}
                buttonClassName={btn}
                variant={pickerVariant}
              />
              <InboxQuickRepliesPicker
                sessionId={crmSessionId}
                chatId={crmChatId}
                conversation={crmConversation}
                canWrite={canWrite}
                onInsert={onInsertQuickReply}
                onFocusComposer={onFocusComposer}
                buttonClassName={btn}
                panelTitle={t('quickReplies.title')}
                variant={pickerVariant}
              />
              <InboxFollowupTemplatesPicker
                sessionId={crmSessionId}
                chatId={crmChatId}
                conversation={crmConversation}
                canWrite={canWrite}
                onInsert={onInsertQuickReply}
                onFocusComposer={onFocusComposer}
                buttonClassName={btn}
              />
            </>
          )}
        </>
      ) : (
        <>
          <InboxQuoteBuilder
            sessionId={crmSessionId}
            chatId={crmChatId}
            customerName={crmCustomerName}
            canWrite={canWrite}
            onSent={onQuoteSent}
            buttonClassName={btn}
            variant={pickerVariant}
          />
          <InboxProductPicker
            sessionId={sessionId}
            chatId={chatId}
            sessionStatus={sessionStatus}
            canWrite={canWrite}
            onSent={onProductSent}
            onStartSession={onStartSession}
            addOptimisticMessage={addOptimisticMessage}
            removeOptimisticMessage={removeOptimisticMessage}
            iconTrigger={{ className: btn }}
          />
          <InboxQuickRepliesPicker
            sessionId={crmSessionId}
            chatId={crmChatId}
            conversation={crmConversation}
            canWrite={canWrite}
            onInsert={onInsertQuickReply}
            onFocusComposer={onFocusComposer}
            buttonClassName={btn}
            panelTitle={t('quickReplies.title')}
            variant={pickerVariant}
          />
        </>
      )}
      <button
        type="button"
        className={btn}
        disabled={!canSend || sending || !canWrite}
        title={t('inbox.attachImage')}
        aria-label={t('inbox.attachImage')}
        onClick={onAttachClick}
      >
        <Paperclip size={18} strokeWidth={1.75} aria-hidden />
      </button>
      {(!isGroup || allowPersonalActions) && (
        <InboxFollowupTemplatesPicker
          sessionId={crmSessionId}
          chatId={crmChatId}
          conversation={crmConversation}
          canWrite={canWrite}
          onInsert={onInsertQuickReply}
          onFocusComposer={onFocusComposer}
          buttonClassName={btn}
        />
      )}
      <InboxInteraktEmojiPicker
        canWrite={canWrite}
        buttonClassName={btn}
        onInsert={onAppendComposer}
        onFocusComposer={onFocusComposer}
      />
    </div>
  );
}
