import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WhatsAppCloudTemplateSyncService } from './whatsapp-cloud-template-sync.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { FollowupMessageTemplate } from '../../followup/entities/followup-message-template.entity';
import { WhatsAppTemplateStatus } from '../../followup/followup.enums';

describe('WhatsAppCloudTemplateSyncService', () => {
  let service: WhatsAppCloudTemplateSyncService;

  const templateRepo = {
    find: jest.fn(),
    save: jest.fn(async (row: FollowupMessageTemplate) => row),
  };

  const settingsService = {
    getGlobal: jest.fn(async () => ({
      whatsappCloudSyncEnabled: true,
      whatsappCloudWabaId: 'waba-123',
      whatsappCloudLastSyncAt: null,
      whatsappCloudLastSyncSummary: null,
    })),
    updateGlobal: jest.fn(async (patch: Record<string, unknown>) => ({ ...patch })),
  };

  const configService = {
    get: jest.fn((key: string) => (key === 'WHATSAPP_CLOUD_ACCESS_TOKEN' ? 'token-abc' : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) =>
      key === 'WHATSAPP_CLOUD_ACCESS_TOKEN' ? 'token-abc' : undefined,
    );
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ name: 'order_update', status: 'APPROVED', language: 'en' }],
      }),
    })) as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppCloudTemplateSyncService,
        { provide: getRepositoryToken(FollowupMessageTemplate, 'data'), useValue: templateRepo },
        { provide: WhatsAppSafetySettingsService, useValue: settingsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(WhatsAppCloudTemplateSyncService);
  });

  it('maps Meta statuses to local enum', () => {
    expect(service.mapMetaStatus('APPROVED')).toBe(WhatsAppTemplateStatus.APPROVED);
    expect(service.mapMetaStatus('REJECTED')).toBe(WhatsAppTemplateStatus.REJECTED);
    expect(service.mapMetaStatus('PENDING')).toBe(WhatsAppTemplateStatus.PENDING);
  });

  it('testCloudConnection returns error when token is missing', async () => {
    configService.get.mockReturnValueOnce(undefined);

    const result = await service.testCloudConnection();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('WHATSAPP_CLOUD_ACCESS_TOKEN');
  });

  it('testCloudConnection succeeds when WABA and token are valid', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'waba-123', name: 'Test WABA' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: 'order_update', status: 'APPROVED' },
            { name: 'promo_offer', status: 'PENDING' },
          ],
        }),
      }) as unknown as typeof fetch;

    const result = await service.testCloudConnection();

    expect(result.ok).toBe(true);
    expect(result.wabaName).toBe('Test WABA');
    expect(result.templateCount).toBe(2);
  });

  it('syncs matching templates from Meta Cloud', async () => {
    templateRepo.find.mockResolvedValueOnce([
      {
        id: 'tpl-1',
        name: 'Order update',
        whatsappTemplateName: 'order_update',
        whatsappTemplateStatus: WhatsAppTemplateStatus.PENDING,
        requiresWhatsappApproval: true,
      },
    ]);

    const result = await service.syncFromCloud();

    expect(result.matched).toBe(1);
    expect(result.updated).toBe(1);
    expect(templateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappTemplateStatus: WhatsAppTemplateStatus.APPROVED }),
    );
    expect(settingsService.updateGlobal).toHaveBeenCalled();
  });
});
