import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users, Package, Clock, Loader2 } from 'lucide-react';
import { EmptyState, StatusBadge } from '../workspace';
import { LeadSourceBadge } from '../LeadSourceBadge';
import { InboxGroupMemberAvatar } from '../InboxGroupMemberAvatar';
import { ConversationTypeBadgeExplicit } from './ConversationTypeBadge';
import {
  extractProductNamesFromMessages,
  formatMessageTime,
  getConversationTitle,
} from '../../pages/inbox-helpers';
import {
  extractGroupChatNameFromMessages,
  getGroupMessageSenderId,
  getGroupMessageSenderLabel,
} from '../../lib/group-participants';
import { useGroupParticipants } from '../../hooks/useGroupParticipants';
import { aiApi } from '../../services/api';
import type { Conversation, InboxMessage } from '../../services/api';
import './inbox-crm.css';

type GroupTab =
  | 'overview'
  | 'members'
  | 'leads'
  | 'topics'
  | 'products'
  | 'campaigns'
  | 'rules'
  | 'timeline';

const TABS: GroupTab[] = [
  'overview',
  'members',
  'leads',
  'topics',
  'products',
  'campaigns',
  'rules',
  'timeline',
];

type Props = {
  conversation?: Conversation;
  chatId: string;
  sessionId: string;
  sessionStatus?: string;
  recentMessages?: InboxMessage[];
  selectedGroupMember?: string | null;
  onSelectGroupMember?: (memberId: string | null) => void;
};

