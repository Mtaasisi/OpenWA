import { BadRequestException } from '@nestjs/common';
import { InboxThreadPinService } from './inbox-thread-pin.service';

describe('InboxThreadPinService', () => {
  const rows: Array<{
    id: string;
    staffId: string;
    sessionId: string;
    chatId: string;
    label: string | null;
    pinnedAt: Date;
  }> = [];

  const repo = {
    find: jest.fn(async ({ where }: { where: { staffId: string } }) =>
      rows
        .filter(r => r.staffId === where.staffId)
        .sort((a, b) => b.pinnedAt.getTime() - a.pinnedAt.getTime()),
    ),
    findOne: jest.fn(async ({ where }: { where: { staffId: string; sessionId: string; chatId: string } }) =>
      rows.find(
        r =>
          r.staffId === where.staffId &&
          r.sessionId === where.sessionId &&
          r.chatId === where.chatId,
      ) ?? null,
    ),
    count: jest.fn(async ({ where }: { where: { staffId: string } }) =>
      rows.filter(r => r.staffId === where.staffId).length,
    ),
    create: jest.fn((data: (typeof rows)[number]) => data),
    save: jest.fn(async (input: (typeof rows)[number] | (typeof rows)[number][]) => {
      const items = Array.isArray(input) ? input : [input];
      for (const row of items) {
        const idx = rows.findIndex(r => r.id === row.id);
        if (idx >= 0) rows[idx] = row;
        else rows.push({ ...row, id: row.id ?? `pin-${rows.length + 1}` });
      }
      return input;
    }),
    delete: jest.fn(async (criteria: string | { staffId?: string; id?: string }) => {
      if (typeof criteria === 'string') {
        const idx = rows.findIndex(r => r.id === criteria);
        if (idx >= 0) rows.splice(idx, 1);
        return;
      }
      if ('id' in criteria && criteria.id) {
        const idx = rows.findIndex(r => r.id === criteria.id);
        if (idx >= 0) rows.splice(idx, 1);
      } else if (criteria.staffId) {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i].staffId === criteria.staffId) rows.splice(i, 1);
        }
      }
    }),
  };

  const service = new InboxThreadPinService(repo as never);

  beforeEach(() => {
    rows.length = 0;
    jest.clearAllMocks();
  });

  it('pins and unpins a thread', async () => {
    const pinned = await service.toggle('staff-1', 'sess-a', '111@c.us', 'Amina');
    expect(pinned.pinned).toBe(true);
    expect(pinned.pins).toHaveLength(1);

    const unpinned = await service.toggle('staff-1', 'sess-a', '111@c.us');
    expect(unpinned.pinned).toBe(false);
    expect(unpinned.pins).toHaveLength(0);
  });

  it('rejects invalid chat ids', async () => {
    await expect(service.toggle('staff-1', 'sess-a', 'status@broadcast')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('replaces all pins for a staff member', async () => {
    await service.replaceAll('staff-1', [
      { sessionId: 'sess-a', chatId: '111@c.us', label: 'One' },
      { sessionId: 'sess-b', chatId: '222@c.us', label: 'Two' },
    ]);
    const list = await service.listForStaff('staff-1');
    expect(list).toHaveLength(2);
  });
});
