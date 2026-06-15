/** Normalized operational thread state for inbox work queues. */
export type InboxThreadState =
  | 'needs_reply'
  | 'waiting_customer'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'ai_handling'
  | 'ai_needs_human'
  | 'human_handling'
  | 'followup_scheduled'
  | 'followup_overdue'
  | 'hot_lead'
  | 'unassigned'
  | 'assigned_to_me'
  | 'resolved'
  | 'spam'
  | 'group_lead_only'
  | 'opted_out'
  | 'blocked_by_safety'
  | 'queued_message_pending'
  | 'send_failed'
  | 'idle';

export type InboxThreadStateReason =
  | 'latest_customer_message_unanswered'
  | 'customer_acknowledgment_only'
  | 'customer_waiting_payment_details'
  | 'customer_waiting_stock'
  | 'ai_low_confidence'
  | 'ai_paused_by_staff'
  | 'customer_opted_out'
  | 'whatsapp_session_issue'
  | 'queue_failed'
  | 'followup_due'
  | 'assigned_no_reply'
  | 'resolved_won'
  | 'resolved_lost'
  | 'group_ai_disabled'
  | 'hot_lead_priority'
  | 'waiting_customer_response'
  | 'unknown';

export type InboxWorkQueue =
  | 'my_work'
  | 'needs_reply'
  | 'ai_needs_human'
  | 'hot_leads'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'followup_due'
  | 'unassigned'
  | 'assigned_to_me'
  | 'all'
  | 'groups'
  | 'resolved'
  | 'failed_sends';

export interface InboxThreadStateFields {
  threadState: InboxThreadState;
  threadStateReason: InboxThreadStateReason;
  needsReply: boolean;
  needsHuman: boolean;
  waitingCustomer: boolean;
  hotLead: boolean;
  followupDue: boolean;
  followupOverdue: boolean;
  aiStatus: string;
  queueStatus: string | null;
  slaStatus: string | null;
  isGroup: boolean;
}

export type InboxQueueCounts = Partial<Record<InboxWorkQueue, number>> & {
  failed?: number;
  aiBlocked?: number;
  overdue?: number;
};
