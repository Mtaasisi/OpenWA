import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { WhatsAppSafetyController } from '../src/modules/whatsapp-safety/whatsapp-safety.controller';
import { WhatsAppSafetySettingsService } from '../src/modules/whatsapp-safety/services/whatsapp-safety-settings.service';
import { WhatsAppSendAuditService } from '../src/modules/whatsapp-safety/services/whatsapp-send-audit.service';
import { WhatsAppSendQueueService } from '../src/modules/whatsapp-safety/services/whatsapp-send-queue.service';
import { WhatsAppWarmupService } from '../src/modules/whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppSessionHealthService } from '../src/modules/whatsapp-safety/services/whatsapp-session-health.service';
import {
  WhatsAppConsentService,
  WhatsAppServiceWindowService,
} from '../src/modules/whatsapp-safety/services/whatsapp-consent.service';
import { WhatsAppPolicyGuardService } from '../src/modules/whatsapp-safety/services/whatsapp-policy-guard.service';
import { WhatsAppCampaignPreflightService } from '../src/modules/whatsapp-safety/services/whatsapp-campaign-preflight.service';
import { WhatsAppOutboundService } from '../src/modules/whatsapp-safety/services/whatsapp-outbound.service';
import { WhatsAppCloudTemplateSyncService } from '../src/modules/whatsapp-safety/services/whatsapp-cloud-template-sync.service';
import { WhatsAppCloudOutboundService } from '../src/modules/whatsapp-safety/services/whatsapp-cloud-outbound.service';
import { WhatsAppContactConsent } from '../src/modules/whatsapp-safety/entities/whatsapp-contact-consent.entity';

