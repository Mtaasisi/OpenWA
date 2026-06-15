import { AiSendPermission, AiSendPermissionService } from './ai-send-permission.service';
import { WhatsAppOptInStatus, WhatsAppWarmupStatus } from '../enums/whatsapp-safety.enums';

describe('AiSendPermissionService', () => {
  const settings = {
    aiSafetyEnabled: true,
    aiAutoReplyEnabled: true,
    riskyIntentRequiresApproval: true,
    unknownQuestionRequiresApproval: true,
    warmupEnabled: true,
    maxAutoRepliesPerCustomerPerDay: 5,
    minAiReplyDelayMs: 15000,
    maxAiReplyDelayMs: 90000,
  };

  function createService(overrides: Record<string, unknown> = {}) {
    return new AiSendPermissionService(
      { getForSession: jest.fn().mockResolvedValue({ ...settings, ...(overrides.settings as object) }) } as never,
      {
        findConsent: jest.fn().mockResolvedValue({
          optInStatus: WhatsAppOptInStatus.OPTED_IN,
          lastUserMessageAt: new Date(),
          ...(overrides.consent as object),
        }),
        isOptedOut: jest.fn().mockImplementation(c => c?.optInStatus === WhatsAppOptInStatus.OPTED_OUT),
      } as never,
      {
        isStartupSafeMode: jest.fn().mockResolvedValue(false),
        isAutomationPaused: jest.fn().mockResolvedValue(false),
      } as never,
      {
        getWarmup: jest.fn().mockResolvedValue(overrides.warmup ?? null),
      } as never,
      {
        countAutoRepliesTodayForContact: jest.fn().mockResolvedValue(0),
      } as never,
    );
  }

  it('blocks group auto-reply', async () => {
    const svc = createService();
    const result = await svc.evaluate({
      sessionId: 's1',
      chatId: '120363@g.us',
      proposedReply: 'Hi',
      isGroup: true,
    });
    expect(result.permission).toBe(AiSendPermission.BLOCK_SEND);
  });

  it('allows exempt name-save template', async () => {
    const svc = createService();
    const result = await svc.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      proposedReply: 'Sawa Asha, ngoja nisave namba yako 😊',
    });
    expect(result.permission).toBe(AiSendPermission.ALLOW_SEND);
  });

  it('requires approval for risky intent', async () => {
    const svc = createService();
    const result = await svc.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      proposedReply: 'Refund processed',
      isHighRiskIntent: true,
      detectedIntent: 'refund',
    });
    expect(result.permission).toBe(AiSendPermission.REQUIRE_ADMIN_APPROVAL);
  });

  it('bypasses daily cap when unrestricted mode is on', async () => {
    const svc = createService({
      settings: { maxAutoRepliesPerCustomerPerDay: 5 },
    });
    const result = await svc.evaluate({
      sessionId: 's1',
      chatId: '255712345678@c.us',
      proposedReply: 'Karibu boss',
      isHighRiskIntent: true,
      detectedIntent: 'refund',
      aiUnrestrictedMode: true,
    });
    expect(result.permission).toBe(AiSendPermission.ALLOW_SEND);
  });
});
