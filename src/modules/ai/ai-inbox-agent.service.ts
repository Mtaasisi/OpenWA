import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiChatService, type ToolAction } from './ai-chat.service';
import { AiInboxContextService } from './ai-inbox-context.service';
import { AiCustomerToolsService, type CustomerAgentScope } from './ai-customer-tools.service';
import { AiAuditService } from './ai-audit.service';
import { getAutoReplyPreset } from './ai-auto-reply-presets';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMemoryService } from './ai-memory.service';
import { AiLearningService } from './ai-learning.service';
import { getInboxCustomerReplyRules } from './ai-inbox-reply-rules';
import { AI_UNRESTRICTED_AGENT_PROMPT, isAiUnrestricted } from './utils/ai-unrestricted.util';
import { detectCustomerIntent } from './utils/ai-intent-detector.util';
import { resolveContextNeeds } from './cost/ai-context-optimizer.util';
import { resolveModelRoute } from './cost/ai-model-router.util';
import { AiUsageFeature, AiUsageSource, AiModelTier } from './cost/ai-cost.types';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';

export interface CustomerAgentRunInput {
  sessionId: string;
  chatId: string;
  incomingText: string;
  branchId?: string | null;
  messageId?: string;
  requestId?: string;
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
    private readonly contextService: AiInboxContextService,
    private readonly customerTools: AiCustomerToolsService,
    private readonly aiAudit: AiAuditService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly learning: AiLearningService,
    private readonly costTracker: AiCostTrackerService,
  ) {}

  async runCustomerAgent(input: CustomerAgentRunInput): Promise<CustomerAgentRunResult> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return { content: null, escalated: false, actions: [] };

    const unrestricted = isAiUnrestricted(config);
    const contextLimit = Math.min(
      Math.max(config.autoReplyContextMessages ?? 8, 1),
      config.autoReplyContextMessagesMax ?? 12,
    );

    const intent = detectCustomerIntent(input.incomingText);
    const contextNeeds = resolveContextNeeds(intent, input.incomingText, config);

    const thread = await this.contextService.buildThread(
      input.sessionId,
      input.chatId,
      input.incomingText,
      contextLimit,
    );
    if (!thread.length) return { content: null, escalated: false, actions: [] };

    const crmBlock = contextNeeds.includeCrm
      ? await this.contextService.buildCrmContextBlock(input.sessionId, input.chatId)
      : '';
    const contextSummary = await this.contextService.buildContextSummary(
      input.sessionId,
      input.chatId,
      contextLimit,
    );
    const catalogBlock = contextNeeds.includeCatalog
      ? await this.customerTools.buildCatalogContextBlock(input.branchId)
      : '';

    const preset = getAutoReplyPreset(config.autoReplyPreset);
    const tone =
      config.autoReplyTone?.trim() ||
      preset?.tone ||
      'Boss-friendly mtaani — warm, simple Swahili/English like Inauzwa staff';
    const custom = config.autoReplyPrompt?.trim() || preset?.prompt || '';

    const knowledgeBlock =
      contextNeeds.includeKnowledge && config.knowledgeRagEnabled !== false
        ? await this.knowledge.buildContextualPromptExcerpt(input.incomingText)
        : '';
    const memoryBlock =
      contextNeeds.includeMemory && config.memoryRagEnabled !== false
        ? await this.memory.buildContextualPromptExcerpt(input.incomingText)
        : '';
    const replySamplesBlock = contextNeeds.includeLearningSamples
      ? await this.learning.buildReplySamplesPromptBlock(input.incomingText)
      : '';

    const systemContent = [
      'You are a WhatsApp shop assistant for this business.',
      `Tone: ${tone}.`,
      'Reply with ONE short customer-facing message after using tools when needed.',
      getInboxCustomerReplyRules(unrestricted),
      'Tool rules:',
      '- Products in the catalog block below are from your linked local inventory (same as Products page).',
      '- Use search_products before quoting prices, stock, or variants (name, SKU, category, IMEI/serial).',
      '- Use search_shop_knowledge for policies, warranty, hours, and FAQs when relevant.',
      '- Use search_memory for long-term facts (customer preferences, past decisions) when relevant.',
      '- Use get_branch_location for location/hours — never hardcode address text.',
      '- Use get_payment_details only when customer asks to pay or requests payment number.',
      '- For installment questions, check installmentEnabled on the product or matching variant in search_products results only.',
      '- Use note_stocking_need when customer wants installment for an out-of-stock product (internal reminder only).',
      '- Use update_lead when you learn name, interest, or pipeline stage.',
      unrestricted
        ? '- Do NOT use escalate_to_human — handle all topics in this chat.'
        : '- Use escalate_to_human when the customer wants a person or you cannot help.',
      '- Never claim payment received or order shipped unless tools confirm it.',
      unrestricted ? AI_UNRESTRICTED_AGENT_PROMPT : '',
      crmBlock,
      contextSummary,
      catalogBlock,
      input.injectPromptBlock,
      input.profileQuestionHint
        ? `Optional profile question (use at most ONE, only if it fits naturally after answering their question): ${input.profileQuestionHint}`
        : '',
      knowledgeBlock,
      memoryBlock,
      replySamplesBlock,
      custom,
    ]
      .filter(Boolean)
      .join('\n\n');

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

    try {
      const result = await this.aiChat.runAssistantWithTools({
        systemContent,
        thread,
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
          messageId: input.messageId,
          requestId: input.requestId,
          tier,
        },
        modelOverride: { provider: route.provider, model: route.model },
      });

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
