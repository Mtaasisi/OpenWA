import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiChatService, type ToolAction } from './ai-chat.service';
import { AiCustomerToolsService, type CustomerAgentScope } from './ai-customer-tools.service';
import { AiAuditService } from './ai-audit.service';
import { isAiUnrestricted } from './utils/ai-unrestricted.util';
import { detectCustomerIntent } from './utils/ai-intent-detector.util';
import { resolveContextNeeds } from './cost/ai-context-optimizer.util';
import { resolveModelRoute } from './cost/ai-model-router.util';
import {
  AiUsageFeature,
  AiUsageSource,
  AiModelTier,
  AiUsageStatus,
} from './cost/ai-cost.types';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';
import { AiPromptAssemblerService } from './prompt/ai-prompt-assembler.service';

export interface CustomerAgentRunInput {
  sessionId: string;
  chatId: string;
  incomingText: string;
  branchId?: string | null;
  messageId?: string;
  requestId?: string;
  batchId?: string | null;
  injectPromptBlock?: string;
  profileQuestionHint?: string;
  onEscalate: (reason: string) => Promise<void>;
}

export interface CustomerAgentRunResult {
  content: string | null;
  escalated: boolean;
  actions: ToolAction[];
  provider?: string;
  model?: string;
  latencyMs?: number;
  aiCallsCount?: number;
  exceededAiCallLimit?: boolean;
}

@Injectable()
export class AiInboxAgentService {
  private readonly logger = new Logger(AiInboxAgentService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly aiChat: AiChatService,
    private readonly customerTools: AiCustomerToolsService,
    private readonly aiAudit: AiAuditService,
    private readonly costTracker: AiCostTrackerService,
    private readonly promptAssembler: AiPromptAssemblerService,
  ) {}

  async runCustomerAgent(input: CustomerAgentRunInput): Promise<CustomerAgentRunResult> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return { content: null, escalated: false, actions: [] };

    const unrestricted = isAiUnrestricted(config);
    const intent = detectCustomerIntent(input.incomingText);
    const contextNeeds = resolveContextNeeds(intent, input.incomingText, config);

    const assembled = await this.promptAssembler.assemble({
      sessionId: input.sessionId,
      chatId: input.chatId,
      incomingText: input.incomingText,
      branchId: input.branchId,
      intent,
      unrestricted,
      injectPromptBlock: input.injectPromptBlock,
      profileQuestionHint: input.profileQuestionHint,
    });

    if (!assembled.thread.length) return { content: null, escalated: false, actions: [] };

    const allCustomerTools = this.customerTools.getToolDefinitions();
    const toolsConfig = unrestricted
      ? {
          ...config,
          disabledTools: [...(config.disabledTools ?? []), 'escalate_to_human'],
        }
      : config;
    const tools = this.aiSettings.filterTools(allCustomerTools, toolsConfig);

    let escalated = false;
    const scope: CustomerAgentScope = {
      sessionId: input.sessionId,
      chatId: input.chatId,
      branchId: input.branchId,
      onEscalate: async reason => {
        escalated = true;
        await input.onEscalate(reason);
      },
    };

    const tier =
      contextNeeds.suggestedTier === 'balanced'
        ? AiModelTier.BALANCED
        : AiModelTier.CHEAP_FAST;
    const route = resolveModelRoute(config, AiUsageFeature.WHATSAPP_AUTO_REPLY, tier);
    const maxTokens = this.costTracker.clampMaxTokens(
      AiUsageFeature.WHATSAPP_AUTO_REPLY,
      contextNeeds.suggestedMaxTokens,
      config.aiFeatureLimits,
    );
    const maxIterations = config.maxCustomerToolIterations ?? 2;

    const promptMetadata = {
      promptBreakdown: assembled.breakdown,
      budgetWarning: assembled.budgetWarning,
      historyLimit: assembled.historyLimit,
      intent: assembled.intent,
      ...(route.downgradedFromPremium ? { modelDowngraded: true } : {}),
    };

    try {
      const result = await this.aiChat.runAssistantWithTools({
        systemContent: assembled.systemContent,
        thread: assembled.thread,
        tools,
        executeTool: async (name, args) => {
          const toolResult = await this.customerTools.executeTool(scope, name, args);
          this.aiAudit.logToolCall(input.sessionId, input.chatId, name, args);
          return toolResult;
        },
        maxIterations,
        maxTokens,
        temperature: Math.min(config.temperature ?? 0.7, 0.6),
        callContext: {
          feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
          source: AiUsageSource.CUSTOMER_MESSAGE,
          branchId: input.branchId,
          conversationId: input.chatId,
          contactId: input.chatId,
          messageId: input.messageId,
          batchId: input.batchId,
          requestId: input.requestId,
          tier: route.tier,
          metadata: promptMetadata,
        },
        modelOverride: { provider: route.provider, model: route.model },
      });

      if (route.downgradedFromPremium) {
        void this.costTracker.recordUsage({
          context: {
            feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
            source: AiUsageSource.CUSTOMER_MESSAGE,
            conversationId: input.chatId,
            messageId: input.messageId,
            batchId: input.batchId,
            tier: route.tier,
          },
          provider: route.provider,
          model: route.model,
          inputTokens: 0,
          outputTokens: 0,
          status: AiUsageStatus.MODEL_DOWNGRADED,
          metadata: { note: 'premium_blocked_for_auto_reply' },
        });
      }

      const maxAiCalls = config.maxAiCallsPerInboundMessage ?? 2;
      if (result.aiCallsCount > maxAiCalls) {
        return {
          content:
            'Thanks for your message — our team will confirm the details shortly.',
          escalated: true,
          actions: result.actions,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          aiCallsCount: result.aiCallsCount,
          exceededAiCallLimit: true,
        };
      }

      if (escalated && !result.content?.trim()) {
        return {
          content: 'Thanks for your patience — a team member will assist you shortly.',
          escalated: true,
          actions: result.actions,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          aiCallsCount: result.aiCallsCount,
        };
      }

      return {
        content: result.content?.trim() || null,
        escalated,
        actions: result.actions,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        aiCallsCount: result.aiCallsCount,
      };
    } catch (error) {
      this.logger.warn(
        `Customer agent failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
