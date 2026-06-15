import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from './MaterialSymbol';
import { inboxApi, type Conversation, type InboxMessage, type Session } from '../services/api';
import { insertComposerText } from '../pages/inbox-helpers';
import { inferConversationType } from '../lib/conversation-types';
import { resolveGroupPersonalTarget } from '../lib/group-action-target';
import { channelSupportsAction } from '../lib/channels';
import { InboxComposerTools } from './InboxComposerTools';
import { InboxInteraktEmojiPicker } from './InboxInteraktEmojiPicker';
import { InboxQuoteBuilder } from './InboxQuoteBuilder';
import type { InteraktComposerTab } from './InboxInteraktChatHeader';

export type { InteraktComposerTab };

interface InboxInteraktComposerProps {
  thread: { sessionId: string; chatId: string };
  conversation?: Conversation;
  sessionStatus?: string;
  sendSession?: Session | null;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  composerInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachClick: () => void;
  onCrmUpdated: () => void;
  onQuoteSent: () => void;
  onStartSession?: (sessionId: string) => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  selectedGroupMember?: string | null;
  selectedGroupMemberLabel?: string | null;
  selectedGroupMemberPhone?: string | null;
  activeTab: InteraktComposerTab;
  onActiveTabChange: (tab: InteraktComposerTab) => void;
  onOpenScheduleModal?: () => void;
  onComposerContextMenu?: (event: React.MouseEvent) => void;
}

