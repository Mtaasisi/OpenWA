import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WhatsAppGroupSafetyService } from './whatsapp-group-safety.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

describe('WhatsAppGroupSafetyService', () => {
  let service: WhatsAppGroupSafetyService;
  const settingsService = {
    getForSession: jest.fn(async () => ({
      groupManagementEnabled: false,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppGroupSafetyService,
        { provide: WhatsAppSafetySettingsService, useValue: settingsService },
      ],
    }).compile();
    service = module.get(WhatsAppGroupSafetyService);
  });

  it('blocks when group management is disabled', async () => {
    await expect(
      service.assertGroupManagementAllowed('sess-1', { confirm: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires confirm flag', async () => {
    settingsService.getForSession.mockResolvedValueOnce({ groupManagementEnabled: true });
    await expect(service.assertGroupManagementAllowed('sess-1')).rejects.toThrow(/confirm/);
  });

  it('allows when enabled and confirmed', async () => {
    settingsService.getForSession.mockResolvedValueOnce({ groupManagementEnabled: true });
    await expect(
      service.assertGroupManagementAllowed('sess-1', { confirm: true }),
    ).resolves.toBeUndefined();
  });
});
