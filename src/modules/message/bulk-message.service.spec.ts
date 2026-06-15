import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BulkMessageService } from './bulk-message.service';
import { MessageBatch } from './entities/message-batch.entity';
import { SessionService } from '../session/session.service';
import { MessageService } from './message.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';

describe('BulkMessageService', () => {
  let service: BulkMessageService;

  const batchRepository = {
    findOne: jest.fn(),
    create: jest.fn((row: Partial<MessageBatch>) => row),
    save: jest.fn(async (row: MessageBatch) => row),
  };

  const sessionService = {
    getEngine: jest.fn(() => ({})),
  };

  const messageService = {};

  const safetySettings = {
    getForSession: jest.fn(async () => ({
      productBulkSendEnabled: false,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkMessageService,
        { provide: getRepositoryToken(MessageBatch, 'data'), useValue: batchRepository },
        { provide: SessionService, useValue: sessionService },
        { provide: MessageService, useValue: messageService },
        { provide: WhatsAppSafetySettingsService, useValue: safetySettings },
      ],
    }).compile();
    service = module.get(BulkMessageService);
  });

  it('rejects createBatch when bulk sends are disabled', async () => {
    await expect(
      service.createBatch('sess-1', {
        messages: [{ chatId: '123@c.us', text: 'hello' }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(sessionService.getEngine).not.toHaveBeenCalled();
  });

  it('allows createBatch when bulk sends are enabled', async () => {
    safetySettings.getForSession.mockResolvedValueOnce({ productBulkSendEnabled: true });
    batchRepository.findOne.mockResolvedValueOnce(null);
    batchRepository.save.mockImplementationOnce(async (row: MessageBatch) => ({
      ...row,
      id: 'batch-row-1',
    }));

    const result = await service.createBatch('sess-1', {
      messages: [{ chatId: '123@c.us', text: 'hello' }],
    });

    expect(result.sessionId).toBe('sess-1');
    expect(sessionService.getEngine).toHaveBeenCalledWith('sess-1');
  });
});
