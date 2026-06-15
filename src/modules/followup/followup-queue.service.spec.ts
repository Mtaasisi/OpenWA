import { FollowupQueueService } from './followup-queue.service';
import { FollowUpStatus, FollowUpAttemptMode, ConversationStage } from './followup.enums';

describe('FollowupQueueService duplicate prevention', () => {
  const queueRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const convRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const attemptRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  let service: FollowupQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FollowupQueueService(
      queueRepo as never,
      attemptRepo as never,
      convRepo as never,
      { findOne: jest.fn() } as never,
      { findById: jest.fn() } as never,
      { findAll: jest.fn(), findById: jest.fn() } as never,
      { sendText: jest.fn() } as never,
      { isReady: jest.fn() } as never,
      { emitFollowupAlert: jest.fn() } as never,
      { findAll: jest.fn() } as never,
      { logInfo: jest.fn() } as never,
      { sendAutopilotMessage: jest.fn() } as never,
      { log: jest.fn() } as never,
    );
  });

  it('canApplyRule returns false when pending item exists for rule', async () => {
    queueRepo.findOne.mockResolvedValueOnce({ id: 'q1', status: FollowUpStatus.PENDING });
    const result = await service.canApplyRule('conv-1', {
      id: 'rule-1',
      stage: ConversationStage.PRICE_SENT,
      maxAttempts: 3,
      delayMinutes: 60,
    } as never);
    expect(result).toBe(false);
  });

  it('cancelPendingForConversation marks pending items cancelled', async () => {
    const pending = [
      { id: 'q1', status: FollowUpStatus.PENDING, notes: null },
      { id: 'q2', status: FollowUpStatus.DUE, notes: null },
    ];
    queueRepo.find.mockResolvedValue(pending);
    convRepo.findOne.mockResolvedValue({ sessionId: 'sess-1' });
    queueRepo.save.mockResolvedValue(pending);

    const count = await service.cancelPendingForConversation('conv-1', 'customer_replied');
    expect(count).toBe(2);
    expect(queueRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: FollowUpStatus.CANCELLED }),
      ]),
    );
  });

  it('isWithinAutomatedSendLimits respects session cap', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(500),
    };
    attemptRepo.createQueryBuilder.mockReturnValue(qb);

    const ok = await service.isWithinAutomatedSendLimits('sess-1', null);
    expect(ok).toBe(false);
    expect(qb.andWhere).toHaveBeenCalledWith('a.mode = :mode', { mode: FollowUpAttemptMode.AUTO_SEND });
  });
});
