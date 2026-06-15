import type { InboxConversationsQueryDto, InboxQueryContext } from './dto/inbox-conversations-query.dto';

const STAFF_SCOPED_QUEUES = new Set(['my_work', 'assigned_to_me']);

/** Resolve the staff id used for my-work / assigned-to-me inbox filters. */
export function resolveInboxViewerStaffId(
  query: InboxConversationsQueryDto,
  ctx: InboxQueryContext,
): string | undefined {
  const explicit = query.assignedStaffId?.trim();
  if (explicit) return explicit;

  if (query.assignedToMe || (query.queue && STAFF_SCOPED_QUEUES.has(query.queue))) {
    return ctx.apiKeyId || undefined;
  }

  return undefined;
}
