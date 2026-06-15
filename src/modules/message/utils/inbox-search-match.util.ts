import type { InboxThreadCrm } from '../entities/inbox-thread-crm.entity';
import type { InboxThreadSummary } from '../entities/inbox-thread-summary.entity';

export type InboxSearchMatchReason =
  | 'display_name'
  | 'chat_id'
  | 'last_message'
  | 'customer_name'
  | 'customer_phone'
  | 'product_interest'
  | 'message_body';

type FollowupSearchFields = {
  customerName?: string | null;
  productInterest?: string | null;
};

function includesQuery(value: string | null | undefined, query: string): boolean {
  if (!value?.trim()) return false;
  return value.toLowerCase().includes(query);
}

export function resolveThreadSearchMatchReason(
  query: string,
  summary: Pick<InboxThreadSummary, 'displayName' | 'chatId' | 'lastPreview'>,
  crm?: InboxThreadCrm | null,
  followup?: FollowupSearchFields | null,
): InboxSearchMatchReason {
  const q = query.trim().toLowerCase();
  if (!q) return 'message_body';

  if (includesQuery(summary.displayName, q)) return 'display_name';
  if (includesQuery(crm?.customerName, q)) return 'customer_name';
  if (includesQuery(followup?.customerName, q)) return 'customer_name';
  if (includesQuery(crm?.customerPhone, q)) return 'customer_phone';
  if (includesQuery(followup?.productInterest, q)) return 'product_interest';
  if (includesQuery(summary.lastPreview, q)) return 'last_message';
  if (includesQuery(summary.chatId, q)) return 'chat_id';
  return 'message_body';
}
