import { useTranslation } from 'react-i18next';
import { inferConversationType } from '../../lib/conversation-types';
import {
  buildGroupMemberConversation,
  filterGroupMessagesByMember,
  resolveGroupMemberLabel,
  resolveGroupMemberPhone,
} from '../../lib/group-participants';
import { useGroupParticipants } from '../../hooks/useGroupParticipants';
import { getConversationTitle } from '../../pages/inbox-helpers';
import { DirectCustomerCrmPanel } from './DirectCustomerCrmPanel';
import { GroupCrmPanel } from './GroupCrmPanel';
import { InboxStitchGroupCrmPanel } from '../InboxStitchGroupCrmPanel';
import { InboxStitchGroupMemberBar } from '../InboxStitchGroupMemberBar';
import { GroupMemberCrmHeader } from './GroupMemberCrmHeader';
import { CampaignCrmPanel } from './CampaignCrmPanel';
import { InternalChatPanel } from './InternalChatPanel';
import { SystemMessagePanel } from './SystemMessagePanel';
import { SpamPanel } from './SpamPanel';
import type { ComponentProps } from 'react';

type CustomerPanelProps = ComponentProps<typeof DirectCustomerCrmPanel>;

type Props = CustomerPanelProps & {
  selectedGroupMember?: string | null;
  onSelectGroupMember?: (memberId: string | null) => void;
  sessionStatus?: string;
};

export function InboxCrmPanelRouter({
  thread,
  conversation,
  selectedGroupMember,
  onSelectGroupMember,
  sessionStatus,
  ...customerProps
}: Props) {
  const { t } = useTranslation();
  const recentMessages = customerProps.recentMessages ?? [];
  const isGroup = thread
    ? inferConversationType(thread.chatId, conversation) === 'group'
    : false;
  const { participants: groupParticipants } = useGroupParticipants(
    thread?.sessionId,
    thread?.chatId,
    recentMessages,
    sessionStatus,
    isGroup,
  );

  if (!thread) {
    return (
      <DirectCustomerCrmPanel
        thread={null}
        conversation={undefined}
        sessionStatus={sessionStatus}
        {...customerProps}
      />
    );
  }

  const type = inferConversationType(thread.chatId, conversation);

  switch (type) {
    case 'group':
      if (selectedGroupMember) {
        const member = groupParticipants.find(p => p.id === selectedGroupMember);
        const memberLabel = resolveGroupMemberLabel(
          selectedGroupMember,
          recentMessages,
          t,
          groupParticipants,
        );
        const memberPhone = resolveGroupMemberPhone(selectedGroupMember, groupParticipants);
        const memberThread = { sessionId: thread.sessionId, chatId: selectedGroupMember };
        const memberConversation = buildGroupMemberConversation(
          conversation,
          selectedGroupMember,
          memberLabel,
          memberPhone,
        );
        const memberMessages = filterGroupMessagesByMember(recentMessages, selectedGroupMember);
        const rawGroupTitle = conversation
          ? getConversationTitle(conversation, t)
          : thread.chatId;
        const groupTitle = rawGroupTitle
          .replace(/\s*\((group|קבוצה)\)\s*$/i, '')
          .trim();

        return customerProps.stitchLayout ? (
          <div className="inbox-group-member-crm inbox-group-member-crm--stitch">
            <InboxStitchGroupMemberBar
              groupTitle={groupTitle}
              messageCount={member?.messageCount}
              onBack={() => onSelectGroupMember?.(null)}
              onOpenPrivateChat={
                customerProps.onOpenThread
                  ? () => customerProps.onOpenThread!(thread.sessionId, selectedGroupMember)
                  : undefined
              }
            />
            <DirectCustomerCrmPanel
              thread={memberThread}
              conversation={memberConversation}
              sessionStatus={sessionStatus}
              {...customerProps}
              recentMessages={memberMessages}
              displayNameOverride={memberLabel}
              groupMemberPhone={memberPhone}
              groupMemberContext={{
                groupTitle,
                messageCount: member?.messageCount ?? 0,
              }}
            />
          </div>
        ) : (
          <div className="inbox-group-member-crm">
            <GroupMemberCrmHeader
              groupTitle={groupTitle}
              messageCount={member?.messageCount}
              onClear={() => onSelectGroupMember?.(null)}
              onOpenPrivateChat={
                customerProps.onOpenThread
                  ? () => customerProps.onOpenThread!(thread.sessionId, selectedGroupMember)
                  : undefined
              }
            />
            <DirectCustomerCrmPanel
              thread={memberThread}
              conversation={memberConversation}
              sessionStatus={sessionStatus}
              {...customerProps}
              recentMessages={memberMessages}
              displayNameOverride={memberLabel}
              groupMemberPhone={memberPhone}
              groupMemberContext={{
                groupTitle,
                messageCount: member?.messageCount ?? 0,
              }}
            />
          </div>
        );
      }
      return customerProps.stitchLayout ? (
        <InboxStitchGroupCrmPanel
          conversation={conversation}
          chatId={thread.chatId}
          sessionId={thread.sessionId}
          sessionStatus={sessionStatus}
          recentMessages={recentMessages}
          selectedGroupMember={selectedGroupMember}
          onSelectGroupMember={onSelectGroupMember}
          activeTab={customerProps.interaktActiveTab ?? 'details'}
          onTabChange={customerProps.onInteraktTabChange}
          canWrite={customerProps.canWrite}
          customerNotesInputRef={customerProps.customerNotesInputRef}
          onCrmUpdated={customerProps.onCrmUpdated}
        />
      ) : (
        <GroupCrmPanel
          conversation={conversation}
          chatId={thread.chatId}
          sessionId={thread.sessionId}
          sessionStatus={sessionStatus}
          recentMessages={recentMessages}
          selectedGroupMember={selectedGroupMember}
          onSelectGroupMember={onSelectGroupMember}
        />
      );
    case 'broadcast':
      return <CampaignCrmPanel chatId={thread.chatId} conversation={conversation} />;
    case 'internal':
      return <InternalChatPanel />;
    case 'system':
      return <SystemMessagePanel chatId={thread.chatId} />;
    case 'spam':
      return <SpamPanel chatId={thread.chatId} conversation={conversation} />;
    case 'direct_customer':
    case 'unknown':
    default:
      return (
        <DirectCustomerCrmPanel
          thread={thread}
          conversation={conversation}
          sessionStatus={sessionStatus}
          {...customerProps}
        />
      );
  }
}
