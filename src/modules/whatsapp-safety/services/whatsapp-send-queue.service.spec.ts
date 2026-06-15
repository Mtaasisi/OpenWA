import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsAppSendQueueService } from './whatsapp-send-queue.service';
import { WhatsAppSendQueue } from '../entities/whatsapp-send-queue.entity';
import {
  GuardRequiredAction,
  WhatsAppMessageType,
  WhatsAppQueueStatus,
  WhatsAppRiskLevel,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';

describe('WhatsAppSendQueueService', () => {
  let service: WhatsAppSendQueueService;
  const rows: WhatsAppSendQueue[] = [];

  const repo = {
    create: jest.fn((data: Partial<WhatsAppSendQueue>) => ({ id: `q-${rows.length + 1}`, ...data })),
    save: jest.fn(async (row: WhatsAppSendQueue) => {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      return row;
    }),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      rows.find(r => r.id === where.id) ?? null,
    ),
    update: jest.fn(async (id: string, patch: Partial<WhatsAppSendQueue>) => {
      const row = rows.find(r => r.id === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
    find: jest.fn(async () => rows),
    createQueryBuilder: jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => rows),
      getCount: jest.fn(async () => rows.length),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rows.length = 0;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppSendQueueService,
        { provide: getRepositoryToken(WhatsAppSendQueue, 'data'), useValue: repo },
      ],
    }).compile();
    service = module.get(WhatsAppSendQueueService);
  });

  it('enqueues pending rows for queue decisions', async () => {
    const row = await service.enqueue({
      sessionId: 'sess-1',
      chatId: '255700000000@c.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      messageBody: 'Hello',
      guardDecision: {
        allowed: false,
        reason: 'Automated send queued',
        requiredAction: GuardRequiredAction.QUEUE,
        riskLevel: WhatsAppRiskLevel.LOW,
        guardChecks: {},
      },
    });
    expect(row.status).toBe(WhatsAppQueueStatus.PENDING);
  });

  it('marks approval-required rows when guard requires approval', async () => {
    const row = await service.enqueue({
      sessionId: 'sess-1',
      chatId: '255700000000@c.us',
      messageType: WhatsAppMessageType.FOLLOW_UP,
      source: WhatsAppSendSource.FOLLOWUP,
      messageBody: 'Follow up',
      guardDecision: {
        allowed: false,
        reason: 'Needs approval',
        requiredAction: GuardRequiredAction.REQUIRE_APPROVAL,
        riskLevel: WhatsAppRiskLevel.MEDIUM,
        guardChecks: {},
      },
    });
    expect(row.status).toBe(WhatsAppQueueStatus.APPROVAL_REQUIRED);
  });

  it('approves queued messages for sending', async () => {
    rows.push({
      id: 'q-1',
      sessionId: 'sess-1',
      chatId: '255700000000@c.us',
      status: WhatsAppQueueStatus.APPROVAL_REQUIRED,
    } as WhatsAppSendQueue);

    const approved = await service.approve('q-1', 'admin-1');
    expect(approved?.status).toBe(WhatsAppQueueStatus.PENDING);
    expect(approved?.approvedBy).toBe('admin-1');
  });
});
