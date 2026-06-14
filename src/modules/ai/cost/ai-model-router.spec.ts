import { resolveModelRoute, isPremiumModel } from './ai-model-router.util';
import { AiUsageFeature } from './ai-cost.types';
import { AiProvider } from '../ai.enums';
import type { AiConfig } from '../entities/ai-config.entity';

function baseConfig(): AiConfig {
  return {
    id: 'default',
    provider: AiProvider.ANTHROPIC,
    model: 'claude-opus-4-6',
    autoReplyModelTier: 'cheap_fast',
    allowPremiumModelForAutoReply: false,
  } as AiConfig;
}

describe('ai-model-router', () => {
  it('downgrades opus for auto-reply when premium not allowed', () => {
    const route = resolveModelRoute(baseConfig(), AiUsageFeature.WHATSAPP_AUTO_REPLY);
    expect(isPremiumModel(route.model)).toBe(false);
    expect(route.downgradedFromPremium).toBe(true);
  });

  it('allows opus for auto-reply when explicitly enabled', () => {
    const config = { ...baseConfig(), allowPremiumModelForAutoReply: true, autoReplyModelTier: 'premium' };
    const route = resolveModelRoute(config, AiUsageFeature.WHATSAPP_AUTO_REPLY);
    expect(route.model).toContain('opus');
  });

  it('detects premium models', () => {
    expect(isPremiumModel('claude-opus-4-6')).toBe(true);
    expect(isPremiumModel('gpt-4o-mini')).toBe(false);
  });
});
