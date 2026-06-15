import { BadRequestException } from '@nestjs/common';
import { InboxTransferService } from './inbox-transfer.service';

describe('InboxTransferService', () => {
  it('requires transfer reason', async () => {
    const service = new InboxTransferService(
      {} as never,
      {} as never,
      {
        findOne: jest.fn(),
      } as never,
      {
        hasInboxThread: jest.fn(),
      } as never,
      { logInfo: jest.fn() } as never,
      { transaction: jest.fn() } as never,
    );

    const apiKey = { id: 'op-1', name: 'Op', allowedSessions: null } as never;

    await expect(
      service.transferChat(apiKey, {
        fromSessionId: 'a',
        toSessionId: 'b',
        chatId: '111@c.us',
        reason: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
