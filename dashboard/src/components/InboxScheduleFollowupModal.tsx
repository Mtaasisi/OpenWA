import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScheduleMessageModal, type ScheduleMessagePayload } from './ScheduleMessageModal';
import { defaultFollowupDraft } from './InboxFollowupQuickPicker';
import { useToast } from './Toast';
import { inboxApi, type Conversation } from '../services/api';
import {
  formatCustomerLabel,
  formatSanitizedPhoneDisplay,
} from '../lib/inbox-customer-display';

type ThreadRef = { sessionId: string; chatId: string };

type Props = {
  open: boolean;
  thread: ThreadRef | null;
  conversation?: Conversation;
  canWrite: boolean;
  onClose: () => void;
  onSaved?: () => void;
  title?: string;
  followUpReasonOverride?: string | null;
  showSuccessToast?: boolean;
};

function customerInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function buildInboxScheduleRecipient(
  thread: ThreadRef,
  conversation: Conversation | undefined,
  t: TFunction,
  extras?: { subtitle?: string | null },
) {
  const name = formatCustomerLabel(
    {
      chatId: thread.chatId,
      customerName: conversation?.customerName,
      customerPhone: conversation?.customerPhone,
      displayName: conversation?.displayName,
    },
    t,
  );
  const phone = formatSanitizedPhoneDisplay(thread.chatId, conversation?.customerPhone, t);
  return {
    name,
    phone,
    channel: t('sms.channelWhatsapp'),
    initials: customerInitials(name),
    lastActivityAt: conversation?.lastCustomerMessageAt ?? null,
    avatarUrl: conversation?.profilePicUrl ?? null,
    subtitle: extras?.subtitle ?? null,
  };
}

export function InboxScheduleFollowupModal({
  open,
  thread,
  conversation,
  canWrite,
  onClose,
  onSaved,
  title,
  followUpReasonOverride,
  showSuccessToast = true,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', thread?.sessionId ?? '', thread?.chatId ?? ''],
    queryFn: () => inboxApi.getThreadCrm(thread!.sessionId, thread!.chatId),
    enabled: !!thread && open,
  });

  const saveFollowUp = useMutation({
    mutationFn: (payload: ScheduleMessagePayload) => {
      if (!thread) throw new Error('no thread');
      const userNote = payload.notes?.trim();
      return inboxApi.updateThreadCrm({
        sessionId: thread.sessionId,
        chatId: thread.chatId,
        followUpAt: payload.dueAt,
        followUpReason:
          followUpReasonOverride ??
          payload.reason ??
          crm?.followUpReason ??
          defaultFollowupDraft().reason,
        followUpNote: userNote || crm?.followUpNote?.trim() || null,
      });
    },
    onSuccess: () => {
      if (!thread) return;
      void queryClient.invalidateQueries({
        queryKey: ['inbox', 'crm', thread.sessionId, thread.chatId],
      });
      if (showSuccessToast) {
        toast.success(t('inbox.contextMenu.followUpScheduled'));
      }
      onSaved?.();
      onClose();
    },
  });

  const recipient = useMemo(() => {
    if (!thread) return null;
    const subtitleParts = [crm?.confirmedCity?.trim(), conversation?.leadSource?.trim()].filter(Boolean);
    return buildInboxScheduleRecipient(thread, conversation, t, {
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : null,
    });
  }, [conversation, crm?.confirmedCity, t, thread]);

  const initialDueAt = crm?.followUpAt ?? conversation?.followUpAt ?? null;
  const initialReason = crm?.followUpReason ?? null;
  const initialNote = crm?.followUpNote ?? null;

  return (
    <ScheduleMessageModal
      open={open}
      recipient={recipient}
      title={title ?? t('followups.scheduleModal.title')}
      initialDueAt={initialDueAt}
      initialReason={initialReason}
      initialNote={initialNote}
      defaultAiFollowUp={false}
      onClose={onClose}
      pending={saveFollowUp.isPending}
      disabled={!canWrite}
      onSchedule={payload => saveFollowUp.mutate(payload)}
    />
  );
}
