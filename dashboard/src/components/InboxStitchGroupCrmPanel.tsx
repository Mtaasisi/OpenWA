import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxGroupMemberAvatar } from './InboxGroupMemberAvatar';
import { InboxStitchCustomerNotesPanel } from './InboxStitchCustomerNotesPanel';
import { InboxStitchCustomerActivityPanel } from './InboxStitchCustomerActivityPanel';
import {
  extractProductNamesFromMessages,
  formatMessageTime,
  getConversationTitle,
} from '../pages/inbox-helpers';
import {
  extractGroupChatNameFromMessages,
  getGroupMessageSenderId,
  getGroupMessageSenderLabel,
} from '../lib/group-participants';
import { useGroupParticipants } from '../hooks/useGroupParticipants';
import { leadSourceLabel } from '../lib/lead-sources';
import { inboxApi } from '../services/api';
import type { Conversation, InboxMessage } from '../services/api';

type Props = {
  conversation?: Conversation;
  chatId: string;
  sessionId: string;
  sessionStatus?: string;
  recentMessages?: InboxMessage[];
  selectedGroupMember?: string | null;
  onSelectGroupMember?: (memberId: string | null) => void;
  activeTab?: 'details' | 'timeline';
  onTabChange?: (tab: 'details' | 'timeline') => void;
  canWrite?: boolean;
  customerNotesInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onCrmUpdated?: () => void;
};

