import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WhatsAppStatusSafetyService } from './whatsapp-status-safety.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

describe('WhatsAppStatusSafetyService', () => {
  let service: WhatsAppStatusSafetyService;
  const settingsService = {
    getForSession: jest.fn(async () => ({
      statusPostsEnabled: false,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppStatusSafetyService,
        { provide: WhatsAppSafetySettingsService, useValue: settingsService },
      ],
    }).compile();
    service = module.get(WhatsAppStatusSafetyService);
  });

  it('blocks when status posts are disabled', async () => {
    await expect(service.assertStatusPostAllowed('sess-1')).rejects.toThrow(BadRequestException);
  });

  it('allows when status posts are enabled', async () => {
    settingsService.getForSession.mockResolvedValueOnce({ statusPostsEnabled: true });
    await expect(service.assertStatusPostAllowed('sess-1')).resolves.toBeUndefined();
  });
});
