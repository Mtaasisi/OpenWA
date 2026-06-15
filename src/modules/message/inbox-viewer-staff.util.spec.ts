import { resolveInboxViewerStaffId } from './inbox-viewer-staff.util';
import type { InboxConversationsQueryDto, InboxQueryContext } from './dto/inbox-conversations-query.dto';

describe('resolveInboxViewerStaffId', () => {
  const ctx: InboxQueryContext = { apiKeyId: 'key-1', role: 'operator' };

  it('prefers explicit assignedStaffId', () => {
    const query = { assignedStaffId: 'staff-9', queue: 'my_work' } as InboxConversationsQueryDto;
    expect(resolveInboxViewerStaffId(query, ctx)).toBe('staff-9');
  });

  it('uses api key for my_work queue', () => {
    const query = { queue: 'my_work' } as InboxConversationsQueryDto;
    expect(resolveInboxViewerStaffId(query, ctx)).toBe('key-1');
  });

  it('uses api key for assigned_to_me queue', () => {
    const query = { queue: 'assigned_to_me' } as InboxConversationsQueryDto;
    expect(resolveInboxViewerStaffId(query, ctx)).toBe('key-1');
  });

  it('returns undefined for unrelated queues', () => {
    const query = { queue: 'needs_reply' } as InboxConversationsQueryDto;
    expect(resolveInboxViewerStaffId(query, ctx)).toBeUndefined();
  });
});
