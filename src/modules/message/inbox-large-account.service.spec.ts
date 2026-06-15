import { MessageService } from './message.service';
import { SessionStatus } from '../session/entities/session.entity';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { MessageDirection } from './entities/message.entity';
import { InboxThreadStateService } from './inbox-thread-state.service';
import type { InboxThreadSummary } from './entities/inbox-thread-summary.entity';

const ctx = { apiKeyId: 'staff-1', role: ApiKeyRole.ADMIN };

function buildSummary(id: string, sessionId = 'sess-a'): InboxThreadSummary {
  return {
    id,
    sessionId,
    chatId: `${id}@c.us`,
    lastMessageAt: new Date('2024-06-01T12:00:00.000Z'),
    lastTimestamp: 1,
    lastPreview: 'hi',
    lastMessageType: 'text',
    lastMessageId: `msg-${id}`,
    lastDirection: MessageDirection.INCOMING,
    messageCount: 1,
    displayName: id,
    unreadCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as InboxThreadSummary;
}

function buildService(threadTotal = 100) {
  const session = {
    id: 'sess-a',
    name: 'Main',
    status: SessionStatus.READY,
    phone: '+111',
    pushName: 'Main',
    config: {},
  };

  const engine = {
    listChats: jest.fn().mockResolvedValue([]),
    getProfilePicture: jest.fn().mockResolvedValue(null),
  };

  const inboxThreadSummaryService = {
    countThreads: jest.fn().mockResolvedValue(threadTotal),
    queryPage: jest.fn().mockResolvedValue({
      summaries: [buildSummary('111')],
      total: threadTotal,
    }),
    listHistorySyncCandidates: jest.fn().mockResolvedValue({ chatIds: ['111@c.us'], total: 1 }),
    searchThreadsLight: jest.fn().mockResolvedValue({ rows: [buildSummary('111')], total: 1 }),
    touchFromMessage: jest.fn(),
  };

  const messageRepository = {
    exist: jest.fn().mockResolvedValue(false),
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'engine.wa.largeAccountThreshold') return 50;
      if (key === 'engine.wa.queueCountsCacheTtlMs') return 60_000;
      if (key === 'engine.wa.largeAccountCountsSampleLimit') return 500;
      if (key === 'engine.wa.defaultActiveSinceDays') return 90;
      if (key === 'engine.wa.largeAccountHotTierDays') return 30;
      if (key === 'engine.wa.largeAccountColdResolvedDays') return 180;
      if (key === 'engine.wa.largeAccountHotTierSize') return 500;
      return fallback;
    }),
  };

  const service = new MessageService(
    messageRepository as never,
    { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() } as never,
    {
      findAll: jest.fn().mockResolvedValue([session]),
      findOne: jest.fn().mockResolvedValue(session),
      getEngine: jest.fn().mockReturnValue(engine),
      isBackgroundSyncing: jest.fn().mockReturnValue(false),
    } as never,
    { execute: jest.fn() } as never,
    {} as never,
    { getCrmMapForSession: jest.fn().mockResolvedValue(new Map()) } as never,
    { getInboxEnrichmentMapForThreads: jest.fn().mockResolvedValue(new Map()) } as never,
    {} as never,
    { getCachedUrl: jest.fn() } as never,
    configService as never,
    {} as never,
    inboxThreadSummaryService as never,
    new InboxThreadStateService(),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  jest.spyOn(service, 'countUnreadIncoming').mockResolvedValue(0);
  jest.spyOn(service as never, 'staffNameMap' as never).mockResolvedValue(new Map());
  jest.spyOn(service as never, 'applyThreadStateToPage' as never).mockResolvedValue(undefined);

  return { service, engine, inboxThreadSummaryService, messageRepository };
}