export function InboxStitchGroupCrmPanel({
  conversation,
  chatId,
  sessionId,
  sessionStatus,
  recentMessages = [],
  selectedGroupMember,
  onSelectGroupMember,
  activeTab = 'details',
  onTabChange,
  canWrite = false,
  customerNotesInputRef,
  onCrmUpdated,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [membersOpen, setMembersOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [pinnedNote, setPinnedNote] = useState(false);

  const title = useMemo(() => {
    const chatNameFromMessages = extractGroupChatNameFromMessages(recentMessages);
    if (chatNameFromMessages) {
      return `${chatNameFromMessages} (${t('inbox.chipGroup')})`;
    }
    if (conversation) {
      return getConversationTitle(conversation, t);
    }
    return chatId;
  }, [conversation, chatId, recentMessages, t]);

  const {
    participants,
    isLoading: loadingParticipants,
    rosterLoaded,
  } = useGroupParticipants(sessionId, chatId, recentMessages, sessionStatus, true);

  const productNames = useMemo(
    () => extractProductNamesFromMessages(recentMessages, 8),
    [recentMessages],
  );

  const activityPreview = useMemo(
    () =>
      [...recentMessages]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [recentMessages],
  );

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', sessionId, chatId],
    queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
    enabled: Boolean(sessionId && chatId),
  });

  useEffect(() => {
    setMembersOpen(true);
    setProductsOpen(true);
    setActivityOpen(false);
  }, [sessionId, chatId]);

  useEffect(() => {
    setNoteDraft(crm?.internalNote?.trim() ?? '');
  }, [crm?.internalNote, sessionId, chatId]);

  const notesDirty = noteDraft.trim() !== (crm?.internalNote?.trim() ?? '');

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      inboxApi.updateThreadCrm({
        sessionId,
        chatId,
        internalNote: noteDraft.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      onCrmUpdated?.();
    },
  });

  const platformLabel = leadSourceLabel(conversation?.leadSource?.trim() || 'whatsapp', t);
  const membersLabel =
    participants.length > 0
      ? `${t('inbox.groupCrm.tabs.members')} (${participants.length})`
      : t('inbox.groupCrm.tabs.members');

  const renderMemberList = () => {
    if (participants.length === 0) {
      return <p className="inbox-stitch-group-c360__empty">{t('inbox.groupCrm.noParticipantsDesc')}</p>;
    }

    return (
      <>
        <p className="inbox-stitch-group-c360__hint">
          {rosterLoaded
            ? t('inbox.groupCrm.participantsRosterHint')
            : t('inbox.groupCrm.participantsHint')}
        </p>
        {loadingParticipants ? (
          <p className="inbox-stitch-group-c360__loading">
            <Loader2 className="animate-spin" size={12} aria-hidden />
            {t('inbox.groupCrm.loadingRoster')}
          </p>
        ) : null}
        <div className="inbox-stitch-group-c360__member-list">
          {participants.map(member => {
            const active = selectedGroupMember === member.id;
            return (
              <button
                key={member.id}
                type="button"
                className={`inbox-stitch-group-c360__member-row${active ? ' is-selected' : ''}`}
                onClick={() => onSelectGroupMember?.(active ? null : member.id)}
              >
                <InboxGroupMemberAvatar
                  sessionId={sessionId}
                  sessionStatus={sessionStatus}
                  memberId={member.id}
                  memberLabel={member.label}
                  selected={active}
                  avatarClassName="inbox-stitch-group-c360__member-avatar inbox-avatar inbox-avatar--private"
                  fetchWhenVisible
                />
                <span className="inbox-stitch-group-c360__member-main">
                  <span className="inbox-stitch-group-c360__member-name">
                    {member.label}
                    {member.isAdmin ? (
                      <span className="inbox-stitch-group-c360__member-admin">
                        {t('inbox.groupCrm.adminBadge')}
                      </span>
                    ) : null}
                  </span>
                  <span className="inbox-stitch-group-c360__member-preview">{member.lastPreview}</span>
                </span>
                <span className="inbox-stitch-group-c360__member-meta">
                  {member.phone ? (
                    <span className="inbox-stitch-group-c360__member-phone">{member.phone}</span>
                  ) : null}
                  {t('inbox.groupCrm.messageCount', { count: member.messageCount })}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const renderDetailsTab = () => (
    <section className="inbox-stitch-c360 inbox-stitch-group-c360 animate-in">
      <p className="inbox-stitch-group-c360__notice">{t('inbox.groupCrm.aiNotice')}</p>

      <div className="inbox-stitch-c360-profile-card inbox-stitch-group-c360__hero">
        <div className="inbox-stitch-group-c360__head">
          <h3 className="inbox-stitch-group-c360__title">{title}</h3>
          <span className="inbox-stitch-group-c360__type-badge">{t('inbox.chatType.group')}</span>
        </div>

        {conversation ? (
          <div className="inbox-stitch-group-c360__stats">
            <div className="inbox-stitch-group-c360__stat">
              <span className="inbox-stitch-group-c360__stat-label">
                {t('inbox.groupCrm.stats.messages')}
              </span>
              <span className="inbox-stitch-group-c360__stat-value">{conversation.messageCount}</span>
            </div>
            <div className="inbox-stitch-group-c360__stat">
              <span className="inbox-stitch-group-c360__stat-label">
                {t('inbox.groupCrm.stats.unread')}
              </span>
              <span className="inbox-stitch-group-c360__stat-value">{conversation.unreadCount}</span>
            </div>
            <div className="inbox-stitch-group-c360__stat">
              <span className="inbox-stitch-group-c360__stat-label">
                {t('inbox.groupCrm.stats.participants')}
              </span>
              <span className="inbox-stitch-group-c360__stat-value">{participants.length}</span>
            </div>
          </div>
        ) : null}

        <span className="inbox-stitch-group-c360__platform">{platformLabel}</span>
        <p className="inbox-stitch-group-c360__desc">{t('inbox.groupCrm.overviewDesc')}</p>
      </div>

      <div
        className={`inbox-stitch-c360-panel-card inbox-stitch-group-c360__members-card${membersOpen ? ' is-open' : ''}`}
      >
        <button
          type="button"
          className="inbox-stitch-c360-panel-card__toggle"
          aria-expanded={membersOpen}
          onClick={() => setMembersOpen(open => !open)}
        >
          <span className="inbox-stitch-c360-panel-card__title">{membersLabel}</span>
          <MaterialSymbol name={membersOpen ? 'expand_more' : 'chevron_right'} size={20} />
        </button>
        {membersOpen ? (
          <div className="inbox-stitch-c360-panel-card__body inbox-stitch-group-c360__members-body">
            {renderMemberList()}
          </div>
        ) : null}
      </div>

      {productNames.length > 0 ? (
        <div
          className={`inbox-stitch-c360-panel-card inbox-stitch-group-c360__products-card${productsOpen ? ' is-open' : ''}`}
        >
          <button
            type="button"
            className="inbox-stitch-c360-panel-card__toggle"
            aria-expanded={productsOpen}
            onClick={() => setProductsOpen(open => !open)}
          >
            <span className="inbox-stitch-c360-panel-card__title">{t('inbox.groupCrm.tabs.products')}</span>
            <MaterialSymbol name={productsOpen ? 'expand_more' : 'chevron_right'} size={20} />
          </button>
          {productsOpen ? (
            <div className="inbox-stitch-c360-panel-card__body inbox-stitch-group-c360__products-body">
              <p className="inbox-stitch-group-c360__products-label">{t('inbox.groupCrm.recentProducts')}</p>
              <ul className="inbox-stitch-group-c360__product-list">
                {productNames.map(name => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {activityPreview.length > 0 ? (
        <div
          className={`inbox-stitch-c360-panel-card inbox-stitch-group-c360__activity-card${activityOpen ? ' is-open' : ''}`}
        >
          <button
            type="button"
            className="inbox-stitch-c360-panel-card__toggle"
            aria-expanded={activityOpen}
            onClick={() => setActivityOpen(open => !open)}
          >
            <span className="inbox-stitch-c360-panel-card__title">{t('inbox.interakt.tabActivity')}</span>
            <MaterialSymbol name={activityOpen ? 'expand_more' : 'chevron_right'} size={20} />
          </button>
          {activityOpen ? (
            <>
              <div className="inbox-stitch-c360-panel-card__body inbox-stitch-group-c360__activity-body">
                <ul className="inbox-stitch-group-c360__timeline">
                  {activityPreview.map(msg => {
                    const senderId =
                      msg.direction === 'incoming' ? getGroupMessageSenderId(msg) : null;
                    const senderLabel = senderId
                      ? getGroupMessageSenderLabel(msg, senderId, t)
                      : null;
                    return (
                      <li key={msg.id} className="inbox-stitch-group-c360__timeline-item">
                        {senderLabel ? (
                          <span className="inbox-stitch-group-c360__timeline-sender">{senderLabel}</span>
                        ) : null}
                        <span className="inbox-stitch-group-c360__timeline-preview">
                          {msg.body?.trim().slice(0, 100) || msg.type}
                        </span>
                        <span className="inbox-stitch-group-c360__timeline-time">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {onTabChange ? (
                <button
                  type="button"
                  className="inbox-stitch-c360-view-more inbox-stitch-group-c360__activity-more"
                  onClick={() => onTabChange('timeline')}
                >
                  <span>{t('inbox.groupCrm.viewAllActivity')}</span>
                  <MaterialSymbol name="chevron_right" size={18} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <InboxStitchCustomerNotesPanel
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        notesDirty={notesDirty}
        canWrite={canWrite}
        savingNotes={saveNotesMutation.isPending}
        onSaveNotes={() => saveNotesMutation.mutate()}
        pinnedNote={pinnedNote}
        setPinnedNote={setPinnedNote}
        customerNotesInputRef={customerNotesInputRef}
      />
    </section>
  );

  return (
    <div className="inbox-crm-content inbox-crm-content--stitch">
      <div className="inbox-interakt-crm-sections inbox-interakt-crm-sections--edition">
        {activeTab === 'timeline' ? (
          <InboxStitchCustomerActivityPanel sessionId={sessionId} chatId={chatId} />
        ) : (
          renderDetailsTab()
        )}
      </div>
    </div>
  );
}