export function InboxInteraktComposer({
  thread,
  conversation,
  sessionStatus,
  sendSession: _sendSession,
  canWrite,
  canSend,
  sending,
  draft,
  setDraft,
  onSend,
  composerInputRef,
  onComposerKeyDown,
  onAttachClick,
  onCrmUpdated,
  onQuoteSent,
  onStartSession,
  addOptimisticMessage,
  removeOptimisticMessage,
  selectedGroupMember,
  selectedGroupMemberLabel,
  selectedGroupMemberPhone,
  activeTab,
  onActiveTabChange,
  onOpenScheduleModal,
  onComposerContextMenu,
}: InboxInteraktComposerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');

  const isGroup = inferConversationType(thread.chatId, conversation) === 'group';
  const allowPersonalActions = !isGroup || Boolean(selectedGroupMember);
  const crmTarget = resolveGroupPersonalTarget(
    thread.sessionId,
    thread.chatId,
    conversation,
    selectedGroupMember,
    selectedGroupMemberLabel,
    undefined,
    selectedGroupMemberPhone,
  );
  const showFollowUpTab = channelSupportsAction('whatsapp', 'follow_up') && allowPersonalActions;
  const showQuoteTab = channelSupportsAction('whatsapp', 'quote') && allowPersonalActions;

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', crmTarget.sessionId, crmTarget.chatId],
    queryFn: () => inboxApi.getThreadCrm(crmTarget.sessionId, crmTarget.chatId),
    enabled: activeTab === 'notes',
  });

  useEffect(() => {
    if (activeTab === 'notes') {
      setNoteDraft(crm?.internalNote ?? '');
    }
  }, [activeTab, crm?.internalNote, crmTarget.sessionId, crmTarget.chatId]);

  const saveNote = useMutation({
    mutationFn: (text: string) =>
      inboxApi.updateThreadCrm({
        sessionId: crmTarget.sessionId,
        chatId: crmTarget.chatId,
        internalNote: text.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['inbox', 'crm', crmTarget.sessionId, crmTarget.chatId],
      });
      onCrmUpdated();
    },
  });

  const tabs = useMemo(() => {
    const items: { id: InteraktComposerTab; label: string }[] = [
      { id: 'reply', label: t('inbox.interakt.tabReply') },
      { id: 'notes', label: t('inbox.interakt.tabNotes') },
    ];
    if (showFollowUpTab) {
      items.push({ id: 'followup', label: t('inbox.interakt.tabFollowup') });
    }
    if (showQuoteTab) {
      items.push({ id: 'quote', label: t('inbox.interakt.tabQuote') });
    }
    return items;
  }, [showFollowUpTab, showQuoteTab, t]);

  useEffect(() => {
    if (activeTab === 'followup') {
      onOpenScheduleModal?.();
      onActiveTabChange('reply');
    }
    if (activeTab === 'quote' && !showQuoteTab) onActiveTabChange('reply');
  }, [activeTab, onActiveTabChange, onOpenScheduleModal, showQuoteTab]);

  const handleTabClick = (tab: InteraktComposerTab) => {
    if (tab === 'followup') {
      onOpenScheduleModal?.();
      return;
    }
    onActiveTabChange(tab);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'notes') {
      if (!canWrite || saveNote.isPending) return;
      saveNote.mutate(noteDraft);
      return;
    }
    if (activeTab === 'reply') {
      onSend();
    }
  };

  const sendDisabled =
    activeTab === 'notes'
      ? !canWrite || saveNote.isPending || noteDraft === (crm?.internalNote ?? '')
      : !canSend || sending;

  const sendLabel =
    activeTab === 'notes'
      ? t('inbox.crm.saveNote')
      : t('inbox.interakt.send');

  const cardClass =
    activeTab === 'notes'
      ? 'inbox-interakt-composer-card inbox-interakt-composer-card--notes'
      : 'inbox-interakt-composer-card';

  return (
    <form className="inbox-interakt-composer-form" onSubmit={handleSubmit}>
      <div
        className="inbox-interakt-composer-tabs-bar inbox-interakt-composer-tabs-bar--edition"
        role="tablist"
        aria-label={t('inbox.interakt.composerTabs')}
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`inbox-interakt-composer-tab${activeTab === item.id ? ' is-active' : ''}`}
            onClick={() => handleTabClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={cardClass}>
        {activeTab === 'reply' && (
          <>
            <div className="inbox-interakt-composer-toolbar-row">
              <InboxComposerTools
                variant="interakt"
                tabLayout
                sessionId={thread.sessionId}
                chatId={thread.chatId}
                conversation={conversation}
                sessionStatus={sessionStatus}
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
                onAttachClick={onAttachClick}
                onQuoteSent={onQuoteSent}
                onProductSent={onQuoteSent}
                addOptimisticMessage={addOptimisticMessage}
                removeOptimisticMessage={removeOptimisticMessage}
                onStartSession={onStartSession}
                selectedGroupMember={selectedGroupMember}
              />
            </div>
            <div className="inbox-interakt-composer-input-row">
              <button
                type="button"
                className="inbox-interakt-composer-add-btn"
                disabled={!canWrite || sending}
                title={t('inbox.attachImage')}
                aria-label={t('inbox.attachImage')}
                onClick={onAttachClick}
              >
                <MaterialSymbol name="add" size={22} />
              </button>
              <div className="inbox-interakt-composer-pill">
                <textarea
                  ref={composerInputRef}
                  className="inbox-interakt-composer-pill__field"
                  rows={1}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  onContextMenu={onComposerContextMenu}
                  placeholder={t('inbox.interakt.composerPlaceholder')}
                  disabled={!canWrite || sending}
                  aria-label={t('inbox.interakt.tabReply')}
                />
                <InboxInteraktEmojiPicker
                  canWrite={canWrite && !sending}
                  buttonClassName="inbox-interakt-composer-pill__emoji"
                  onFocusComposer={() => composerInputRef.current?.focus()}
                  onInsert={emoji => {
                    const el = composerInputRef.current;
                    if (!el) {
                      setDraft(draft + emoji);
                      return;
                    }
                    const { value, cursor } = insertComposerText(
                      draft,
                      emoji,
                      el.selectionStart,
                      el.selectionEnd,
                    );
                    setDraft(value);
                    requestAnimationFrame(() => {
                      el.focus();
                      el.setSelectionRange(cursor, cursor);
                    });
                  }}
                />
              </div>
              <button
                type="submit"
                className="inbox-interakt-composer-send-circle"
                disabled={sendDisabled}
                aria-label={t('inbox.interakt.send')}
              >
                {sending ? (
                  <MaterialSymbol name="sync" size={20} spin />
                ) : (
                  <MaterialSymbol name="send" size={20} />
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === 'notes' && (
          <>
            <div className="inbox-interakt-notes-wrap">
              <textarea
                className="inbox-interakt-notes-area"
                rows={4}
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                placeholder={t('inbox.interakt.notesPlaceholder')}
                disabled={!canWrite || saveNote.isPending}
                aria-label={t('inbox.interakt.tabNotes')}
              />
            </div>
            <div className="inbox-interakt-composer-footer">
              <button
                type="submit"
                className="inbox-interakt-send-btn inbox-interakt-send-btn--edition"
                disabled={sendDisabled}
              >
                {saveNote.isPending ? (
                  <MaterialSymbol name="sync" size={16} spin />
                ) : (
                  sendLabel
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === 'quote' && (
          <div className="inbox-interakt-picker-panel--quote">
            <InboxQuoteBuilder
              sessionId={crmTarget.sessionId}
              chatId={crmTarget.chatId}
              customerName={
                crmTarget.conversation?.customerName ??
                crmTarget.conversation?.displayName ??
                conversation?.customerName ??
                conversation?.displayName
              }
              customerPhone={
                crmTarget.conversation?.customerPhone ??
                conversation?.customerPhone ??
                undefined
              }
              canWrite={canWrite}
              embedded
              variant="interakt"
              onSent={() => {
                onQuoteSent();
                onActiveTabChange('reply');
              }}
            />
          </div>
        )}
      </div>
    </form>
  );
}
