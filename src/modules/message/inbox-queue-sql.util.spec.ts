import { applyInboxQueueSqlFilter } from './inbox-queue-sql.util';

function mockQb() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const qb = {
    andWhere: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'andWhere', args });
      return qb;
    }),
    setParameter: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'setParameter', args });
      return qb;
    }),
  };
  return { qb, calls };
}

describe('applyInboxQueueSqlFilter', () => {
  it('filters assigned_to_me by viewer staff id', () => {
    const { qb } = mockQb();
    applyInboxQueueSqlFilter(qb as never, 'assigned_to_me', 'staff-42');
    expect(qb.andWhere).toHaveBeenCalledWith('fc.assignedStaffId = :queueViewerStaffId', {
      queueViewerStaffId: 'staff-42',
    });
  });

  it('filters ai_needs_human by AI handling states', () => {
    const { qb } = mockQb();
    applyInboxQueueSqlFilter(qb as never, 'ai_needs_human');
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('filters groups by chat suffix', () => {
    const { qb } = mockQb();
    applyInboxQueueSqlFilter(qb as never, 'groups');
    expect(qb.andWhere).toHaveBeenCalledWith('s.chatId LIKE :groupSuffix', {
      groupSuffix: '%@g.us',
    });
  });

  it('skips assigned_to_me without viewer staff id', () => {
    const { qb } = mockQb();
    applyInboxQueueSqlFilter(qb as never, 'assigned_to_me', null);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});
