import { AiEscalationReason, AiEscalationStatus, StockingReminderStatus } from '../ai-signal.enums';

export interface ThreadDisplayFields {
  customerName: string | null;
  customerPhone: string | null;
  displayName: string | null;
  sessionName: string | null;
}

/** Open escalation row returned by GET /ai/signals/dashboard with resolved display fields. */
export interface AiEscalationDashboardRow {
  id: string;
  sessionId: string;
  chatId: string;
  reason: AiEscalationReason | string;
  detail: string | null;
  status: AiEscalationStatus | string;
  assignedStaffId: string | null;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  displayName: string | null;
  sessionName: string | null;
}

/** Open stocking reminder row with resolved thread/session display fields. */
export interface StockingReminderDashboardRow {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string | null;
  sessionId: string | null;
  chatId: string | null;
  branchId: string | null;
  note: string | null;
  reason: string | null;
  status: StockingReminderStatus | string;
  assignedStaffId: string | null;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  displayName: string | null;
  sessionName: string | null;
}
