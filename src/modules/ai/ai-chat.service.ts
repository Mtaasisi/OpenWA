import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiAppToolsService, OPENWA_ASSISTANT_SYSTEM_PROMPT } from './ai-app-tools';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMemoryService } from './ai-memory.service';
import { AiProvider } from './ai.enums';
import { PROVIDER_BASE_URLS } from './ai-provider-catalog';
import { formatAiProviderError } from './utils/ai-error.util';
import { buildMultimodalUserContent, isVisionCapableModel, type ChatImageAttachment } from './utils/ai-vision.util';
import type { AiConfig } from './entities/ai-config.entity';
import type { AiToolDefinition } from './ai-app-tools';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { INBOX_CUSTOMER_REPLY_RULES } from './ai-inbox-reply-rules';
import { sanitizeCustomerAiReply } from './utils/ai-behavior.util';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';
import { AiBudgetGuardService } from './cost/ai-budget-guard.service';
import { AiModelRouterService } from './cost/ai-model-router.service';
import {
  AiCallContext,
  AiUsageFeature,
  AiUsageSource,
  AiUsageStatus,
  type AiProviderUsage,
} from './cost/ai-cost.types';
import { resolveModelRoute } from './cost/ai-model-router.util';
import { AiModelTier } from './cost/ai-cost.types';

const MAX_STAFF_TOOL_ITERATIONS = 5;
const CUSTOMER_TIMEOUT_MS = 45000;
const STAFF_TIMEOUT_MS = 90000;

type ChatContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ChatContent;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface StaffChatMessageInput {
  role: string;
  content: string;
  images?: ChatImageAttachment[];
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolAction {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

export interface StaffChatContext {
  userId?: string;
  apiKeyId?: string;
}

interface ProviderCallResult {
  content?: string;
  toolCalls?: ToolCall[];
  usage?: AiProviderUsage;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly appTools: AiAppToolsService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly costTracker: AiCostTrackerService,
    private readonly budgetGuard: AiBudgetGuardService,
    private readonly modelRouter: AiModelRouterService,
  ) {}

  async chat(
    userMessages: StaffChatMessageInput[],
    apiKeyRole: ApiKeyRole = ApiKeyRole.OPERATOR,
    staffContext?: StaffChatContext,
    callContext?: Partial<AiCallContext>,
  ) {
    const ctx: AiCallContext = {
      feature: callContext?.feature ?? AiUsageFeature.ADMIN_ASSISTANT,
      source: callContext?.source ?? AiUsageSource.ADMIN_MANUAL,
      ...callContext,
    };

    const config = await this.aiSettings.getActiveConfig();
    if (!config) {
      throw new BadRequestException(
        'AI is not configured or disabled. Go to Settings → Integrations → AI.',
      );
    }

    if (!ctx.skipBudgetCheck) {
      const budget = await this.budgetGuard.checkBeforeCall(ctx);
      if (!budget.allowed) {
        await this.budgetGuard.logBudgetBlocked(ctx, budget.reason ?? 'budget_blocked');
        throw new BadRequestException(
          'AI daily or monthly budget exceeded. Adjust limits in Settings → AI → Cost Safety.',
        );
      }
    }

    const route = resolveModelRoute(config, ctx.feature, ctx.tier ?? AiModelTier.BALANCED);
    const maxIterations = Math.min(
      callContext?.maxIterations ?? config.maxAdminToolIterations ?? MAX_STAFF_TOOL_ITERATIONS,
      config.maxAdminToolIterations ?? MAX_STAFF_TOOL_ITERATIONS,
    );
    const maxTokens = this.costTracker.clampMaxTokens(
      ctx.feature,
      callContext?.maxTokens ?? config.maxTokens,
      config.aiFeatureLimits,
    );

    const apiKey = this.aiSettings.decryptKey(config);
    const allTools = this.appTools.getToolDefinitionsForRole(apiKeyRole);
    const tools = this.aiSettings.filterTools(allTools, config);
    const actions: ToolAction[] = [];
    const start = Date.now();
    let totalUsage: AiProviderUsage = { inputTokens: 0, outputTokens: 0 };
    let aiCallsCount = 0;
    let toolCallsCount = 0;
    const toolCache = new Map<string, string>();

    const customPrompt = config.systemPrompt?.trim();
    const knowledgeBlock =
      config.knowledgeRagEnabled !== false ? this.knowledge.buildPromptExcerpt() : '';
    const systemContent = [OPENWA_ASSISTANT_SYSTEM_PROMPT, knowledgeBlock, customPrompt]
      .filter((s) => s && s.length > 0)
      .join('\n\n');

    const hasImages = userMessages.some(m => m.role === 'user' && (m.images?.length ?? 0) > 0);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...userMessages.map((m) => {
        const role = m.role as 'user' | 'assistant';
        if (role === 'user' && m.images?.length) {
          return { role, content: buildMultimodalUserContent(m.content, m.images) };
        }
        return { role, content: m.content };
      }),
    ];

    const fallbacks = await this.aiSettings.getResolvedFallbacks(config);
    let providerChain = [
      { provider: route.provider, model: route.model, apiKey, baseUrl: config.baseUrl },
      ...fallbacks,
    ];
    if (hasImages) {
      const visionChain = providerChain.filter(c => isVisionCapableModel(c.model));
      if (!visionChain.length) {
        throw new BadRequestException(
          'Image attachments require a vision-capable model. Update AI settings or add a vision fallback.',
        );
      }
      providerChain = visionChain;
    }

    let activeProvider = route.provider;
    let activeModel = route.model;

    const deadline = start + STAFF_TIMEOUT_MS;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() > deadline) break;

      let response: ProviderCallResult | undefined;
      let lastErr: Error | null = null;
      let succeeded = false;

      for (const candidate of providerChain) {
        try {
          response = await this.callWithTools(
            candidate.provider,
            candidate.model,
            candidate.apiKey,
            candidate.baseUrl,
            messages,
            tools,
            maxTokens,
            config.temperature,
          );
          activeProvider = candidate.provider as AiProvider;
          activeModel = candidate.model;
          succeeded = true;
          aiCallsCount++;
          if (response.usage) {
            totalUsage.inputTokens += response.usage.inputTokens;
            totalUsage.outputTokens += response.usage.outputTokens;
          }
          break;
        } catch (err: unknown) {
          lastErr = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!succeeded) {
        await this.costTracker.recordUsage({
          context: ctx,
          provider: activeProvider,
          model: activeModel,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          toolCallsCount,
          aiCallsCount,
          status: AiUsageStatus.FAILED,
          errorMessage: lastErr?.message,
        });
        throw new BadRequestException(
          lastErr?.message ?? 'All AI providers failed. Check your API key and fallback models in Settings → Integrations → AI.',
        );
      }

      const res = response!;

      if (res.toolCalls?.length) {
        messages.push({ role: 'assistant', content: '', tool_calls: res.toolCalls });
        for (const tc of res.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            /* empty */
          }
          const cacheKey = `${tc.function.name}:${JSON.stringify(args)}`;
          let result: string;
          if (toolCache.has(cacheKey)) {
            result = toolCache.get(cacheKey)!;
          } else {
            result = await this.appTools.executeTool(tc.function.name, args, apiKeyRole, {
              userId: staffContext?.userId,
              apiKeyId: staffContext?.apiKeyId,
            });
            toolCache.set(cacheKey, result);
            toolCallsCount++;
          }
          actions.push({ tool: tc.function.name, args, result });
          messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
        }
        continue;
      }

      if (res.content) {
        const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
        await this.costTracker.recordUsage({
          context: ctx,
          provider: activeProvider,
          model: activeModel,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          toolCallsCount,
          aiCallsCount,
          status: AiUsageStatus.SUCCESS,
        });
        return {
          content: text,
          actions,
          provider: activeProvider,
          model: activeModel,
          latencyMs: Date.now() - start,
        };
      }
      break;
    }

    const fallbackContent =
      actions.length > 0
        ? `Done. ${actions.map((a) => a.result.slice(0, 200)).join(' | ')}`
        : `The model (${route.provider}/${route.model}) returned an empty response. Try another model in AI settings.`;

    await this.costTracker.recordUsage({
      context: ctx,
      provider: activeProvider,
      model: activeModel,
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      toolCallsCount,
      aiCallsCount,
      status: AiUsageStatus.SUCCESS,
    });

    return {
      content: fallbackContent,
      actions,
      provider: route.provider,
      model: route.model,
      latencyMs: Date.now() - start,
    };
  }

  async runAssistantWithTools(options: {
    systemContent: string;
    thread: { role: 'user' | 'assistant'; content: string }[];
    tools: AiToolDefinition[];
    executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
    maxTokens?: number;
    temperature?: number;
    callContext?: AiCallContext;
    modelOverride?: { provider: string; model: string };
  }): Promise<{
    content: string;
    actions: ToolAction[];
    provider: string;
    model: string;
    latencyMs: number;
    aiCallsCount: number;
    toolCallsCount: number;
  }> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) {
      throw new BadRequestException('AI is not configured or disabled.');
    }

    const ctx = options.callContext;
    if (ctx && !ctx.skipBudgetCheck) {
      const budget = await this.budgetGuard.checkBeforeCall(ctx);
      if (!budget.allowed) {
        await this.budgetGuard.logBudgetBlocked(ctx, budget.reason ?? 'budget_blocked');
        return {
          content: '',
          actions: [],
          provider: config.provider,
          model: config.model,
          latencyMs: 0,
          aiCallsCount: 0,
          toolCallsCount: 0,
        };
      }
    }

    const route = options.modelOverride
      ? { provider: options.modelOverride.provider, model: options.modelOverride.model }
      : ctx
        ? resolveModelRoute(config, ctx.feature, ctx.tier)
        : { provider: config.provider, model: config.model };

    const feature = ctx?.feature ?? AiUsageFeature.BACKGROUND_JOB;
    const maxTokens = this.costTracker.clampMaxTokens(
      feature,
      options.maxTokens ?? config.maxTokens,
      config.aiFeatureLimits,
    );

    const defaultIterations =
      feature === AiUsageFeature.WHATSAPP_AUTO_REPLY
        ? config.maxCustomerToolIterations ?? 2
        : config.maxAdminToolIterations ?? MAX_STAFF_TOOL_ITERATIONS;
    const maxIterations = Math.min(options.maxIterations ?? defaultIterations, defaultIterations);

    const apiKey = this.aiSettings.decryptKey(config);
    const actions: ToolAction[] = [];
    const start = Date.now();
    let totalUsage: AiProviderUsage = { inputTokens: 0, outputTokens: 0 };
    let aiCallsCount = 0;
    let toolCallsCount = 0;
    const toolCache = new Map<string, string>();
    const timeoutMs =
      feature === AiUsageFeature.WHATSAPP_AUTO_REPLY ? CUSTOMER_TIMEOUT_MS : STAFF_TIMEOUT_MS;
    const deadline = start + timeoutMs;

    const messages: ChatMessage[] = [
      { role: 'system', content: options.systemContent },
      ...options.thread.map(m => ({ role: m.role, content: m.content.trim() })),
    ];

    const fallbacks = await this.aiSettings.getResolvedFallbacks(config);
    const providerChain = [
      { provider: route.provider, model: route.model, apiKey, baseUrl: config.baseUrl },
      ...fallbacks,
    ];

    let activeProvider = route.provider;
    let activeModel = route.model;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() > deadline) break;

      let response: ProviderCallResult | undefined;
      let lastErr: Error | null = null;
      let succeeded = false;

      for (const candidate of providerChain) {
        try {
          response = await this.callWithTools(
            candidate.provider,
            candidate.model,
            candidate.apiKey,
            candidate.baseUrl,
            messages,
            options.tools,
            maxTokens,
            options.temperature ?? config.temperature,
          );
          activeProvider = candidate.provider as AiProvider;
          activeModel = candidate.model;
          succeeded = true;
          aiCallsCount++;
          if (response.usage) {
            totalUsage.inputTokens += response.usage.inputTokens;
            totalUsage.outputTokens += response.usage.outputTokens;
          }
          break;
        } catch (err: unknown) {
          lastErr = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!succeeded) {
        if (ctx) {
          await this.costTracker.recordUsage({
            context: ctx,
            provider: activeProvider,
            model: activeModel,
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            toolCallsCount,
            aiCallsCount,
            status: AiUsageStatus.FAILED,
            errorMessage: lastErr?.message,
          });
        }
        throw new BadRequestException(
          lastErr?.message ?? 'All AI providers failed. Check API key and fallbacks in Settings → AI.',
        );
      }

      const res = response!;
      if (res.toolCalls?.length) {
        messages.push({ role: 'assistant', content: '', tool_calls: res.toolCalls });
        for (const tc of res.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            /* empty */
          }
          const cacheKey = `${tc.function.name}:${JSON.stringify(args)}`;
          let result: string;
          if (toolCache.has(cacheKey)) {
            result = toolCache.get(cacheKey)!;
          } else {
            result = await options.executeTool(tc.function.name, args);
            toolCache.set(cacheKey, result);
            toolCallsCount++;
          }
          actions.push({ tool: tc.function.name, args, result });
          if (result.includes('"escalated":true')) {
            if (ctx) {
              await this.costTracker.recordUsage({
                context: ctx,
                provider: activeProvider,
                model: activeModel,
                inputTokens: totalUsage.inputTokens,
                outputTokens: totalUsage.outputTokens,
                toolCallsCount,
                aiCallsCount,
                status: AiUsageStatus.SUCCESS,
              });
            }
            return {
              content: '',
              actions,
              provider: activeProvider,
              model: activeModel,
              latencyMs: Date.now() - start,
              aiCallsCount,
              toolCallsCount,
            };
          }
          messages.push({ role: 'tool', content: result, tool_call_id: tc.id });
        }
        continue;
      }

      if (res.content?.trim()) {
        if (ctx) {
          await this.costTracker.recordUsage({
            context: ctx,
            provider: activeProvider,
            model: activeModel,
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            toolCallsCount,
            aiCallsCount,
            status: AiUsageStatus.SUCCESS,
          });
        }
        return {
          content: res.content.trim(),
          actions,
          provider: activeProvider,
          model: activeModel,
          latencyMs: Date.now() - start,
          aiCallsCount,
          toolCallsCount,
        };
      }
      break;
    }

    const fallbackContent =
      actions.length > 0 ? '' : `The model (${route.provider}/${route.model}) returned an empty response.`;

    if (ctx) {
      await this.costTracker.recordUsage({
        context: ctx,
        provider: activeProvider,
        model: activeModel,
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        toolCallsCount,
        aiCallsCount,
        status: AiUsageStatus.SUCCESS,
      });
    }

    return {
      content: fallbackContent,
      actions,
      provider: route.provider,
      model: route.model,
      latencyMs: Date.now() - start,
      aiCallsCount,
      toolCallsCount,
    };
  }

  async completeStructuredPrompt(
    system: string,
    user: string,
    maxTokens = 256,
    callContext?: AiCallContext,
  ): Promise<string | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return null;

    const ctx = callContext ?? {
      feature: AiUsageFeature.BACKGROUND_JOB,
      source: AiUsageSource.BACKGROUND_JOB,
    };

    if (!ctx.skipBudgetCheck) {
      const budget = await this.budgetGuard.checkBeforeCall(ctx);
      if (!budget.allowed) return null;
    }

    const route = resolveModelRoute(config, ctx.feature, ctx.tier ?? AiModelTier.CHEAP_FAST);
    const clampedTokens = this.costTracker.clampMaxTokens(
      ctx.feature,
      maxTokens,
      config.aiFeatureLimits,
    );

    const apiKey = this.aiSettings.decryptKey(config);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    const fallbacks = await this.aiSettings.getResolvedFallbacks(config);
    const providerChain = [
      { provider: route.provider, model: route.model, apiKey, baseUrl: config.baseUrl },
      ...fallbacks,
    ];

    for (const candidate of providerChain) {
      try {
        const res = await this.callWithTools(
          candidate.provider,
          candidate.model,
          candidate.apiKey,
          candidate.baseUrl,
          messages,
          [],
          clampedTokens,
          0.1,
        );
        const text = res.content?.trim();
        if (text) {
          await this.costTracker.recordUsage({
            context: ctx,
            provider: candidate.provider,
            model: candidate.model,
            inputTokens: res.usage?.inputTokens ?? 0,
            outputTokens: res.usage?.outputTokens ?? 0,
            aiCallsCount: 1,
            status: AiUsageStatus.SUCCESS,
          });
          return text;
        }
      } catch {
        /* try next provider */
      }
    }
    return null;
  }

  async generateInboxAutoReply(input: {
    thread: { role: 'user' | 'assistant'; content: string }[];
    customPrompt?: string | null;
  }): Promise<string | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return null;

    const contextLimit = Math.min(
      Math.max(config.autoReplyContextMessages ?? 8, 1),
      config.autoReplyContextMessagesMax ?? 12,
    );
    const thread = input.thread.filter(m => m.content.trim()).slice(-contextLimit);
    if (!thread.length) return null;

    const latestUser = [...thread].reverse().find(m => m.role === 'user')?.content ?? '';
    const custom = input.customPrompt?.trim() || config.autoReplyPrompt?.trim() || '';
    const [knowledgeBlock, memoryBlock] = await Promise.all([
      config.knowledgeRagEnabled !== false
        ? this.knowledge.buildContextualPromptExcerpt(latestUser)
        : Promise.resolve(''),
      config.memoryRagEnabled !== false
        ? this.memory.buildContextualPromptExcerpt(latestUser)
        : Promise.resolve(''),
    ]);
    const systemContent = [
      'You are a WhatsApp shop assistant in an ongoing conversation with a customer.',
      'Reply with ONE short message to the customer’s latest message only.',
      INBOX_CUSTOMER_REPLY_RULES,
      '- Never claim you completed an order, checked stock, or sent payment unless you truly did.',
      knowledgeBlock,
      memoryBlock,
      custom,
    ]
      .filter(Boolean)
      .join('\n');

    const route = resolveModelRoute(config, AiUsageFeature.WHATSAPP_AUTO_REPLY);
    const maxTokens = this.costTracker.clampMaxTokens(
      AiUsageFeature.WHATSAPP_AUTO_REPLY,
      220,
      config.aiFeatureLimits,
    );

    const result = await this.runAssistantWithTools({
      systemContent,
      thread,
      tools: [],
      executeTool: async () => '',
      maxIterations: 1,
      maxTokens,
      temperature: Math.min(config.temperature ?? 0.7, 0.6),
      callContext: {
        feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
        source: AiUsageSource.ADMIN_MANUAL,
      },
      modelOverride: { provider: route.provider, model: route.model },
    });

    const text = result.content?.trim();
    return text ? sanitizeCustomerAiReply(text).slice(0, 1200) : null;
  }

  private async callWithTools(
    provider: string,
    model: string,
    apiKey: string,
    baseUrl: string | null | undefined,
    messages: ChatMessage[],
    tools: { name: string; description: string; parameters: Record<string, unknown> }[],
    maxTokens: number,
    temperature: number,
  ): Promise<ProviderCallResult> {
    switch (provider) {
      case AiProvider.GEMINI:
        return this.callOpenAIWithTools(
          model,
          apiKey,
          'https://generativelanguage.googleapis.com/v1beta/openai',
          messages,
          tools,
          maxTokens,
          temperature,
        );
      case AiProvider.ANTHROPIC:
        return this.callAnthropicWithTools(model, apiKey, messages, tools, maxTokens, temperature);
      case AiProvider.OPENAI:
        return this.callOpenAIWithTools(
          model,
          apiKey,
          'https://api.openai.com/v1',
          messages,
          tools,
          maxTokens,
          temperature,
        );
      case AiProvider.OLLAMA:
        return this.callOpenAIWithTools(
          model,
          apiKey,
          baseUrl ?? 'http://localhost:11434/v1',
          messages,
          tools,
          maxTokens,
          temperature,
        );
      case AiProvider.CUSTOM:
        if (!baseUrl) throw new BadRequestException('baseUrl required for CUSTOM provider');
        return this.callOpenAIWithTools(model, apiKey, baseUrl, messages, tools, maxTokens, temperature);
      default: {
        const url = PROVIDER_BASE_URLS[provider as AiProvider];
        if (!url) throw new BadRequestException(`Unknown provider: ${provider}`);
        return this.callOpenAIWithTools(model, apiKey, url, messages, tools, maxTokens, temperature);
      }
    }
  }

  private async callOpenAIWithTools(
    model: string,
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    tools: { name: string; description: string; parameters: Record<string, unknown> }[],
    maxTokens: number,
    temperature: number,
  ): Promise<ProviderCallResult> {
    const openaiTools = tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const openaiMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id };
      }
      if (m.tool_calls?.length) {
        return { role: 'assistant' as const, content: m.content || null, tool_calls: m.tool_calls };
      }
      return { role: m.role, content: m.content };
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    if (baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://openwa.app';
      headers['X-Title'] = 'OpenWA';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(formatAiProviderError(res.status, body));
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = json.choices?.[0]?.message;
    const usage: AiProviderUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.prompt_tokens ?? 0,
          outputTokens: json.usage.completion_tokens ?? 0,
        }
      : undefined;
    return {
      content: choice?.content ?? undefined,
      toolCalls: choice?.tool_calls?.length ? choice.tool_calls : undefined,
      usage,
    };
  }

  private async callAnthropicWithTools(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    tools: { name: string; description: string; parameters: Record<string, unknown> }[],
    maxTokens: number,
    temperature: number,
  ): Promise<ProviderCallResult> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const anthropicMessages: Array<Record<string, unknown>> = [];

    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
        });
      } else if (m.tool_calls?.length) {
        anthropicMessages.push({
          role: 'assistant',
          content: m.tool_calls.map((tc) => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
          })),
        });
      } else {
        anthropicMessages.push({ role: m.role, content: m.content });
      }
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(formatAiProviderError(res.status, body));
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const textBlock = json.content?.find((b) => b.type === 'text');
    const toolBlocks = json.content?.filter((b) => b.type === 'tool_use') ?? [];
    const usage: AiProviderUsage | undefined = json.usage
      ? {
          inputTokens: json.usage.input_tokens ?? 0,
          outputTokens: json.usage.output_tokens ?? 0,
        }
      : undefined;

    if (toolBlocks.length > 0) {
      return {
        content: textBlock?.text,
        toolCalls: toolBlocks.map((tb) => ({
          id: tb.id!,
          type: 'function' as const,
          function: { name: tb.name!, arguments: JSON.stringify(tb.input) },
        })),
        usage,
      };
    }
    return { content: textBlock?.text, usage };
  }
}
