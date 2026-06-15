import { Injectable } from '@nestjs/common';
import { AiCustomerIntent } from '../ai-signal.enums';
import { AiKnowledgeService } from '../ai-knowledge.service';
import { AiMemoryService } from '../ai-memory.service';
import { AiInboxContextService } from '../ai-inbox-context.service';
import { AiCustomerToolsService } from '../ai-customer-tools.service';
import { AiConversationFactsService } from '../learning/ai-conversation-facts.service';
import { AiSettingsService } from '../ai-settings.service';
import { resolveContextNeeds, resolveHistoryLimit } from '../cost/ai-context-optimizer.util';
import { buildRulesBlock } from './ai-reply-rule-packs';
import {
  estimateTokensFromBlocks,
  resolvePromptBudgetWarning,
  type PromptTokenBreakdown,
  type PromptBudgetWarning,
} from './ai-prompt-token-estimator.util';
import { detectCustomerIntent } from '../utils/ai-intent-detector.util';
import { getAutoReplyPreset } from '../ai-auto-reply-presets';
import { AI_UNRESTRICTED_AGENT_PROMPT, isAiUnrestricted } from '../utils/ai-unrestricted.util';

export interface PromptAssemblyInput {
  sessionId: string;
  chatId: string;
  incomingText: string;
  branchId?: string | null;
  intent?: AiCustomerIntent;
  isAdminDeepTest?: boolean;
  injectPromptBlock?: string;
  profileQuestionHint?: string;
  unrestricted?: boolean;
}

export interface PromptAssemblyResult {
  systemContent: string;
  thread: { role: 'user' | 'assistant'; content: string }[];
  breakdown: PromptTokenBreakdown;
  budgetWarning: PromptBudgetWarning;
  intent: AiCustomerIntent;
  historyLimit: number;
}

@Injectable()
export class AiPromptAssemblerService {
  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly contextService: AiInboxContextService,
    private readonly customerTools: AiCustomerToolsService,
    private readonly conversationFacts: AiConversationFactsService,
  ) {}

  async assemble(input: PromptAssemblyInput): Promise<PromptAssemblyResult> {
    const config = await this.aiSettings.getActiveConfig();
    const intent = input.intent ?? detectCustomerIntent(input.incomingText);
    const unrestricted = input.unrestricted ?? isAiUnrestricted(config);
    const historyLimit = resolveHistoryLimit(intent);

    const contextNeeds = resolveContextNeeds(intent, input.incomingText, config ?? {});

    const thread = await this.contextService.buildThread(
      input.sessionId,
      input.chatId,
      input.incomingText,
      historyLimit,
    );

    const rulesBlock = buildRulesBlock(intent, input.incomingText);

    const knowledgeLimits = {
      maxChunks: config?.knowledgeMaxChunks ?? 2,
      maxCharsPerChunk: config?.knowledgeMaxCharsPerChunk ?? 600,
      maxTotalChars: config?.knowledgeMaxTotalChars ?? 1200,
    };

    const knowledgeBlock =
      contextNeeds.includeKnowledge && config?.knowledgeRagEnabled !== false
        ? await this.knowledge.buildAutoReplyKnowledgeExcerpt(input.incomingText, knowledgeLimits)
        : '';

    const memoryBlock =
      contextNeeds.includeMemory && config?.memoryRagEnabled !== false
        ? await this.memory.buildContextualPromptExcerpt(input.incomingText, 500)
        : '';

    const crmBlock = contextNeeds.includeCrm
      ? await this.contextService.buildCrmContextBlock(input.sessionId, input.chatId)
      : '';

    const contextSummary = await this.contextService.buildContextSummary(
      input.sessionId,
      input.chatId,
      historyLimit,
      { includeRecentMessages: false },
    );

    const factsBlock =
      contextNeeds.includeMemory ||
      contextNeeds.includeCrm ||
      contextNeeds.includeCatalog
        ? await this.conversationFacts.buildFactsSummaryBlock(
            `${input.sessionId}:${input.chatId}`,
          )
        : '';

    const catalogBlock = contextNeeds.includeCatalog
      ? await this.customerTools.buildCatalogContextBlock(input.branchId)
      : '';

    const preset = getAutoReplyPreset(config?.autoReplyPreset);
    const tone =
      config?.autoReplyTone?.trim() ||
      preset?.tone ||
      'Boss-friendly mtaani — warm, simple Swahili/English like Inauzwa staff';
    const custom = config?.autoReplyPrompt?.trim() || preset?.prompt || '';

    const toolRuleLines = ['Tool rules:'];
    if (contextNeeds.includeCatalog) {
      toolRuleLines.push(
        '- Products in the catalog block below are from your linked local inventory.',
        '- Use search_products before quoting prices, stock, or variants.',
      );
    }
    if (contextNeeds.includeKnowledge) {
      toolRuleLines.push(
        '- Use search_shop_knowledge for policies, warranty, hours, and FAQs when relevant.',
      );
    }
    if (contextNeeds.includeMemory) {
      toolRuleLines.push('- Use search_memory for long-term facts when relevant.');
    }
    if (contextNeeds.includeCrm) {
      toolRuleLines.push(
        '- Use get_branch_location for location/hours — never hardcode address text.',
        '- Use get_payment_details only when customer asks to pay.',
      );
    }
    toolRuleLines.push(
      unrestricted
        ? '- Do NOT use escalate_to_human — handle all topics in this chat.'
        : '- Use escalate_to_human when the customer wants a person or you cannot help.',
    );
    const toolRules = toolRuleLines.join('\n');

    const historyText = thread.map(m => `${m.role}: ${m.content}`).join('\n');

    const systemContent = [
      'You are a WhatsApp shop assistant for this business.',
      `Tone: ${tone}.`,
      'Reply with ONE short customer-facing message after using tools when needed.',
      rulesBlock,
      toolRules,
      unrestricted ? AI_UNRESTRICTED_AGENT_PROMPT : '',
      crmBlock,
      contextSummary,
      factsBlock,
      catalogBlock,
      input.injectPromptBlock,
      input.profileQuestionHint
        ? `Optional profile question (use at most ONE, only if it fits naturally): ${input.profileQuestionHint}`
        : '',
      knowledgeBlock,
      memoryBlock,
      custom,
    ]
      .filter(Boolean)
      .join('\n\n');

    const breakdown = estimateTokensFromBlocks({
      rules: rulesBlock + toolRules,
      knowledge: knowledgeBlock,
      history: historyText,
      tools: '',
      customerMessage: input.incomingText,
      crm: [crmBlock, contextSummary, factsBlock].filter(Boolean).join('\n'),
      catalog: catalogBlock,
      memory: memoryBlock,
    });

    const budgetWarning = resolvePromptBudgetWarning(breakdown, intent, {
      simpleBudget: config?.autoReplySimplePromptBudgetTokens ?? 500,
      autoReplyBudget: config?.autoReplyPromptBudgetTokens ?? 1500,
    });

    return {
      systemContent,
      thread,
      breakdown,
      budgetWarning,
      intent,
      historyLimit,
    };
  }
}