describe('MessageService large inbox loading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips queue counts on list fetch when includeCounts is false', async () => {
    const { service } = buildService();
    const queueSpy = jest.spyOn(service, 'queryInboxQueueCounts');

    await service.queryUnifiedConversations({ limit: 50, offset: 0, includeCounts: false }, ctx);

    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('passes skipLiveEngine to enrichConversationPage for large accounts', async () => {
    const { service } = buildService(5000);
    const enrichSpy = jest
      .spyOn(service as never, 'enrichConversationPage' as never)
      .mockResolvedValue(undefined as never);

    await service.queryUnifiedConversations({ limit: 50, offset: 0 }, ctx);

    expect(enrichSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      { skipLiveEngine: true },
    );
  });

  it('returns largeAccountMode metadata for large accounts', async () => {
    const { service, inboxThreadSummaryService } = buildService(5000);
    const summaries = Array.from({ length: 50 }, (_, i) => buildSummary(String(i)));
    inboxThreadSummaryService.queryPage.mockResolvedValue({
      summaries,
      total: 5000,
    });
    jest.spyOn(service as never, 'enrichConversationPage' as never).mockResolvedValue(undefined as never);

    const result = await service.queryUnifiedConversations({ limit: 50, offset: 0 }, ctx);

    expect(result.largeAccountMode).toBe(true);
    expect(result.totalApproximate).toBe(true);
    expect(result.threadTotal).toBe(5000);
    expect(result.hasMore).toBe(true);
  });

  it('forwards excludeColdResolved to thread query page', async () => {
    const { service, inboxThreadSummaryService } = buildService(5000);
    jest.spyOn(service as never, 'enrichConversationPage' as never).mockResolvedValue(undefined as never);

    await service.queryUnifiedConversations(
      { limit: 50, excludeColdResolved: true, coldResolvedDays: 180 },
      ctx,
    );

    expect(inboxThreadSummaryService.queryPage).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ excludeColdResolved: true, coldResolvedDays: 180 }),
      ctx,
      expect.objectContaining({ skipExactTotal: true }),
    );
  });

  it('recommends single session when unified query spans large accounts', async () => {
    const { service, inboxThreadSummaryService } = buildService(5000);
    inboxThreadSummaryService.queryPage.mockResolvedValue({
      summaries: Array.from({ length: 50 }, (_, i) => buildSummary(String(i))),
      total: 5000,
    });
    jest.spyOn(service as never, 'enrichConversationPage' as never).mockResolvedValue(undefined as never);
    jest.spyOn(service, 'resolveInboxSessionIdsAsync').mockResolvedValue(['sess-a', 'sess-b']);

    const result = await service.queryUnifiedConversations({ limit: 50, offset: 0 }, ctx);

    expect(result.recommendSingleSession).toBe(true);
  });

  it('tags visible rows with threadTier for large accounts', async () => {
    const { service, inboxThreadSummaryService } = buildService(5000);
    const summaries = [
      {
        ...buildSummary('recent'),
        lastMessageAt: new Date(),
        messageCount: 20,
      },
      {
        ...buildSummary('warm'),
        lastMessageAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        messageCount: 1,
      },
    ];
    inboxThreadSummaryService.queryPage.mockResolvedValue({ summaries, total: 5000 });
    jest.spyOn(service as never, 'enrichConversationSummaries' as never).mockImplementation(
      async (page: unknown[]) => page as never,
    );
    jest.spyOn(service as never, 'applyThreadStateToPage' as never).mockResolvedValue(undefined as never);

    const result = await service.queryUnifiedConversations({ limit: 50, offset: 0 }, ctx);

    expect(result.largeAccountDefaults?.activeSinceDays).toBe(90);
    expect(result.conversations.some(c => c.threadTier === 'hot')).toBe(true);
    expect(result.conversations.some(c => c.threadTier === 'warm')).toBe(true);
  });

  it('caches queue counts between calls', async () => {
    const { service } = buildService(5000);
    jest.spyOn(service as never, 'enrichConversationPage' as never).mockResolvedValue(undefined as never);

    const first = await service.queryInboxQueueCounts({}, ctx);
    const second = await service.queryInboxQueueCounts({}, ctx);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  });

  it('uses DB history sync candidates instead of listChats for large accounts', async () => {
    const { service, engine, inboxThreadSummaryService } = buildService(5000);
    jest.spyOn(service, 'importChatHistoryFromEngine').mockResolvedValue(2);

    await service.runBackgroundHistoryBatch('sess-a', 5, 0, 40, 0, { hotTierOnly: true });

    expect(inboxThreadSummaryService.listHistorySyncCandidates).toHaveBeenCalledWith(
      'sess-a',
      0,
      5,
      expect.objectContaining({ hotTierOnly: true }),
    );
    expect(engine.listChats).not.toHaveBeenCalled();
  });
});
