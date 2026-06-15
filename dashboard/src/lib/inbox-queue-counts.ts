import type { InboxQueueCounts } from '../services/api';
import type { ConversationFilter } from '../pages/inbox-helpers';
import { getInboxFilterBadgeCount } from '../pages/inbox-features';
import type { Conversation } from '../services/api';

export type InboxBadgeCountOptions = {
  myStaffId?: string | null;
  queueCounts?: InboxQueueCounts | null;
  /** When true, ignore server counts (search, lead source, non-WhatsApp channel filters). */
  preferClientCounts?: boolean;
};

function serverCountForFilter(filter: ConversationFilter, counts: InboxQueueCounts): number | null {
  switch (filter) {
    case 'needs_reply':
      return counts.needs_reply ?? null;
    case 'needs_human':
      return counts.ai_needs_human ?? null;
    case 'assigned_to_me':
      return counts.assigned_to_me ?? null;
    case 'overdue':
      return counts.overdue ?? counts.followup_due ?? null;
    case 'all':
      return counts.all ?? null;
    case 'groups':
      return counts.groups ?? null;
    case 'resolved':
      return counts.resolved ?? null;
    case 'hot_leads':
      return counts.hot_leads ?? null;
    case 'my_work':
      return counts.my_work ?? null;
    case 'waiting_payment':
      return counts.waiting_payment ?? null;
    case 'waiting_stock':
      return counts.waiting_stock ?? null;
    case 'unassigned':
      return counts.unassigned ?? null;
    case 'failed_sends':
      return counts.failed_sends ?? counts.failed ?? null;
    case 'ai_opt_out':
      return counts.aiBlocked ?? null;
    default:
      return null;
  }
}

/** Prefer server queue totals when available; fall back to loaded conversation page. */
export function resolveInboxFilterBadgeCount(
  key: ConversationFilter,
  conversations: Conversation[],
  searchQuery: string,
  options?: InboxBadgeCountOptions,
): number {
  const canUseServer =
    !options?.preferClientCounts &&
    !searchQuery.trim() &&
    options?.queueCounts != null;

  if (canUseServer) {
    const server = serverCountForFilter(key, options.queueCounts!);
    if (server != null) return server;
  }

  return getInboxFilterBadgeCount(key, conversations, searchQuery, options);
}
