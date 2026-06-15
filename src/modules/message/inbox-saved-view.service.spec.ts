import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboxSavedViewService } from './inbox-saved-view.service';
import { InboxSavedView } from './entities/inbox-saved-view.entity';

describe('InboxSavedViewService', () => {
  let service: InboxSavedViewService;

  const rows: InboxSavedView[] = [];
  const repo = {
    find: jest.fn(async ({ where, order, take }: { where: { staffId: string }; order: object; take: number }) => {
      void order;
      void take;
      return rows.filter(r => r.staffId === where.staffId).sort((a, b) => a.sortOrder - b.sortOrder);
    }),
    count: jest.fn(async ({ where }: { where: { staffId: string } }) =>
      rows.filter(r => r.staffId === where.staffId).length,
    ),
    findOne: jest.fn(async ({ where }: { where: { id: string; staffId: string } }) =>
      rows.find(r => r.id === where.id && r.staffId === where.staffId) ?? null,
    ),
    create: jest.fn((input: Partial<InboxSavedView>) => ({ id: `view-${rows.length + 1}`, ...input })),
    save: jest.fn(async (input: InboxSavedView) => {
      const idx = rows.findIndex(r => r.id === input.id);
      const saved = {
        ...input,
        createdAt: input.createdAt ?? new Date(),
        updatedAt: new Date(),
      } as InboxSavedView;
      if (idx >= 0) rows[idx] = saved;
      else rows.push(saved);
      return saved;
    }),
    delete: jest.fn(async ({ id, staffId }: { id: string; staffId: string }) => {
      const idx = rows.findIndex(r => r.id === id && r.staffId === staffId);
      if (idx < 0) return { affected: 0 };
      rows.splice(idx, 1);
      return { affected: 1 };
    }),
  };

  beforeEach(async () => {
    rows.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxSavedViewService,
        { provide: getRepositoryToken(InboxSavedView, 'data'), useValue: repo },
      ],
    }).compile();

    service = module.get(InboxSavedViewService);
  });

  it('creates and lists saved views for staff', async () => {
    const created = await service.create('staff-1', 'Hot queue', {
      filter: 'hot_leads',
      hideGroups: true,
    });
    expect(created.name).toBe('Hot queue');
    expect(created.config.filter).toBe('hot_leads');
    expect(created.config.hideGroups).toBe(true);

    const list = await service.listForStaff('staff-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it('rejects invalid filter', async () => {
    await expect(
      service.create('staff-1', 'Bad', { filter: 'not_a_filter' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates and deletes a saved view', async () => {
    const created = await service.create('staff-1', 'Mine', { filter: 'my_work' });
    const updated = await service.update('staff-1', created.id, { name: 'My queue' });
    expect(updated.name).toBe('My queue');

    await service.remove('staff-1', created.id);
    await expect(service.update('staff-1', created.id, { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