export function GroupCrmPanel({
  conversation,
  chatId,
  sessionId,
  sessionStatus,
  recentMessages = [],
  selectedGroupMember,
  onSelectGroupMember,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<GroupTab>('overview');
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

  const { data: groupLeads, isLoading: loadingLeads } = useQuery({
    queryKey: ['groupLeads', sessionId, chatId],
    queryFn: () => aiApi.listGroupLeads(sessionId, chatId),
    enabled: tab === 'leads' && Boolean(sessionId && chatId),
    staleTime: 30_000,
  });

  const productNames = useMemo(
    () => extractProductNamesFromMessages(recentMessages, 8),
    [recentMessages],
  );

  const timelineItems = useMemo(
    () =>
      [...recentMessages]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
    [recentMessages],
  );

  const selectedMember = participants.find(p => p.id === selectedGroupMember);

  return (
    <div className="inbox-crm-panel">
      <p className="inbox-crm-panel__notice">{t('inbox.groupCrm.aiNotice')}</p>
      <div className="inbox-crm-panel__tabs" role="tablist">
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={['inbox-crm-panel__tab', tab === id ? 'inbox-crm-panel__tab--active' : ''].join(' ')}
            onClick={() => setTab(id)}
          >
            {t(`inbox.groupCrm.tabs.${id}`)}
            {id === 'members' && participants.length > 0 && (
              <span className="inbox-crm-panel__tab-count">{participants.length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="inbox-crm-panel__body">
        {tab === 'overview' && (
          <div className="inbox-group-overview">
            <div className="inbox-group-overview__head">
              <h3 className="inbox-group-overview__title">{title}</h3>
              <ConversationTypeBadgeExplicit type="group" />
            </div>
            {conversation && (
              <div className="inbox-group-stat-grid">
                <div className="inbox-group-stat">
                  <span className="inbox-group-stat__label">{t('inbox.groupCrm.stats.messages')}</span>
                  <span className="inbox-group-stat__value">{conversation.messageCount}</span>
                </div>
                <div className="inbox-group-stat">
                  <span className="inbox-group-stat__label">{t('inbox.groupCrm.stats.unread')}</span>
                  <span className="inbox-group-stat__value">{conversation.unreadCount}</span>
                </div>
                <div className="inbox-group-stat">
                  <span className="inbox-group-stat__label">{t('inbox.groupCrm.stats.participants')}</span>
                  <span className="inbox-group-stat__value">{participants.length}</span>
                </div>
              </div>
            )}
            <div className="inbox-group-overview__meta">
              {conversation?.resolved && (
                <StatusBadge variant="success">{t('inbox.chipResolved')}</StatusBadge>
              )}
              {conversation?.leadSource && (
                <LeadSourceBadge source={conversation.leadSource} className="lead-source-badge--sm" />
              )}
            </div>
            {selectedGroupMember && (
              <div className="inbox-group-selected-member">
                <span className="inbox-group-selected-member__label">
                  {t('inbox.groupCrm.selectedMember')}
                </span>
                <span className="inbox-group-selected-member__value">
                  {selectedMember?.label ?? selectedGroupMember}
                </span>
                {onSelectGroupMember && (
                  <button
                    type="button"
                    className="inbox-group-selected-member__clear"
                    onClick={() => onSelectGroupMember(null)}
                  >
                    {t('inbox.groupCrm.clearMember')}
                  </button>
                )}
              </div>
            )}
            <p className="inbox-group-overview__desc">{t('inbox.groupCrm.overviewDesc')}</p>
          </div>
        )}

        {tab === 'members' && (
          participants.length > 0 ? (
            <div className="inbox-group-member-list">
              <p className="inbox-group-member-list__hint">
                {rosterLoaded
                  ? t('inbox.groupCrm.participantsRosterHint')
                  : t('inbox.groupCrm.participantsHint')}
              </p>
              {loadingParticipants && (
                <p className="inbox-group-member-list__loading">
                  <Loader2 className="animate-spin" size={12} aria-hidden />
                  {t('inbox.groupCrm.loadingRoster')}
                </p>
              )}
              {participants.map(member => {
                const active = selectedGroupMember === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    className={[
                      'inbox-group-member-row',
                      active ? 'inbox-group-member-row--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      onSelectGroupMember?.(active ? null : member.id)
                    }
                  >
                    <InboxGroupMemberAvatar
                      sessionId={sessionId}
                      sessionStatus={sessionStatus}
                      memberId={member.id}
                      memberLabel={member.label}
                      selected={active}
                      avatarClassName="inbox-group-member-row__avatar inbox-avatar inbox-avatar--private"
                      fetchWhenVisible
                    />
                    <span className="inbox-group-member-row__main">
                      <span className="inbox-group-member-row__name">
                        {member.label}
                        {member.isAdmin && (
                          <span className="inbox-group-member-row__admin">
                            {t('inbox.groupCrm.adminBadge')}
                          </span>
                        )}
                      </span>
                      <span className="inbox-group-member-row__preview">{member.lastPreview}</span>
                    </span>
                    <span className="inbox-group-member-row__meta">
                      {member.phone && (
                        <span className="inbox-group-member-row__phone">{member.phone}</span>
                      )}
                      {t('inbox.groupCrm.messageCount', { count: member.messageCount })}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={32} />}
              title={t('inbox.groupCrm.noParticipants')}
              description={t('inbox.groupCrm.noParticipantsDesc')}
            />
          )
        )}

        {tab === 'leads' && (
          loadingLeads ? (
            <p className="inbox-group-member-list__loading">
              <Loader2 className="animate-spin" size={12} aria-hidden />
              {t('inbox.groupCrm.loadingLeads')}
            </p>
          ) : groupLeads?.leads?.length ? (
            <div className="inbox-group-lead-list">
              {groupLeads.escalation && (
                <div className="inbox-group-lead-list__status">
                  <StatusBadge variant="warning">{t('inbox.groupCrm.leadOpen')}</StatusBadge>
                  {groupLeads.escalation.detail && (
                    <p className="inbox-group-lead-list__status-detail">
                      {groupLeads.escalation.detail}
                    </p>
                  )}
                </div>
              )}
              <ul className="inbox-group-lead-list__items">
                {groupLeads.leads.map(lead => (
                  <li key={lead.id} className="inbox-group-lead-row">
                    <span className="inbox-group-lead-row__intent">
                      {lead.detectedIntent.replace(/_/g, ' ')}
                    </span>
                    <p className="inbox-group-lead-row__text">{lead.incomingText}</p>
                    <time className="inbox-group-lead-row__time">
                      {formatMessageTime(lead.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title={t('inbox.groupCrm.leadsEmpty')}
              description={t('inbox.groupCrm.leadsEmptyDesc')}
            />
          )
        )}
        {tab === 'topics' && (
          <div className="inbox-crm-placeholder">
            <StatusBadge variant="neutral">{t('inbox.groupCrm.requiresBackend')}</StatusBadge>
            <EmptyState
              title={t('inbox.groupCrm.topicsEmpty')}
              description={t('inbox.groupCrm.topicsEmptyDesc')}
            />
          </div>
        )}

        {tab === 'products' && (
          productNames.length > 0 ? (
            <div className="inbox-group-product-list">
              <p className="inbox-group-product-list__label">
                <Package size={14} aria-hidden />
                {t('inbox.groupCrm.recentProducts')}
              </p>
              <ul>
                {productNames.map(name => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title={t('inbox.groupCrm.productsEmpty')}
              description={t('inbox.groupCrm.productsEmptyDesc')}
            />
          )
        )}

        {tab === 'campaigns' && (
          <div className="inbox-crm-placeholder">
            <StatusBadge variant="neutral">{t('inbox.groupCrm.requiresBackend')}</StatusBadge>
            <EmptyState
              title={t('inbox.groupCrm.campaignsEmpty')}
              description={t('inbox.groupCrm.campaignsEmptyDesc')}
            />
          </div>
        )}
        {tab === 'rules' && (
          <div className="inbox-crm-placeholder">
            <StatusBadge variant="neutral">{t('inbox.groupCrm.requiresBackend')}</StatusBadge>
            <EmptyState
              title={t('inbox.groupCrm.rulesEmpty')}
              description={t('inbox.groupCrm.rulesEmptyDesc')}
            />
          </div>
        )}

        {tab === 'timeline' && (
          timelineItems.length > 0 ? (
            <div className="inbox-group-timeline">
              <p className="inbox-group-timeline__label">
                <Clock size={14} aria-hidden />
                {t('inbox.groupCrm.timelineFromMessages')}
              </p>
              <ul className="inbox-group-timeline__list">
                {timelineItems.map(msg => {
                  const senderId =
                    msg.direction === 'incoming' ? getGroupMessageSenderId(msg) : null;
                  const senderLabel = senderId
                    ? getGroupMessageSenderLabel(msg, senderId, t)
                    : null;
                  return (
                  <li key={msg.id} className="inbox-group-timeline__item">
                    {senderLabel && (
                      <span className="inbox-group-timeline__sender">{senderLabel}</span>
                    )}
                    <span
                      className={[
                        'inbox-group-timeline__dir',
                        msg.direction === 'incoming'
                          ? 'inbox-group-timeline__dir--in'
                          : 'inbox-group-timeline__dir--out',
                      ].join(' ')}
                    >
                      {msg.direction === 'incoming'
                        ? t('inbox.groupCrm.timelineIn')
                        : t('inbox.groupCrm.timelineOut')}
                    </span>
                    <span className="inbox-group-timeline__preview">
                      {msg.body?.trim().slice(0, 120) || msg.type}
                    </span>
                    <span className="inbox-group-timeline__time">{formatMessageTime(msg.createdAt)}</span>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              title={t('inbox.groupCrm.timelineEmpty')}
              description={t('inbox.groupCrm.timelineEmptyDesc')}
            />
          )
        )}
      </div>
    </div>
  );
}
