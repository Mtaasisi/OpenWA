import { Injectable } from '@nestjs/common';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import type { ConversationSummary } from './message.service';
import type {
  InboxThreadState,
  InboxThreadStateFields,
  InboxThreadStateReason,
  InboxWorkQueue,
  InboxQueueCounts,
} from './inbox-thread-state.types';

const ACK_PATTERNS =
  /^(asante|asante sana|sawa|sawa boss|ok|okay|oke|poa|nzuri|good|thanks|thank you|thx|👍|🙏)[\s!.?]*$/i;

const PAYMENT_HINTS =
  /\b(lipa|malipo|payment|pay|mpesa|tigo pesa|nmb|crdb|account|namba ya kufanyia|send payment|utume pesa)\b/i;

const STOCK_HINTS =
  /\b(stock|stocki|stocking|out of stock|hakuna|imeisha|waiting stock|restock|inventory)\b/i;

const QUESTION_HINTS = /\?|je\b|unaweza|can you|do you|how much|bei gani|price|available/i;

export interface ThreadStateInput {
  summary: ConversationSummary;
  viewerStaffId?: string | null;
  sessionDisconnected?: boolean;
  hasFailedSend?: boolean;
  hasQueuedSend?: boolean;
}

@Injectable()
export class InboxThreadStateService {
  compute(input: ThreadStateInput): InboxThreadStateFields {
    const { summary } = input;
    const chatId = summary.chatId ?? '';
    const isGroup = chatId.endsWith('@g.us');
    const preview = (summary.lastPreview ?? '').trim();
    const aiState = summary.aiHandlingState ?? 'idle';
    const aiPaused = summary.aiAutoReplyPaused === true;
    const aiOptOut = summary.aiOptOut === true;
    const resolved = summary.resolved === true;
    const followupOverdue = summary.followupOverdue === true;
    const followupDue =
      !followupOverdue &&
      Boolean(summary.nextFollowupAt ?? summary.followUpAt) &&
      !resolved;
    const hotLead =
      summary.priority === 'hot' ||
      summary.stage === 'hot_lead' ||
      summary.priority === 'high';
    const waitingPayment =
      summary.paymentReadiness === 'waiting' ||
      summary.outcome === 'waiting_payment' ||
      (summary.stage === 'negotiation' && PAYMENT_HINTS.test(preview));
    const waitingStock =
      summary.outcome === 'waiting_stock' ||
      summary.lostReason === 'no_stock' ||
      STOCK_HINTS.test(preview);
    const unassigned = !summary.assignedStaffId;
    const assignedToMe =
      Boolean(input.viewerStaffId) &&
      summary.assignedStaffId === input.viewerStaffId;

    let threadState: InboxThreadState = 'idle';
    let threadStateReason: InboxThreadStateReason = 'unknown';

    if (!isInboxChat(chatId)) {
      return this.pack('idle', 'unknown', {
        needsReply: false,
        needsHuman: false,
        waitingCustomer: false,
        hotLead,
        followupDue,
        followupOverdue,
        aiStatus: aiState,
        queueStatus: null,
        slaStatus: null,
        isGroup,
      });
    }

    if (input.hasFailedSend) {
      threadState = 'send_failed';
      threadStateReason = 'queue_failed';
    } else if (input.hasQueuedSend) {
      threadState = 'queued_message_pending';
      threadStateReason = 'queue_failed';
    } else if (aiOptOut) {
      threadState = 'opted_out';
      threadStateReason = 'customer_opted_out';
    } else if (isGroup) {
      threadState = 'group_lead_only';
      threadStateReason = 'group_ai_disabled';
    } else if (summary.stage === 'spam' || summary.outcome === 'spam') {
      threadState = 'spam';
      threadStateReason = 'resolved_lost';
    } else if (resolved) {
      threadState = 'resolved';
      threadStateReason =
        summary.outcome === 'won' ? 'resolved_won' : 'resolved_lost';
    } else if (input.sessionDisconnected) {
      threadState = 'blocked_by_safety';
      threadStateReason = 'whatsapp_session_issue';
    } else if (aiState === 'waiting_human') {
      threadState = 'ai_needs_human';
      threadStateReason =
        aiState === 'waiting_human' ? 'ai_low_confidence' : 'unknown';
    } else if (aiState === 'human_handling' || aiPaused) {
      threadState = 'human_handling';
      threadStateReason = 'ai_paused_by_staff';
    } else if (waitingPayment) {
      threadState = 'waiting_payment';
      threadStateReason = 'customer_waiting_payment_details';
    } else if (waitingStock) {
      threadState = 'waiting_stock';
      threadStateReason = 'customer_waiting_stock';
    } else if (followupOverdue) {
      threadState = 'followup_overdue';
      threadStateReason = 'followup_due';
    } else if (followupDue) {
      threadState = 'followup_scheduled';
      threadStateReason = 'followup_due';
    } else if (hotLead && summary.lastDirection === 'incoming') {
      threadState = 'hot_lead';
      threadStateReason = 'hot_lead_priority';
    } else if (aiState === 'ai_handling') {
      threadState = 'ai_handling';
      threadStateReason = 'waiting_customer_response';
    } else if (this.needsReply(summary, preview)) {
      threadState = 'needs_reply';
      threadStateReason = 'latest_customer_message_unanswered';
    } else if (summary.lastDirection === 'outgoing' && this.isAcknowledgment(preview)) {
      threadState = 'waiting_customer';
      threadStateReason = 'customer_acknowledgment_only';
    } else if (summary.lastDirection === 'outgoing') {
      threadState = 'waiting_customer';
      threadStateReason = 'waiting_customer_response';
    } else if (unassigned) {
      threadState = 'unassigned';
      threadStateReason = 'assigned_no_reply';
    } else if (assignedToMe) {
      threadState = 'assigned_to_me';
      threadStateReason = 'assigned_no_reply';
    }

    const needsReply = threadState === 'needs_reply' || threadState === 'hot_lead';
    const needsHuman =
      threadState === 'ai_needs_human' ||
      threadState === 'human_handling' ||
      aiState === 'waiting_human';

    return this.pack(threadState, threadStateReason, {
      needsReply,
      needsHuman,
      waitingCustomer: threadState === 'waiting_customer',
      hotLead,
      followupDue,
      followupOverdue,
      aiStatus: aiState,
      queueStatus: input.hasQueuedSend ? 'queued' : input.hasFailedSend ? 'failed' : null,
      slaStatus: followupOverdue ? 'overdue' : followupDue ? 'due' : null,
      isGroup,
    });
  }

