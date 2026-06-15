import { Test, TestingModule } from '@nestjs/testing';
import { AgentActionMatcherService } from './agent-action-matcher.service';
import { AgentActionRegistryService } from './agent-action-registry.service';

describe('AgentActionMatcherService', () => {
  let matcher: AgentActionMatcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentActionMatcherService, AgentActionRegistryService],
    }).compile();
    matcher = module.get(AgentActionMatcherService);
  });

  it('maps "Zima AI auto reply" to ai.auto_reply.disable', () => {
    const m = matcher.match('Zima AI auto reply');
    expect(m?.actionId).toBe('ai.auto_reply.disable');
    expect(m?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('maps "Washa AI auto reply" to ai.auto_reply.enable', () => {
    const m = matcher.match('Washa AI auto reply');
    expect(m?.actionId).toBe('ai.auto_reply.enable');
  });

  it('maps faster prompt to ai.reply_style.fast', () => {
    const m = matcher.match('Fanya AI ijibu faster');
    expect(m?.actionId).toBe('ai.reply_style.fast');
  });

  it('maps reindex knowledge', () => {
    const m = matcher.match('Reindex AI knowledge');
    expect(m?.actionId).toBe('ai.knowledge.reindex');
  });

  it('maps WhatsApp QR prompt', () => {
    const m = matcher.match('Onyesha QR ya WhatsApp');
    expect(m?.actionId).toBe('whatsapp.qr.open');
  });

  it('maps open webhooks to webhooks.open', () => {
    const m = matcher.match('Open webhooks');
    expect(m?.actionId).toBe('webhooks.open');
    expect(m?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('maps safety guard disable', () => {
    const m = matcher.match('Zima safety guard');
    expect(m?.actionId).toBe('whatsapp.safety.disable');
  });

  it('maps payment settings to open action', () => {
    const m = matcher.match('Badilisha payment details');
    expect(m?.actionId).toBe('payment.settings.open');
  });

  it('extracts branch name from Swahili command', () => {
    const m = matcher.match('Badilisha branch kuwa Arusha');
    expect(m?.actionId).toBe('branch.switch');
    expect(m?.params.branchName).toBe('Arusha');
  });
});
