import { BadRequestException } from '@nestjs/common';
import { InboxCrmService } from './inbox-crm.service';
import { InboxResolveOutcome } from './dto/inbox-resolve-outcome.enum';

describe('InboxCrmService resolve validation', () => {
  function buildService() {
    const crmRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((row: unknown) => row),
      save: jest.fn().mockImplementation(async (row: { resolved: boolean }) => row),
    };

    return new InboxCrmService(
      crmRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'S' }) } as never,
      {
        getOrCreate: jest.fn(),
        update: jest.fn(),
        updateStage: jest.fn(),
      } as never,
      { createQueueItem: jest.fn() } as never,
      { onThreadCrmUpdated: jest.fn() } as never,
      { logInfo: jest.fn() } as never,
      { resolveOpenEscalations: jest.fn().mockResolvedValue(undefined) } as never,
      { record: jest.fn() } as never,
      { recordFromMessage: jest.fn() } as never,
    );
  }

  it('resolves open AI escalations when staff takes over', async () => {
    const aiSignalService = { resolveOpenEscalations: jest.fn().mockResolvedValue(undefined) };
    const crmRepository = {
      findOne: jest.fn().mockResolvedValue({
        sessionId: 's1',
        chatId: '111@c.us',
        resolved: false,
        aiHandlingState: 'waiting_human',
      }),
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (row: unknown) => row),
    };
    const service = new InboxCrmService(
      crmRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'S' }) } as never,
      {
        getOrCreate: jest.fn(),
        update: jest.fn(),
        updateStage: jest.fn(),
      } as never,
      { createQueueItem: jest.fn() } as never,
      { onThreadCrmUpdated: jest.fn() } as never,
      { logInfo: jest.fn() } as never,
      aiSignalService as never,
      { record: jest.fn() } as never,
      { recordFromMessage: jest.fn() } as never,
    );

    jest.spyOn(service, 'upsertThreadCrm').mockResolvedValue({
      sessionId: 's1',
      chatId: '111@c.us',
    } as never);

    await service.takeOverFromAi('s1', '111@c.us');

    expect(aiSignalService.resolveOpenEscalations).toHaveBeenCalledWith('s1', '111@c.us');
    expect(service.upsertThreadCrm).toHaveBeenCalledWith(
      's1',
      '111@c.us',
      expect.objectContaining({
        aiHandlingState: 'human_handling',
        aiAutoReplyPaused: true,
      }),
    );
  });

  it('requires resolution reason and outcome', async () => {
    const service = buildService();
    await expect(
      service.upsertThreadCrm('s1', '111@c.us', { resolved: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires lostReason when outcome is lost', async () => {
    const service = buildService();
    await expect(
      service.upsertThreadCrm('s1', '111@c.us', {
        resolved: true,
        resolvedReason: 'Too expensive',
        outcome: InboxResolveOutcome.LOST,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