  applyToSummary(summary: ConversationSummary, input: Omit<ThreadStateInput, 'summary'>): void {
    const fields = this.compute({ ...input, summary });
    Object.assign(summary, fields);
  }

  matchesQueue(state: InboxThreadState, queue: InboxWorkQueue, assignedToMe: boolean): boolean {
    switch (queue) {
      case 'all':
        return state !== 'resolved' && state !== 'spam';
      case 'my_work':
        return (
          assignedToMe &&
          state !== 'resolved' &&
          state !== 'spam' &&
          state !== 'waiting_customer'
        );
      case 'needs_reply':
        return state === 'needs_reply' || state === 'hot_lead';
      case 'ai_needs_human':
        return state === 'ai_needs_human' || state === 'human_handling';
      case 'hot_leads':
        return state === 'hot_lead';
      case 'waiting_payment':
        return state === 'waiting_payment';
      case 'waiting_stock':
        return state === 'waiting_stock';
      case 'followup_due':
        return state === 'followup_scheduled' || state === 'followup_overdue';
      case 'unassigned':
        return state === 'unassigned';
      case 'assigned_to_me':
        return assignedToMe;
      case 'groups':
        return state === 'group_lead_only';
      case 'resolved':
        return state === 'resolved';
      case 'failed_sends':
        return state === 'send_failed' || state === 'queued_message_pending';
      default:
        return true;
    }
  }

  countQueues(
    summaries: ConversationSummary[],
    viewerStaffId?: string | null,
  ): InboxQueueCounts {
    const counts: InboxQueueCounts = {
      my_work: 0,
      needs_reply: 0,
      ai_needs_human: 0,
      hot_leads: 0,
      waiting_payment: 0,
      waiting_stock: 0,
      followup_due: 0,
      unassigned: 0,
      assigned_to_me: 0,
      all: 0,
      groups: 0,
      resolved: 0,
      failed_sends: 0,
      failed: 0,
      aiBlocked: 0,
      overdue: 0,
    };

    for (const summary of summaries) {
      const assignedToMe =
        Boolean(viewerStaffId) && summary.assignedStaffId === viewerStaffId;
      const fields = this.compute({ summary, viewerStaffId });
      Object.assign(summary, fields);

      if (this.matchesQueue(fields.threadState, 'all', assignedToMe)) counts.all! += 1;
      if (this.matchesQueue(fields.threadState, 'my_work', assignedToMe)) counts.my_work! += 1;
      if (this.matchesQueue(fields.threadState, 'needs_reply', assignedToMe))
        counts.needs_reply! += 1;
      if (this.matchesQueue(fields.threadState, 'ai_needs_human', assignedToMe))
        counts.ai_needs_human! += 1;
      if (this.matchesQueue(fields.threadState, 'hot_leads', assignedToMe))
        counts.hot_leads! += 1;
      if (this.matchesQueue(fields.threadState, 'waiting_payment', assignedToMe))
        counts.waiting_payment! += 1;
      if (this.matchesQueue(fields.threadState, 'waiting_stock', assignedToMe))
        counts.waiting_stock! += 1;
      if (this.matchesQueue(fields.threadState, 'followup_due', assignedToMe))
        counts.followup_due! += 1;
      if (this.matchesQueue(fields.threadState, 'unassigned', assignedToMe))
        counts.unassigned! += 1;
      if (assignedToMe) counts.assigned_to_me! += 1;
      if (this.matchesQueue(fields.threadState, 'groups', assignedToMe)) counts.groups! += 1;
      if (this.matchesQueue(fields.threadState, 'resolved', assignedToMe)) counts.resolved! += 1;
      if (this.matchesQueue(fields.threadState, 'failed_sends', assignedToMe))
        counts.failed_sends! += 1;
      if (fields.threadState === 'send_failed') counts.failed! += 1;
      if (fields.threadState === 'blocked_by_safety' || fields.threadState === 'opted_out')
        counts.aiBlocked! += 1;
      if (fields.followupOverdue) counts.overdue! += 1;
    }

    return counts;
  }

  private needsReply(summary: ConversationSummary, preview: string): boolean {
    if (summary.resolved) return false;
    if (summary.lastDirection !== 'incoming') return false;
    if (summary.aiOptOut) return false;
    if (summary.chatId.endsWith('@g.us')) return false;
    if (this.isAcknowledgment(preview) && !QUESTION_HINTS.test(preview)) return false;
    return true;
  }

  private isAcknowledgment(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    return ACK_PATTERNS.test(t);
  }

  private pack(
    threadState: InboxThreadState,
    threadStateReason: InboxThreadStateReason,
    rest: Omit<InboxThreadStateFields, 'threadState' | 'threadStateReason'>,
  ): InboxThreadStateFields {
    return { threadState, threadStateReason, ...rest };
  }
}
