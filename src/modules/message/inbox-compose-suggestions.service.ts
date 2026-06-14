import { Injectable, Logger } from '@nestjs/common';
import { AiChatService } from '../ai/ai-chat.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AiInboxContextService } from '../ai/ai-inbox-context.service';
import { AiUsageFeature, AiUsageSource } from '../ai/cost/ai-cost.types';
import { QuickReplyService } from '../quick-reply/quick-reply.service';
import { MessageService } from './message.service';
import { renderTemplate, TemplateVariables } from '../followup/utils/template.util';

export type ComposeSuggestionTone = 'warm' | 'descriptive';

export interface ComposeSuggestion {
  body: string;
  tone: ComposeSuggestionTone;
}

export interface ComposeSuggestionsResult {
  suggestions: ComposeSuggestion[];
  source: 'ai' | 'templates';
}

@Injectable()
export class InboxComposeSuggestionsService {
  private readonly logger = new Logger(InboxComposeSuggestionsService.name);

  constructor(
    private readonly messageService: MessageService,
    private readonly aiInboxContext: AiInboxContextService,
    private readonly aiChat: AiChatService,
    private readonly aiSettings: AiSettingsService,
    private readonly quickReplyService: QuickReplyService,
  ) {}

  async suggest(sessionId: string, chatId: string): Promise<ComposeSuggestionsResult> {
    const history = await this.messageService.getChatMessagesForAi(sessionId, chatId, 16);
    const lastIncoming = [...history.messages]
      .reverse()
      .find(m => m.direction === 'incoming' && m.body?.trim());

    const lastCustomerText = lastIncoming?.body?.trim() ?? '';
    const templates = await this.quickReplyService.findForInbox();

    if (!lastCustomerText) {
      const fallback = this.templateFallback(templates, '', null);
      return { suggestions: fallback, source: 'templates' };
    }

    const aiSuggestions = await this.tryAiSuggestions(sessionId, chatId, lastCustomerText);
    if (aiSuggestions.length >= 2) {
      return { suggestions: aiSuggestions.slice(0, 2), source: 'ai' };
    }

    const crm = await this.aiInboxContext.buildCrmContextBlock(sessionId, chatId);
    const customerName = this.extractCustomerName(crm);
    const variables: TemplateVariables = { customer_name: customerName ?? undefined };
    const ranked = this.rankTemplates(templates, lastCustomerText, variables);

    if (ranked.length >= 2) {
      return {
        suggestions: [
          { body: ranked[0], tone: 'warm' },
          { body: ranked[1], tone: 'descriptive' },
        ],
        source: 'templates',
      };
    }

    if (aiSuggestions.length === 1 && ranked.length >= 1) {
      return {
        suggestions: [
          { body: aiSuggestions[0].body, tone: 'warm' },
          { body: ranked[0], tone: 'descriptive' },
        ],
        source: 'ai',
      };
    }

    const fallback = this.templateFallback(templates, lastCustomerText, customerName);
    return { suggestions: fallback, source: 'templates' };
  }

  private async tryAiSuggestions(
    sessionId: string,
    chatId: string,
    lastCustomerText: string,
  ): Promise<ComposeSuggestion[]> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return [];

    try {
      const context = await this.aiInboxContext.buildContextSummary(sessionId, chatId, 12);
      const crmBlock = await this.aiInboxContext.buildCrmContextBlock(sessionId, chatId);

      const result = await this.aiChat.runAssistantWithTools({
        systemContent: [
          'You draft WhatsApp staff reply options for a patient/customer support inbox.',
          'Return ONLY valid JSON: {"options":[{"body":"...","tone":"warm"|"descriptive"}, ...]}',
          'Provide exactly 2 options.',
          'warm: empathetic, personable, uses customer name when known.',
          'descriptive: concise, factual, specific details.',
          'Do not invent medical facts, prices, or commitments not supported by context.',
          'Keep each body under 320 characters.',
          crmBlock,
          context,
        ].join('\n'),
        thread: [{ role: 'user', content: `Customer just wrote:\n${lastCustomerText}` }],
        tools: [],
        executeTool: async () => '',
        maxIterations: 1,
        maxTokens: 512,
        temperature: 0.55,
        callContext: {
          feature: AiUsageFeature.INBOX_ASSISTANT,
          source: AiUsageSource.ADMIN_MANUAL,
          conversationId: chatId,
        },
      });

      const parsed = this.parseAiOptions(result.content ?? '');
      return parsed;
    } catch (err) {
      this.logger.debug(`AI compose suggestions skipped: ${String(err)}`);
      return [];
    }
  }

  private parseAiOptions(content: string): ComposeSuggestion[] {
    const trimmed = content.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    try {
      const data = JSON.parse(jsonMatch[0]) as {
        options?: Array<{ body?: string; tone?: string }>;
      };
      const options = data.options ?? [];
      return options
        .map(opt => {
          const body = opt.body?.trim();
          if (!body) return null;
          const tone: ComposeSuggestionTone =
            opt.tone === 'descriptive' ? 'descriptive' : 'warm';
          return { body, tone };
        })
        .filter((row): row is ComposeSuggestion => row !== null);
    } catch {
      return [];
    }
  }

  private rankTemplates(
    templates: Array<{ body: string; name: string }>,
    lastCustomerText: string,
    variables: TemplateVariables,
  ): string[] {
    const tokens = this.tokenize(lastCustomerText);
    const scored = templates
      .map(tpl => {
        const rendered = renderTemplate(tpl.body, variables).trim();
        if (!rendered) return { rendered, score: -1 };
        const hay = `${tpl.name} ${tpl.body} ${rendered}`.toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (hay.includes(token)) score += 2;
        }
        if (rendered.length > 40 && rendered.length < 280) score += 1;
        return { rendered, score };
      })
      .filter(row => row.score >= 0)
      .sort((a, b) => b.score - a.score);

    const unique: string[] = [];
    for (const row of scored) {
      if (!unique.includes(row.rendered)) unique.push(row.rendered);
      if (unique.length >= 2) break;
    }
    return unique;
  }

  private templateFallback(
    templates: Array<{ body: string; name: string }>,
    lastCustomerText: string,
    customerName: string | null,
  ): ComposeSuggestion[] {
    const variables: TemplateVariables = { customer_name: customerName ?? undefined };
    const ranked = this.rankTemplates(templates, lastCustomerText, variables);
    if (ranked.length >= 2) {
      return [
        { body: ranked[0], tone: 'warm' },
        { body: ranked[1], tone: 'descriptive' },
      ];
    }
    if (ranked.length === 1) {
      return [
        { body: ranked[0], tone: 'warm' },
        { body: this.descriptiveVariant(ranked[0]), tone: 'descriptive' },
      ];
    }

    const bodies = templates
      .map(t => renderTemplate(t.body, variables).trim())
      .filter(Boolean)
      .slice(0, 2);

    if (bodies.length === 0) return [];

    return [
      { body: bodies[0], tone: 'warm' },
      { body: bodies[1] ?? this.descriptiveVariant(bodies[0]), tone: 'descriptive' },
    ];
  }

  private descriptiveVariant(text: string): string {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 1) return text;
    return sentences.slice(0, 2).join(' ');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 12);
  }

  private extractCustomerName(crmBlock: string): string | null {
    const match = crmBlock.match(/Customer name:\s*(.+)/i);
    return match?.[1]?.trim() ?? null;
  }
}
