import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { MessageService } from '../message/message.service';
import { ProductsService } from '../products/products.service';
import { PipelineService } from '../followup/pipeline.service';
import { QuickReplyService } from '../quick-reply/quick-reply.service';
import { QuoteService } from '../quote/quote.service';
import { SessionService } from '../session/session.service';
import { WebhookService } from '../webhook/webhook.service';
import { AuditService } from '../audit/audit.service';
import { FollowupRuleService } from '../followup/followup-rule.service';
import { FollowupTemplateService } from '../followup/followup-template.service';
import { SmsService } from '../sms/sms.service';

export type AiSearchCategory =
  | 'all'
  | 'messages'
  | 'conversations'
  | 'products'
  | 'leads'
  | 'quotes'
  | 'quick_replies'
  | 'followups'
  | 'sessions'
  | 'webhooks'
  | 'audit'
  | 'sms';

export interface SearchEverywhereOptions {
  categories?: AiSearchCategory[];
  sessionId?: string;
  chatId?: string;
  groupsOnly?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AiSearchService {
  constructor(
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    private readonly pipelineService: PipelineService,
    private readonly quickReplyService: QuickReplyService,
    private readonly quoteService: QuoteService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly webhookService: WebhookService,
    private readonly auditService: AuditService,
    private readonly ruleService: FollowupRuleService,
    private readonly templateService: FollowupTemplateService,
    private readonly smsService: SmsService,
  ) {}

  async searchEverywhere(query: string, options: SearchEverywhereOptions = {}) {
    const q = query.trim();
    if (!q) {
      return { query: q, results: {}, totals: {} };
    }

    const limit = Math.min(Math.max(options.limit ?? 10, 1), 25);
    const categories = options.categories?.length ? options.categories : (['all'] as AiSearchCategory[]);
    const run = (cat: AiSearchCategory) => categories.includes('all') || categories.includes(cat);

    const results: Record<string, unknown> = {};
    const totals: Record<string, number> = {};

    const tasks: Array<Promise<void>> = [];

    if (run('messages')) {
      tasks.push(
        this.messageService
          .searchInboxMessages({
            query: q,
            sessionId: options.sessionId,
            chatId: options.chatId,
            groupsOnly: options.groupsOnly,
            limit,
            offset: options.offset,
          })
          .then((r) => {
            results.messages = r.matches;
            totals.messages = r.total;
            results.messagesMeta = {
              returned: r.returned,
              offset: r.offset,
              truncated: r.truncated,
              sort: 'newest_first',
            };
          }),
      );
    }

    if (run('conversations')) {
      tasks.push(
        this.searchConversations(q, limit, options.groupsOnly).then((r) => {
          results.conversations = r;
          totals.conversations = r.length;
        }),
      );
    }

    if (run('products')) {
      tasks.push(
        this.productsService
          .list({ q, limit, offset: 0 })
          .then((listResult) => {
            const items = Array.isArray(listResult) ? listResult : listResult.items;
            const total = Array.isArray(listResult) ? items.length : listResult.total;
            results.products = items.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              category: p.category,
              sellingPrice: p.sellingPrice,
              totalStock: p.totalStock,
              currency: p.currency,
            }));
            totals.products = total;
          }),
      );
    }

    if (run('leads')) {
      tasks.push(
        this.pipelineService.searchLeads(q, undefined, undefined, undefined, limit).then((leads) => {
          results.leads = leads;
          totals.leads = leads.length;
        }),
      );
    }

    if (run('quotes')) {
      tasks.push(
        this.quoteService.search(q, limit).then((quotes) => {
          results.quotes = quotes.map((quote) => ({
            id: quote.id,
            quoteNumber: quote.quoteNumber,
            status: quote.status,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            totalAmount: quote.totalAmount,
            currency: quote.currency,
            sessionId: quote.sessionId,
            chatId: quote.chatId,
            createdAt: quote.createdAt,
            itemNames: (quote.items ?? []).map((i) => i.itemName).filter(Boolean),
          }));
          totals.quotes = quotes.length;
        }),
      );
    }

    if (run('quick_replies')) {
      tasks.push(
        this.quickReplyService.findForInbox(undefined, undefined, q).then((templates) => {
          const slice = templates.slice(0, limit);
          results.quickReplies = slice.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            bodyPreview: t.body.slice(0, 160),
          }));
          totals.quickReplies = slice.length;
        }),
      );
    }

    if (run('followups')) {
      tasks.push(
        this.searchFollowupAutomation(q, limit).then((r) => {
          results.followupRules = r.rules;
          results.followupTemplates = r.templates;
          totals.followupRules = r.rules.length;
          totals.followupTemplates = r.templates.length;
        }),
      );
    }

    if (run('sessions')) {
      tasks.push(
        this.searchSessions(q, limit).then((sessions) => {
          results.sessions = sessions;
          totals.sessions = sessions.length;
        }),
      );
    }

    if (run('webhooks')) {
      tasks.push(
        this.searchWebhooks(q, limit).then((hooks) => {
          results.webhooks = hooks;
          totals.webhooks = hooks.length;
        }),
      );
    }

    if (run('audit')) {
      tasks.push(
        this.auditService.findAll({ search: q, limit }).then(({ data, total }) => {
          results.auditLogs = data.map((l) => ({
            id: l.id,
            action: l.action,
            severity: l.severity,
            sessionName: l.sessionName,
            path: l.path,
            errorMessage: l.errorMessage,
            createdAt: l.createdAt,
          }));
          totals.auditLogs = total;
        }),
      );
    }

    if (run('sms')) {
      tasks.push(
        this.smsService.searchForAi(q, limit).then((r) => {
          if (r.settingsLink) {
            results.smsSettings = r.settingsLink;
          }
          results.smsLogs = r.logs;
          totals.smsLogs = r.logs.length;
        }),
      );
    }

    await Promise.all(tasks);

    return {
      query: q,
      categories: categories.includes('all') ? 'all' : categories,
      results,
      totals,
      hint:
        'Results sorted newest-first. Use search_inbox_messages with offset to paginate. When messagesMeta.truncated is true, more matches exist.',
    };
  }

  private async searchConversations(query: string, limit: number, groupsOnly?: boolean) {
    const q = query.toLowerCase();
    let rows = await this.messageService.getUnifiedConversations();
    if (groupsOnly) {
      rows = rows.filter((r) => r.chatId.endsWith('@g.us'));
    }
    return rows
      .filter(
        (r) =>
          r.displayName?.toLowerCase().includes(q) ||
          r.lastPreview?.toLowerCase().includes(q) ||
          r.chatId.toLowerCase().includes(q) ||
          r.sessionName?.toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map((r) => ({
        sessionId: r.sessionId,
        sessionName: r.sessionName,
        chatId: r.chatId,
        displayName: r.displayName,
        isGroup: r.chatId.endsWith('@g.us'),
        lastPreview: r.lastPreview,
        lastMessageAt: r.lastMessageAt,
        unreadCount: r.unreadCount,
      }));
  }

  private async searchFollowupAutomation(query: string, limit: number) {
    const q = query.toLowerCase();
    const [rules, templates] = await Promise.all([
      this.ruleService.findAll(),
      this.templateService.findAll(),
    ]);
    return {
      rules: rules
        .filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.triggerEvent?.toLowerCase().includes(q) ||
            r.stage?.toLowerCase().includes(q),
        )
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          name: r.name,
          active: r.active,
          triggerEvent: r.triggerEvent,
          stage: r.stage,
        })),
      templates: templates
        .filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.body.toLowerCase().includes(q) ||
            t.category?.toLowerCase().includes(q),
        )
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          bodyPreview: t.body.slice(0, 120),
        })),
    };
  }

  private async searchSessions(query: string, limit: number) {
    const q = query.toLowerCase();
    const sessions = await this.sessionService.findAll();
    return sessions
      .filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.pushName?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        phone: s.phone,
        pushName: s.pushName,
      }));
  }

  private async searchWebhooks(query: string, limit: number) {
    const q = query.toLowerCase();
    const hooks = await this.webhookService.findAll();
    return hooks
      .filter(
        (w) =>
          w.url.toLowerCase().includes(q) ||
          w.events?.some((e) => e.toLowerCase().includes(q)) ||
          w.sessionId?.toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map((w) => ({
        id: w.id,
        sessionId: w.sessionId,
        url: w.url.length > 64 ? `${w.url.slice(0, 56)}…` : w.url,
        events: w.events,
        active: w.active,
      }));
  }
}
