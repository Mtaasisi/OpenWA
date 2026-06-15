import { ConversationPriority, ConversationSource, ConversationStage, LostReason } from './followup.enums';

/** Batch CRM/pipeline fields attached to unified inbox conversation rows. */
export interface FollowupInboxEnrichment {
  customerName: string | null;
  customerPhone: string | null;
  source: ConversationSource;
  branchId: string | null;
  assignedStaffId: string | null;
  stage: ConversationStage;
  priority: ConversationPriority;
  productInterest: string | null;
  outcome: string | null;
  lostReason: LostReason | null;
  lastCustomerMessageAt: Date | null;
  lastStaffMessageAt: Date | null;
  responseTimeSeconds: number | null;
  nextFollowupAt: Date | null;
  /** Thread-level follow-up autopilot pause (from inbox_thread_crm). */
  followupAutopilotPaused?: boolean;
}
