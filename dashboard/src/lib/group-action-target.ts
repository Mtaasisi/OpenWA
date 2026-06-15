import type { Conversation } from '../services/api';
import {
  buildGroupMemberConversation,
  resolveGroupMemberPhone,
  type GroupParticipantFromMessages,
} from './group-participants';

export type InboxActionTarget = {
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
};

/** Map group thread + optional selected member to the CRM/action target chat. */
export function resolveGroupPersonalTarget(
  sessionId: string,
  groupChatId: string,
  conversation: Conversation | undefined,
  selectedGroupMember: string | null | undefined,
  memberLabel?: string | null,
  participants?: GroupParticipantFromMessages[],
  memberPhone?: string | null,
): InboxActionTarget {
  if (!selectedGroupMember) {
    return { sessionId, chatId: groupChatId, conversation };
  }

  const label = memberLabel?.trim() || selectedGroupMember;
  const phone =
    memberPhone ?? resolveGroupMemberPhone(selectedGroupMember, participants);
  return {
    sessionId,
    chatId: selectedGroupMember,
    conversation: buildGroupMemberConversation(
      conversation,
      selectedGroupMember,
      label,
      phone,
    ),
  };
}
