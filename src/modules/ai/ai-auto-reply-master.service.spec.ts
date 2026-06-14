jest.mock('../session/session.service', () => ({
  SessionService: class SessionService {},
}));

import { AuditAction } from '../audit/entities/audit-log.entity';
import { SessionStatus } from '../session/entities/session.entity';
import { AiAutoReplyMasterService } from './ai-auto-reply-master.service';
import { BUNDLED_KNOWLEDGE_FILES } from './ai-knowledge.service';

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const aiSettings = {
    get: jest.fn(async () => ({
      autoReplyEnabled: true,
      enabled: true,
      apiKeySet: true,
    })),
    setAutoReplyEnabled: jest.fn(async (enabled: boolean) => ({ autoReplyEnabled: enabled })),
    setUnrestrictedMode: jest.fn(async () => ({ aiUnrestrictedMode: true })),
    ...(overrides.aiSettings as object),
  };

  const sessionService = {
    findAll: jest.fn(async () => [
      {
        id: 's1',
        name: 'Shop',
        status: SessionStatus.READY,
        config: { aiAutoReplyEnabled: true },
      },
    ]),
    isAiAutoReplyEnabledForSession: jest.fn(() => true),
    setAiAutoReplyEnabled: jest.fn(async () => ({})),
    ...(overrides.sessionService as object),
  };

  const safetySettings = {
    getGlobal: jest.fn(async () => ({
      aiAutoReplyEnabled: true,
      aiSafetyEnabled: true,
    })),
    updateGlobal: jest.fn(async patch => patch),
    ...(overrides.safetySettings as object),
  };

  const sessionHealth = {
    isAutomationPaused: jest.fn(async () => false),
    ...(overrides.sessionHealth as object),
  };

  const knowledge = {
    listFiles: jest.fn(() =>
      BUNDLED_KNOWLEDGE_FILES.map(name => ({
        path: name,
        size: 500,
        updatedAt: new Date().toISOString(),
      })),
    ),
    ...(overrides.knowledge as object),
  };

  const knowledgeIndex = {
    getIndexedChunkCount: jest.fn(async () => 20),
    ...(overrides.knowledgeIndex as object),
  };

  const circuitBreaker = {
    isOpen: jest.fn(() => false),
    ...(overrides.circuitBreaker as object),
  };

  const signalService = {
    getDashboardSignals: jest.fn(async () => ({ openEscalations: 0 })),
    ...(overrides.signalService as object),
  };

  const audit = {
    countSince: jest.fn(async () => 3),
    ...(overrides.audit as object),
  };

  const inboxCrm = {
    bulkResumeAiThreads: jest.fn(async () => ({ resumed: 2 })),
    ...(overrides.inboxCrm as object),
  };

  const productsService = {
    catalogStats: jest.fn(async () => ({
      total: 12,
      lowStock: 2,
      outOfStock: 1,
      inventoryValue: 1000,
      scaleMax: 20,
      currencyHint: 'TZS',
    })),
    ...(overrides.productsService as object),
  };

  const service = new AiAutoReplyMasterService(
    aiSettings as never,
    sessionService as never,
    safetySettings as never,
    sessionHealth as never,
    knowledge as never,
    knowledgeIndex as never,
    circuitBreaker as never,
    signalService as never,
    audit as never,
    inboxCrm as never,
    productsService as never,
  );

  return {
    service,
    aiSettings,
    sessionService,
    safetySettings,
    sessionHealth,
    knowledge,
    knowledgeIndex,
    circuitBreaker,
    signalService,
    audit,
    inboxCrm,
    productsService,
  };
}

describe('AiAutoReplyMasterService', () => {
  it('setMasterEnabled syncs AI config, safety, and every session', async () => {
    const { service, aiSettings, safetySettings, sessionService } = createService();

    await service.setMasterEnabled(true);

    expect(aiSettings.setAutoReplyEnabled).toHaveBeenCalledWith(true);
    expect(safetySettings.updateGlobal).toHaveBeenCalledWith({ aiAutoReplyEnabled: true });
    expect(sessionService.setAiAutoReplyEnabled).toHaveBeenCalledWith('s1', true);
  });

  it('getHealth returns ready when all gates pass', async () => {
    const { service } = createService();
    const health = await service.getHealth();

    expect(health.masterEnabled).toBe(true);
    expect(health.ready).toBe(true);
    expect(health.stats.aiReplies24h).toBe(3);
    expect(health.checks.find(c => c.id === 'providerReady')?.ok).toBe(true);
    expect(health.sessions[0]?.connected).toBe(true);
  });

  it('getHealth is not ready when master is off', async () => {
    const { service, aiSettings } = createService({
      aiSettings: {
        get: jest.fn(async () => ({
          autoReplyEnabled: false,
          enabled: true,
          apiKeySet: true,
        })),
      },
    });

    const health = await service.getHealth();

    expect(health.masterEnabled).toBe(false);
    expect(health.ready).toBe(false);
    expect(health.checks.find(c => c.id === 'masterEnabled')?.ok).toBe(false);
    expect(aiSettings.get).toHaveBeenCalled();
  });

  it('counts AI replies from audit log', async () => {
    const { service, audit } = createService();
    await service.getHealth();

    expect(audit.countSince).toHaveBeenCalledWith(AuditAction.AI_REPLY, expect.any(Date));
  });

  it('getHealth includes local inventory catalog check', async () => {
    const { service, productsService } = createService();
    const health = await service.getHealth();

    expect(productsService.catalogStats).toHaveBeenCalledWith({ activeOnly: true });
    const catalogCheck = health.checks.find(c => c.id === 'localCatalog');
    expect(catalogCheck?.ok).toBe(true);
    expect(catalogCheck?.fixTarget).toBe('products');
  });

  it('getHealth flags empty local catalog', async () => {
    const { service } = createService({
      productsService: {
        catalogStats: jest.fn(async () => ({
          total: 0,
          lowStock: 0,
          outOfStock: 0,
          inventoryValue: 0,
          scaleMax: 1,
          currencyHint: null,
        })),
      },
    });

    const health = await service.getHealth();
    const catalogCheck = health.checks.find(c => c.id === 'localCatalog');
    expect(catalogCheck?.ok).toBe(false);
    expect(catalogCheck?.detail).toContain('No active products');
  });

  it('applyUnrestrictedMode enables unrestricted settings and resumes paused chats', async () => {
    const { service, aiSettings, safetySettings, sessionService, inboxCrm } = createService();

    const result = await service.applyUnrestrictedMode();

    expect(aiSettings.setUnrestrictedMode).toHaveBeenCalledWith(true);
    expect(safetySettings.updateGlobal).toHaveBeenCalledWith({
      aiAutoReplyEnabled: true,
      aiSafetyEnabled: true,
    });
    expect(sessionService.setAiAutoReplyEnabled).toHaveBeenCalledWith('s1', true);
    expect(inboxCrm.bulkResumeAiThreads).toHaveBeenCalled();
    expect(result.resumedThreads).toBe(2);
  });
});
