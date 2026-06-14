import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiLearningItemsService } from './ai-learning-items.service';
import { AiLearningItem } from './entities/ai-learning-item.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import {
  AiLearningItemSource,
  AiLearningItemStatus,
} from './ai-learning.enums';
import { AiLearningKnowledgeService } from './ai-learning-knowledge.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { MessageService } from '../message/message.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { ProductDemandService } from './product-demand.service';

function createItemStore() {
  const rows: AiLearningItem[] = [];
  let seq = 0;

  const repo = {
    create: jest.fn((data: Partial<AiLearningItem>) => ({
      id: `learn-${++seq}`,
      createdAt: new Date(),
      timesAsked: 1,
      confidenceScore: 0,
      priority: 'medium',
      ...data,
    })),
    save: jest.fn(async (row: AiLearningItem) => {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      return row;
    }),
    findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
      const w = opts.where;
      if (w.id) return rows.find(r => r.id === w.id) ?? null;
      if (w.normalizedQuestion) {
        return (
          rows.find(
            r =>
              r.normalizedQuestion === w.normalizedQuestion &&
              (r.status === AiLearningItemStatus.PENDING_REVIEW ||
                r.status === AiLearningItemStatus.SUGGESTED),
          ) ?? null
        );
      }
      return null;
    }),
    find: jest.fn(async () => rows),
    count: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
      if (!opts?.where) return rows.length;
      return rows.filter(r => Object.entries(opts.where!).every(([k, v]) => (r as never)[k] === v)).length;
    }),
    createQueryBuilder: jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => rows),
      getRawOne: jest.fn(async () => null),
    })),
  };

  return { repo, rows };
}

describe('AiLearningItemsService inbox→pending pipeline', () => {
  let service: AiLearningItemsService;
  let store: ReturnType<typeof createItemStore>;
  let knowledge: { createFromApproval: jest.Mock };

  const settings = {
    enableLearningDetection: true,
    autoCreatePendingQuestion: true,
    autoSuggestDraftAnswer: false,
    trackRepeatedQuestions: true,
    trackStaffCorrections: true,
  };

  beforeEach(async () => {
    store = createItemStore();
    knowledge = {
      createFromApproval: jest.fn(async () => ({ id: 'knowledge-1' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiLearningItemsService,
        { provide: getRepositoryToken(AiLearningItem, 'data'), useValue: store.repo },
        { provide: getRepositoryToken(InboxThreadCrm, 'data'), useValue: { count: jest.fn(async () => 0) } },
        { provide: AiLearningKnowledgeService, useValue: knowledge },
        { provide: AiLearningSettingsService, useValue: { getSettings: jest.fn(async () => settings) } },
        { provide: MessageService, useValue: {} },
        { provide: InboxCrmService, useValue: {} },
        { provide: ProductDemandService, useValue: { getDashboardCounts: jest.fn(async () => ({ outOfStockDemand: 0, installmentDemand: 0 })) } },
      ],
    }).compile();

    service = module.get(AiLearningItemsService);
  });

  it('createFromLowConfidence creates a pending review item from inbox context', async () => {
    const item = await service.createFromLowConfidence({
      question: 'Bei ya iPhone 14?',
      sessionId: 'sess-1',
      chatId: '255@c.us',
      confidenceScore: 0.25,
    });

    expect(item).not.toBeNull();
    expect(item!.status).toBe(AiLearningItemStatus.PENDING_REVIEW);
    expect(item!.source).toBe(AiLearningItemSource.AUTO_UNKNOWN);
    expect(item!.sessionId).toBe('sess-1');
    expect(store.rows).toHaveLength(1);
  });

  it('createFromLowConfidence returns null when auto-create is disabled', async () => {
    settings.autoCreatePendingQuestion = false;
    const item = await service.createFromLowConfidence({
      question: 'Bei ya simu?',
      confidenceScore: 0.2,
    });
    expect(item).toBeNull();
    expect(store.rows).toHaveLength(0);
    settings.autoCreatePendingQuestion = true;
  });

  it('repeated unknown question increments timesAsked instead of duplicating', async () => {
    await service.createFromLowConfidence({
      question: 'Bei ya iPhone 14?',
      confidenceScore: 0.3,
    });
    const second = await service.createFromLowConfidence({
      question: 'bei ya iphone 14?',
      confidenceScore: 0.2,
    });

    expect(store.rows).toHaveLength(1);
    expect(second!.timesAsked).toBe(2);
  });

  it('approveItem promotes pending item to approved knowledge', async () => {
    const pending = await service.createFromLowConfidence({
      question: 'Warranty policy?',
      sessionId: 'sess-2',
      chatId: '255@c.us',
      confidenceScore: 0.3,
    });

    const result = await service.approveItem(pending!.id, {
      adminFinalAnswer: 'Warranty is 12 months.',
      targetFile: 'WARRANTY_RULES.md',
      approvedBy: 'admin@test',
    });

    expect(result.item.status).toBe(AiLearningItemStatus.APPROVED);
    expect(result.knowledgeId).toBe('knowledge-1');
    expect(knowledge.createFromApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        questionPattern: 'Warranty policy?',
        approvedAnswer: 'Warranty is 12 months.',
        sourceItemId: pending!.id,
      }),
    );
  });
});
