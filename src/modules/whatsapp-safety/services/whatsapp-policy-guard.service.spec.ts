import { WhatsAppPolicyGuardService } from './whatsapp-policy-guard.service';
import {
  GuardRequiredAction,
  WhatsAppMessageType,
  WhatsAppOptInStatus,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';

function mockGuardDeps(overrides: Record<string, unknown> = {}) {
  const settings = {
    globalEnabled: true,
    warmupEnabled: true,
    groupsAutoReplyEnabled: false,
    campaignsEnabled: false,
    followupAutoSendEnabled: false,
    aiAutoReplyEnabled: true,
    aiSafetyEnabled: true,
    outside24hRequiresTemplate: true,
    maxOutboundPerHour: 20,
    maxOutboundPerDay: 100,
    maxAutoRepliesPerCustomerPerDay: 5,
    maxAutoRepliesPerHour: 15,
    maxCampaignMessagesPerHour: 20,
    maxCampaignMessagesPerDay: 0,
    riskyIntentRequiresApproval: true,
    productBulkSendEnabled: false,
    minAiReplyDelayMs: 15000,
    maxAiReplyDelayMs: 90000,
    ...((overrides.settings as object) ?? {}),
  };

  return {
    settingsService: { getForSession: jest.fn().mockResolvedValue(settings) },
    consentService: {
      findConsent: jest.fn().mockResolvedValue({
        optInStatus: WhatsAppOptInStatus.OPTED_IN,
        lastUserMessageAt: new Date(),
        canMarketing: false,
        canFollowup: true,
        ...(overrides.consent as object),
      }),
      isOptedOut: jest.fn().mockImplementation(c => c?.optInStatus === WhatsAppOptInStatus.OPTED_OUT),
      canSendMarketing: jest.fn().mockReturnValue(false),
      canSendFollowup: jest.fn().mockReturnValue(true),
    },
    windowService: {
      getCustomerServiceWindow: jest.fn().mockResolvedValue({
        within24h: true,
        requiresTemplate: false,
      }),
    },
    templateGuard: { validateOutsideWindow: jest.fn().mockResolvedValue({ ok: true }) },
    warmupService: {
      getWarmup: jest.fn().mockResolvedValue({
        status: 'active',
        dayNumber: 1,
        repliesOnly: true,
        allowCampaigns: false,
        allowFollowupAutoSend: false,
        allowAiAutoReply: true,
        outboundSentToday: 0,
        autoReplySentToday: 0,
        followupSentToday: 0,
        campaignSentToday: 0,
        maxOutboundToday: 30,
        maxAutoRepliesToday: 5,
        maxFollowupsToday: 0,
        maxCampaignToday: 0,
        ...(overrides.warmup as object),
      }),
      advanceDayIfNeeded: jest.fn(),
      checkWarmupAllows: jest.fn().mockReturnValue({ allowed: true, reason: 'ok' }),
    },
    healthService: {
      isAutomationPaused: jest.fn().mockResolvedValue(false),
      isStartupSafeMode: jest.fn().mockResolvedValue(false),
      ...(overrides.health as object),
    },
    auditService: {
      countAutoRepliesTodayForContact: jest.fn().mockResolvedValue(0),
      countAutoRepliesInLastHour: jest.fn().mockResolvedValue(0),
      countSendsInLastHour: jest.fn().mockResolvedValue(0),
      countSendsToday: jest.fn().mockResolvedValue(0),
      countCampaignSendsInLastHour: jest.fn().mockResolvedValue(0),
      countCampaignSendsToday: jest.fn().mockResolvedValue(0),
      countRecentIdenticalBody: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('WhatsAppPolicyGuardService', () => {
  let guard: WhatsAppPolicyGuardService;

  beforeEach(() => {
    const deps = mockGuardDeps();
    guard = new WhatsAppPolicyGuardService(
      deps.settingsService as never,
      deps.consentService as never,
      deps.windowService as never,
      deps.templateGuard as never,
      deps.warmupService as never,
      deps.healthService as never,
      deps.auditService as never,
    );
  });

  it('blocks group AI auto-reply by default', async () => {
    const decision = await guard.evaluate({
      sessionId: 's1',
      chatId: '120363@g.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      body: 'Hello',
      aiConfidence: 0.9,
    });
    expect(decision.requiredAction).toBe(GuardRequiredAction.BLOCK);
  });

  it('blocks opted-out customer', async () => {
    const deps = mockGuardDeps({
      consent: { optInStatus: WhatsAppOptInStatus.OPTED_OUT },
    });
    guard = new WhatsAppPolicyGuardService(
      deps.settingsService as never,
      deps.consentService as never,
      deps.windowService as never,
      deps.templateGuard as never,
      deps.warmupService as never,
      deps.healthService as never,
      deps.auditService as never,
    );
    const decision = await guard.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      body: 'Hi',
    });
    expect(decision.requiredAction).toBe(GuardRequiredAction.BLOCK);
  });

  it('allows safe reply when customer initiated', async () => {
    const decision = await guard.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      body: 'Sawa boss',
      aiConfidence: 0.85,
    });
    expect([GuardRequiredAction.DELAY, GuardRequiredAction.QUEUE]).toContain(decision.requiredAction);
  });

  it('queues AI reply immediately when minAiReplyDelayMs is zero', async () => {
    const deps = mockGuardDeps({ settings: { minAiReplyDelayMs: 0 } });
    guard = new WhatsAppPolicyGuardService(
      deps.settingsService as never,
      deps.consentService as never,
      deps.windowService as never,
      deps.templateGuard as never,
      deps.warmupService as never,
      deps.healthService as never,
      deps.auditService as never,
    );
    const decision = await guard.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      body: 'Sawa boss',
      aiConfidence: 0.85,
    });
    expect(decision.requiredAction).toBe(GuardRequiredAction.QUEUE);
    expect(decision.delayMs).toBeUndefined();
  });

  it('allows AI reply immediately when unrestricted mode is on', async () => {
    const deps = mockGuardDeps({
      health: { isStartupSafeMode: jest.fn().mockResolvedValue(true) },
    });
    const unrestrictedGuard = new WhatsAppPolicyGuardService(
      deps.settingsService as never,
      deps.consentService as never,
      deps.windowService as never,
      deps.templateGuard as never,
      deps.warmupService as never,
      deps.healthService as never,
      deps.auditService as never,
    );
    const decision = await unrestrictedGuard.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      messageType: WhatsAppMessageType.AI_AUTO_REPLY,
      source: WhatsAppSendSource.AI,
      body: 'Sawa boss',
      aiConfidence: 0.4,
      isHighRiskIntent: true,
      aiUnrestrictedMode: true,
    });
    expect(decision.requiredAction).toBe(GuardRequiredAction.ALLOW);
    expect(decision.allowed).toBe(true);
  });

  it('blocks campaign when disabled', async () => {
    const decision = await guard.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      messageType: WhatsAppMessageType.CAMPAIGN,
      source: WhatsAppSendSource.CAMPAIGN,
      body: 'Promo',
    });
    expect(decision.requiredAction).toBe(GuardRequiredAction.BLOCK);
  });
});
