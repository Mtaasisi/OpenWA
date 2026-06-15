import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { WhatsAppLinkPreflightService } from './whatsapp-link-preflight.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { Session } from '../../session/entities/session.entity';

describe('WhatsAppLinkPreflightService', () => {
  let service: WhatsAppLinkPreflightService;

  const settings = {
    globalEnabled: true,
    warmupEnabled: true,
    startupSafeModeEnabled: true,
    aiAutoReplyEnabled: true,
    aiSafetyEnabled: true,
    campaignsEnabled: false,
    followupAutoSendEnabled: false,
    outside24hRequiresTemplate: true,
    groupsAutoReplyEnabled: false,
    maxOutboundPerDay: 100,
    minDelayBetweenMessagesMs: 8000,
    autoDownloadMediaOnStartup: false,
    fetchGroupInfoOnStartup: false,
  };

  const sessionRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WhatsAppLinkPreflightService,
        {
          provide: WhatsAppSafetySettingsService,
          useValue: {
            getGlobal: jest.fn(async () => settings),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: unknown) => {
              if (key === 'engine.type') return 'whatsapp-web.js';
              if (key === 'session.reconnectInfinite') return false;
              return def;
            }),
          },
        },
        {
          provide: getRepositoryToken(Session, 'data'),
          useValue: sessionRepo,
        },
      ],
    }).compile();

    service = module.get(WhatsAppLinkPreflightService);
  });

  it('returns all-clear when settings and session are safe', async () => {
    sessionRepo.findOne.mockResolvedValue({
      id: 's1',
      name: 'shop',
      engineType: null,
      proxyUrl: 'socks5://proxy:1080',
    });

    const result = await service.getPreflight('s1');
    expect(result.blockingOk).toBe(true);
    expect(result.recommendedOk).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.engineType).toBe('whatsapp-web.js');
    expect(result.items.filter(i => i.severity === 'manual')).toHaveLength(0);
  });

  it('flags baileys engine as recommended warning', async () => {
    sessionRepo.findOne.mockResolvedValue({
      id: 's1',
      name: 'shop',
      engineType: 'baileys',
      proxyUrl: 'socks5://proxy:1080',
    });

    const result = await service.getPreflight('s1');
    const engine = result.items.find(i => i.id === 'enginePreference');
    expect(engine?.ok).toBe(false);
    expect(result.recommendedOk).toBe(false);
    expect(result.blockingOk).toBe(true);
  });

  it('throws when session is missing', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    await expect(service.getPreflight('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns summary for sessions that need linking', async () => {
    sessionRepo.find = jest.fn().mockResolvedValue([
      {
        id: 's1',
        name: 'shop',
        status: 'disconnected',
        phone: '255700000000',
        engineType: null,
      },
    ]);
    sessionRepo.findOne.mockResolvedValue({
      id: 's1',
      name: 'shop',
      engineType: null,
      proxyUrl: 'socks5://proxy:1080',
    });

    const summary = await service.getSummary();
    expect(summary.sessions).toHaveLength(1);
    expect(summary.sessions[0].sessionId).toBe('s1');
    expect(summary.notReadyCount).toBe(0);
  });
});
