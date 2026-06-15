import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { WhatsAppSafetySettings } from '../entities/whatsapp-safety-settings.entity';
import { WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID } from '../enums/whatsapp-safety.enums';
import { WHATSAPP_SAFETY_SAFE_DEFAULTS } from '../constants/whatsapp-safety-safe-defaults';

describe('WhatsAppSafetySettingsService', () => {
  let service: WhatsAppSafetySettingsService;
  let store: WhatsAppSafetySettings | null = null;

  const repo = {
    findOne: jest.fn(async ({ where }: { where: { id?: string; sessionId?: string } }) => {
      if (where.id === WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID) return store;
      if (where.sessionId) return null;
      return null;
    }),
    create: jest.fn((row: WhatsAppSafetySettings) => ({ ...row })),
    save: jest.fn(async (row: WhatsAppSafetySettings) => {
      store = { ...row };
      return store;
    }),
  };

  beforeEach(async () => {
    store = null;
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WhatsAppSafetySettingsService,
        {
          provide: getRepositoryToken(WhatsAppSafetySettings, 'data'),
          useValue: repo,
        },
      ],
    }).compile();
    service = module.get(WhatsAppSafetySettingsService);
  });

  it('seeds global row with safe-by-default values', async () => {
    const row = await service.ensureDefaults();
    expect(row.globalEnabled).toBe(true);
    expect(row.campaignsEnabled).toBe(false);
    expect(row.followupAutoSendEnabled).toBe(false);
    expect(row.aiSafetyEnabled).toBe(true);
    expect(row.maxOutboundPerDay).toBe(WHATSAPP_SAFETY_SAFE_DEFAULTS.maxOutboundPerDay);
  });

  it('resetGlobalToSafeDefaults restores safe toggles', async () => {
    store = {
      id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID,
      sessionId: null,
      globalEnabled: false,
      warmupEnabled: false,
      campaignsEnabled: true,
      followupAutoSendEnabled: true,
    } as WhatsAppSafetySettings;

    const row = await service.resetGlobalToSafeDefaults();
    expect(row.globalEnabled).toBe(true);
    expect(row.warmupEnabled).toBe(true);
    expect(row.campaignsEnabled).toBe(false);
    expect(row.followupAutoSendEnabled).toBe(false);
  });
});
