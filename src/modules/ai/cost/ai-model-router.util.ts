import { AiProvider } from '../ai.enums';
import { PROVIDER_MODELS } from '../ai-provider-catalog';
import { AiModelTier, AiUsageFeature } from './ai-cost.types';
import type { AiConfig } from '../entities/ai-config.entity';

const PREMIUM_PATTERNS = [
  /opus/i,
  /^o3$/i,
  /^o4-mini$/i,
  /reasoner/i,
  /^gpt-4\.1$/i,
  /^grok-4/i,
  /gemini-2\.5-pro/i,
];

const TIER_MODELS: Record<AiProvider, Record<AiModelTier, string>> = {
  [AiProvider.OPENAI]: {
    [AiModelTier.CHEAP_FAST]: 'gpt-4o-mini',
    [AiModelTier.BALANCED]: 'gpt-4o',
    [AiModelTier.PREMIUM]: 'gpt-4.1',
  },
  [AiProvider.ANTHROPIC]: {
    [AiModelTier.CHEAP_FAST]: 'claude-haiku-4-5-20251001',
    [AiModelTier.BALANCED]: 'claude-sonnet-4-6',
    [AiModelTier.PREMIUM]: 'claude-opus-4-6',
  },
  [AiProvider.GEMINI]: {
    [AiModelTier.CHEAP_FAST]: 'gemini-2.5-flash-lite',
    [AiModelTier.BALANCED]: 'gemini-2.5-flash',
    [AiModelTier.PREMIUM]: 'gemini-2.5-pro',
  },
  [AiProvider.GROQ]: {
    [AiModelTier.CHEAP_FAST]: 'llama-3.1-8b-instant',
    [AiModelTier.BALANCED]: 'llama-3.3-70b-versatile',
    [AiModelTier.PREMIUM]: 'llama-3.3-70b-versatile',
  },
  [AiProvider.DEEPSEEK]: {
    [AiModelTier.CHEAP_FAST]: 'deepseek-chat',
    [AiModelTier.BALANCED]: 'deepseek-chat',
    [AiModelTier.PREMIUM]: 'deepseek-reasoner',
  },
  [AiProvider.OPENROUTER]: {
    [AiModelTier.CHEAP_FAST]: 'openai/gpt-4o-mini',
    [AiModelTier.BALANCED]: 'anthropic/claude-sonnet-4-6',
    [AiModelTier.PREMIUM]: 'anthropic/claude-opus-4-6',
  },
} as Record<AiProvider, Record<AiModelTier, string>>;

export function isPremiumModel(model: string): boolean {
  return PREMIUM_PATTERNS.some(p => p.test(model));
}

export function resolveTierForFeature(config: AiConfig, feature: AiUsageFeature): AiModelTier {
  switch (feature) {
    case AiUsageFeature.WHATSAPP_AUTO_REPLY:
      return (config.autoReplyModelTier as AiModelTier) || AiModelTier.CHEAP_FAST;
    case AiUsageFeature.INBOX_ASSISTANT:
      return (config.inboxAssistantModelTier as AiModelTier) || AiModelTier.CHEAP_FAST;
    case AiUsageFeature.TRAINING_CENTER:
      return (config.trainingModelTier as AiModelTier) || AiModelTier.BALANCED;
    case AiUsageFeature.ADMIN_ASSISTANT:
      return (config.adminAssistantModelTier as AiModelTier) || AiModelTier.BALANCED;
    default:
      return AiModelTier.CHEAP_FAST;
  }
}

export function resolveModelOverride(config: AiConfig, feature: AiUsageFeature): string | null {
  switch (feature) {
    case AiUsageFeature.WHATSAPP_AUTO_REPLY:
      return config.autoReplyModelOverride?.trim() || null;
    case AiUsageFeature.INBOX_ASSISTANT:
      return config.inboxAssistantModelOverride?.trim() || null;
    case AiUsageFeature.TRAINING_CENTER:
      return config.trainingModelOverride?.trim() || null;
    case AiUsageFeature.ADMIN_ASSISTANT:
      return config.adminAssistantModelOverride?.trim() || null;
    default:
      return null;
  }
}

export function pickModelForTier(provider: AiProvider, tier: AiModelTier): string {
  const providerTiers = TIER_MODELS[provider];
  if (providerTiers?.[tier]) return providerTiers[tier];
  const models = PROVIDER_MODELS[provider];
  if (!models?.length) return 'gpt-4o-mini';
  if (tier === AiModelTier.CHEAP_FAST) return models[models.length - 1];
  if (tier === AiModelTier.PREMIUM) return models[0];
  return models[Math.floor(models.length / 2)] ?? models[0];
}

export interface ResolvedModelRoute {
  provider: AiProvider;
  model: string;
  tier: AiModelTier;
  downgradedFromPremium: boolean;
}

export function resolveModelRoute(
  config: AiConfig,
  feature: AiUsageFeature,
  tierOverride?: AiModelTier,
): ResolvedModelRoute {
  let tier = tierOverride ?? resolveTierForFeature(config, feature);
  const override = resolveModelOverride(config, feature);
  let model = override ?? pickModelForTier(config.provider, tier);
  let downgradedFromPremium = false;

  const autoReplyFeatures = new Set([
    AiUsageFeature.WHATSAPP_AUTO_REPLY,
  ]);

  if (
    autoReplyFeatures.has(feature) &&
    !config.allowPremiumModelForAutoReply &&
    (tier === AiModelTier.PREMIUM || isPremiumModel(model))
  ) {
    tier = AiModelTier.CHEAP_FAST;
    model = config.autoReplyModelOverride?.trim() || pickModelForTier(config.provider, tier);
    downgradedFromPremium = true;
  }

  if (isPremiumModel(config.model) && autoReplyFeatures.has(feature) && !config.allowPremiumModelForAutoReply) {
    // Global model is premium — use tier model instead
    if (!override) {
      model = pickModelForTier(config.provider, tier);
      downgradedFromPremium = true;
    }
  }

  return {
    provider: config.provider,
    model,
    tier,
    downgradedFromPremium,
  };
}