describe('WhatsApp Safety API (e2e)', () => {
  let app: INestApplication<App>;

  const settingsService = {
    getGlobal: jest.fn(async () => ({ globalEnabled: true, campaignsEnabled: false })),
    updateGlobal: jest.fn(async (patch: unknown) => ({ globalEnabled: true, ...patch })),
    getForSession: jest.fn(async () => ({ globalEnabled: true, campaignsEnabled: false })),
  };

  const auditService = {
    countBlockedToday: jest.fn(async () => 2),
    recent: jest.fn(async () => []),
    recentFiltered: jest.fn(async () => []),
  };

  const queueService = {
    countPending: jest.fn(async () => 5),
    list: jest.fn(async () => [{ id: 'q-1', sessionId: 'sess-1', status: 'approval_required' }]),
    stats: jest.fn(async () => ({ pending: 5 })),
  };

  const warmupService = {
    listActive: jest.fn(async () => [{ sessionId: 'sess-1', dayNumber: 2 }]),
    getOrCreate: jest.fn(),
    getWarmup: jest.fn(),
    updateWarmup: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    resetWarmup: jest.fn(),
  };

  const healthService = {
    criticalAlerts: jest.fn(async () => []),
    recentEvents: jest.fn(async () => []),
    isAutomationPaused: jest.fn(async () => false),
    isStartupSafeMode: jest.fn(async () => false),
    pauseAutomation: jest.fn(),
    resumeAutomation: jest.fn(),
  };

  const consentService = {
    listOptedOut: jest.fn(async () => []),
    countOptedOut: jest.fn(async () => 0),
    listMarketingGaps: jest.fn(async () => [
      { id: 'gap-1', phone: '+255798765432', canMarketing: false, canFollowup: true },
    ]),
    findConsent: jest.fn(async () => ({
      optInStatus: 'opted_out',
      canMarketing: false,
      canFollowup: false,
    })),
    handleOptOut: jest.fn(),
  };

  const serviceWindowService = {
    getCustomerServiceWindow: jest.fn(async () => ({
      within24h: false,
      requiresTemplate: true,
      lastCustomerMessageAt: null,
    })),
  };

  const consentRepo = {
    update: jest.fn(),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      optInStatus: 'opted_in',
      canMarketing: true,
    })),
  };

  const cloudTemplateSync = {
    listApprovalTemplates: jest.fn(async () => []),
    getSyncStatus: jest.fn(async () => ({ enabled: false })),
    syncFromCloud: jest.fn(),
    testCloudConnection: jest.fn(async () => ({
      ok: true,
      configured: true,
      hasAccessToken: true,
      wabaId: 'waba-123',
      wabaName: 'Test WABA',
      templateCount: 3,
    })),
  };

  const cloudOutbound = {
    sendTemplate: jest.fn(async () => ({
      ok: true,
      blocked: false,
      queued: false,
      reason: 'Template sent via WhatsApp Cloud API',
      messageId: 'wamid.api-test',
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppSafetyController],
      providers: [
        { provide: WhatsAppSafetySettingsService, useValue: settingsService },
        { provide: WhatsAppSendAuditService, useValue: auditService },
        { provide: WhatsAppSendQueueService, useValue: queueService },
        { provide: WhatsAppWarmupService, useValue: warmupService },
        { provide: WhatsAppSessionHealthService, useValue: healthService },
        { provide: WhatsAppConsentService, useValue: consentService },
        { provide: WhatsAppServiceWindowService, useValue: serviceWindowService },
        { provide: WhatsAppPolicyGuardService, useValue: { evaluate: jest.fn() } },
        { provide: WhatsAppCampaignPreflightService, useValue: { preflight: jest.fn() } },
        { provide: WhatsAppOutboundService, useValue: { checkBeforeSend: jest.fn() } },
        { provide: WhatsAppCloudTemplateSyncService, useValue: cloudTemplateSync },
        { provide: WhatsAppCloudOutboundService, useValue: cloudOutbound },
        {
          provide: getRepositoryToken(WhatsAppContactConsent, 'data'),
          useValue: consentRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/dashboard/whatsapp-safety-alerts returns dashboard metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard/whatsapp-safety-alerts')
      .expect(200);

    expect(res.body.blockedToday).toBe(2);
    expect(res.body.pendingQueue).toBe(5);
    expect(res.body.approvalRequired).toHaveLength(1);
    expect(res.body.warmups).toHaveLength(1);
  });

  it('GET /api/whatsapp-safety/overview returns safety summary', async () => {
    auditService.countBlockedToday.mockResolvedValueOnce(1);
    queueService.countPending.mockResolvedValueOnce(3);

    const res = await request(app.getHttpServer()).get('/api/whatsapp-safety/overview').expect(200);

    expect(res.body.safetyEnabled).toBe(true);
    expect(res.body.blockedToday).toBe(1);
    expect(res.body.pendingQueue).toBe(3);
  });

  it('GET /api/whatsapp-consent/marketing-gaps returns consent gaps', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/whatsapp-consent/marketing-gaps')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].phone).toBe('+255798765432');
  });

  it('GET /api/whatsapp-consent/lookup returns consent window snapshot', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/whatsapp-consent/lookup?sessionId=sess-1&chatId=255798765432@c.us')
      .expect(200);

    expect(res.body.optInStatus).toBe('opted_out');
    expect(res.body.requiresTemplate).toBe(true);
  });

  it('GET /api/whatsapp-safety/cloud/connection-test returns Meta connectivity snapshot', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/whatsapp-safety/cloud/connection-test')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.wabaName).toBe('Test WABA');
    expect(res.body.templateCount).toBe(3);
    expect(cloudTemplateSync.testCloudConnection).toHaveBeenCalled();
  });

  it('POST /api/whatsapp-safety/cloud/send-template returns cloud send result', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/whatsapp-safety/cloud/send-template')
      .send({
        sessionId: 'sess-1',
        chatId: '255712345678@c.us',
        templateId: 'tpl-1',
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.messageId).toBe('wamid.api-test');
    expect(cloudOutbound.sendTemplate).toHaveBeenCalled();
  });

  it('POST /api/whatsapp-safety/opt-outs/:id/restore honors canMarketing flag', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/whatsapp-safety/opt-outs/c-1/restore')
      .send({ canMarketing: true, canFollowup: true })
      .expect(201);

    expect(consentRepo.update).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ canMarketing: true, optInStatus: 'opted_in' }),
    );
    expect(res.body.canMarketing).toBe(true);
  });
});
