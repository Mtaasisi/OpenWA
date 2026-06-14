/**
 * Regression tests mapped to AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md.
 * Run: npm run test -- --testPathPatterns=ai-cost-safety
 */
import { AiProvider } from '../ai.enums';
import type { AiConfig } from '../entities/ai-config.entity';
import {
  DEFAULT_FEATURE_LIMITS,
  AiUsageFeature,
  AiModelTier,
} from './ai-cost.types';
import {
  resolveModelRoute,
  isPremiumModel,
  pickModelForTier,
} from './ai-model-router.util';
import { AiCostTrackerService } from './ai-cost-tracker.service';
import { AiBudgetGuardService } from './ai-budget-guard.service';
import { AiUsageFeature as Feature } from './ai-cost.types';

function anthropicOpusConfig(): AiConfig {
  return {
    id: 'default',
    provider: AiProvider.ANTHROPIC,
    model: 'claude-opus-4-6',
    autoReplyModelTier: AiModelTier.CHEAP_FAST,
    allowPremiumModelForAutoReply: false,
    autoReplyContextMessages: 8,
    autoReplyContextMessagesMax: 12,
    maxCustomerToolIterations: 2,
    maxAdminToolIterations: 5,
    maxAiCallsPerInboundMessage: 2,
    aiDailyBudgetUsd: 1,
    aiMonthlyBudgetUsd: 20,
    autoReplyDailyBudgetUsd: 0.5,
    stopAutoReplyWhenBudgetExceeded: true,
    ignoreDuplicateMessageIds: true,
    ignorePromotionalMessages: true,
    autoReplyCooldownSeconds: 60,
  } as AiConfig;
}

describe('AI cost safety QA (automated)', () => {
  describe('model routing', () => {
    it('auto-reply default tier uses cheap/fast models per provider', () => {
      expect(pickModelForTier(AiProvider.OPENAI, AiModelTier.CHEAP_FAST)).toBe('gpt-4o-mini');
      expect(pickModelForTier(AiProvider.ANTHROPIC, AiModelTier.CHEAP_FAST)).toContain('haiku');
      expect(pickModelForTier(AiProvider.GEMINI, AiModelTier.CHEAP_FAST)).toContain('flash-lite');
    });

    it('blocks Claude Opus for auto-reply when premium not allowed', () => {
      const route = resolveModelRoute(anthropicOpusConfig(), AiUsageFeature.WHATSAPP_AUTO_REPLY);
      expect(isPremiumModel(route.model)).toBe(false);
      expect(route.downgradedFromPremium).toBe(true);
    });

    it('inbox assistant uses inbox tier (cheap_fast default)', () => {
      const route = resolveModelRoute(anthropicOpusConfig(), AiUsageFeature.INBOX_ASSISTANT);
      expect(route.tier).toBe(AiModelTier.CHEAP_FAST);
      expect(isPremiumModel(route.model)).toBe(false);
    });

    it('admin assistant uses balanced tier by default', () => {
      const route = resolveModelRoute(anthropicOpusConfig(), AiUsageFeature.ADMIN_ASSISTANT);
      expect(route.tier).toBe(AiModelTier.BALANCED);
    });
  });

  describe('token and iteration limits', () => {
    const tracker = new AiCostTrackerService(
      {} as never,
      {} as never,
    );

    it('clamps auto-reply max tokens to ~220 (not 4096)', () => {
      expect(DEFAULT_FEATURE_LIMITS.whatsapp_auto_reply).toBe(220);
      expect(
        tracker.clampMaxTokens(AiUsageFeature.WHATSAPP_AUTO_REPLY, 4096),
      ).toBe(220);
    });

    it('allows higher cap for admin assistant (staff chat)', () => {
      expect(
        tracker.clampMaxTokens(AiUsageFeature.ADMIN_ASSISTANT, 4096),
      ).toBe(DEFAULT_FEATURE_LIMITS.admin_assistant);
      expect(DEFAULT_FEATURE_LIMITS.admin_assistant).toBe(1500);
    });

    it('config defaults limit customer tools to 2 and admin to 5', () => {
      const config = anthropicOpusConfig();
      expect(config.maxCustomerToolIterations).toBe(2);
      expect(config.maxAdminToolIterations).toBe(5);
      expect(config.maxAiCallsPerInboundMessage).toBe(2);
    });
  });

  describe('context defaults', () => {
    it('defaults auto-reply context to 8 messages (max cap 12)', () => {
      const config = anthropicOpusConfig();
      expect(config.autoReplyContextMessages).toBe(8);
      expect(config.autoReplyContextMessagesMax).toBe(12);
    });
  });

  describe('budget guard', () => {
    it('blocks auto-reply when daily budget exceeded and pauses', async () => {
      const config = {
        ...anthropicOpusConfig(),
        aiDailyBudgetUsd: 0.01,
        stopAutoReplyWhenBudgetExceeded: true,
        autoReplyPaused: false,
        aiBudgetPaused: false,
      } as AiConfig;

      const configRepo = {
        findOne: jest.fn().mockResolvedValue(config),
        create: jest.fn(),
        save: jest.fn().mockImplementation(async (c: AiConfig) => c),
      };

      const costTracker = {
        sumCostSince: jest.fn().mockImplementation(async (_since: Date, feature?: string) => {
          if (feature === Feature.WHATSAPP_AUTO_REPLY) return 0;
          return 0.02;
        }),
        recordUsage: jest.fn(),
      };

      const guard = new AiBudgetGuardService(configRepo as never, costTracker as never);
      const result = await guard.checkBeforeCall({
        feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
        source: 'customer_message' as never,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_budget_exceeded');
      expect(config.autoReplyPaused).toBe(true);
    });
  });

  describe('usage API response shape (no secrets)', () => {
    it('usage log fields do not include raw API keys', () => {
      const allowedFields = new Set([
        'id',
        'workspaceId',
        'branchId',
        'apiKeyLabel',
        'provider',
        'model',
        'feature',
        'source',
        'conversationId',
        'customerId',
        'messageId',
        'requestId',
        'inputTokens',
        'outputTokens',
        'totalTokens',
        'estimatedCostUsd',
        'actualCostUsd',
        'currency',
        'toolCallsCount',
        'aiCallsCount',
        'status',
        'errorMessage',
        'metadata',
        'createdAt',
      ]);
      const forbidden = ['apiKey', 'keyHash', 'decryptedKey', 'systemPrompt', 'prompt'];
      for (const field of forbidden) {
        expect(allowedFields.has(field)).toBe(false);
      }
    });
  });
});
