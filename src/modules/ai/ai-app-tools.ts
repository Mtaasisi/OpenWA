import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatsService } from '../stats/stats.service';
import { SessionService } from '../session/session.service';
import { WebhookService } from '../webhook/webhook.service';
import { ProductsService } from '../products/products.service';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { PipelineService } from '../followup/pipeline.service';
import { FollowupQueueService } from '../followup/followup-queue.service';
import { FollowupRuleService } from '../followup/followup-rule.service';
import { FollowupTemplateService } from '../followup/followup-template.service';
import { FollowupKpiService } from '../followup/followup-kpi.service';
import { QuickReplyService } from '../quick-reply/quick-reply.service';
import { QuoteService } from '../quote/quote.service';
import { PluginsService } from '../plugins/plugins.service';
import { MessageService } from '../message/message.service';
import { AuditService } from '../audit/audit.service';
import { InfraStatusService } from '../infra/infra-status.service';
import { FollowUpQueueFilter, PipelineBucket } from '../followup/followup.enums';
import { AiSearchService } from './ai-search.service';
import { AiMemoryService } from './ai-memory.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { AgentActionRouterService } from '../agent-actions/agent-action-router.service';
import type { AgentActionRequest } from '../agent-actions/agent-action.types';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const OPENWA_ASSISTANT_SYSTEM_PROMPT = `You are the OpenWA AI assistant — an expert on this WhatsApp CRM dashboard.

OpenWA features you can query with tools:
- **Global search** across WhatsApp messages, chats/groups, products, leads, quotes, quick replies, follow-ups, sessions, webhooks, SMS logs, and audit logs (search_everywhere)
- Read full message history in a chat (get_chat_messages) or search message text (search_inbox_messages)
- Dashboard & message analytics (overview, time series, top chats)
- WhatsApp sessions & unified Inbox conversations
- Sales pipeline (leads by bucket, search, KPIs, reports, recent sales)
- Follow-ups (queue, counts, automation rules/templates, staff KPI reports)
- Product catalog & INAUZWA sync
- Quick replies & quotes
- Webhooks, plugins, infrastructure (DB/Redis/engine), audit logs, app settings
- Long-term memory files (memory_search, memory_get, memory_write) for facts across conversations
- Shop knowledge markdown (shop_knowledge_*) — rules that control inbox auto-reply (AI_REPLY_RULES.md, SHOP.md, FAQ.md, etc.)

Always use tools for live counts, lists, and status — never guess.
For questions about prior decisions, people, or preferences, call memory_search first.
To change how the inbox AI replies, read then update shop knowledge files (start with AI_REPLY_RULES.md) via shop_knowledge_write or shop_knowledge_append_rule.

**System operator:** You can change app settings when the user asks in Swahili or English (e.g. "Zima AI auto reply", "Reindex knowledge"). Safe changes run automatically; risky changes require confirmation buttons — never bypass confirmation. Never expose API keys or secrets. If you cannot execute safely, provide a quick link to the exact settings page.
For any user question about finding text, prices, products, people, or messages, start with search_everywhere (set groupsOnly:true when they mean WhatsApp groups).
Message search returns newest-first (NOT sorted by price). When user asks for cheapest/best price, call search_inbox_messages repeatedly with offset until truncated is false, then compare prices from ALL pages. Always state "showing X of Y total" when truncated is true.
Be concise; use bullet lists for multiple items.
Money may be in minor units (cents) — divide by 100 when showing currency if values look large.
If AI is disabled, direct users to Settings → Integrations → AI.
You cannot send WhatsApp messages from this chat — direct users to the Inbox for that.`;

@Injectable()
export class AiAppToolsService {
  constructor(
    private readonly statsService: StatsService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly webhookService: WebhookService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    private readonly inauzwaPrefs: InauzwaSyncPreferencesService,
    private readonly pipelineService: PipelineService,
    private readonly queueService: FollowupQueueService,
    private readonly ruleService: FollowupRuleService,
    private readonly templateService: FollowupTemplateService,
    private readonly kpiService: FollowupKpiService,
    private readonly quickReplyService: QuickReplyService,
    private readonly quoteService: QuoteService,
    private readonly pluginsService: PluginsService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly auditService: AuditService,
    private readonly infraStatusService: InfraStatusService,
    private readonly configService: ConfigService,
    private readonly aiSearchService: AiSearchService,
    private readonly memoryService: AiMemoryService,
    private readonly knowledgeService: AiKnowledgeService,
    private readonly knowledgeIndexService: AiKnowledgeIndexService,
    @Optional()
    @Inject(forwardRef(() => AgentActionRouterService))
    private readonly agentRouter?: AgentActionRouterService,
  ) {}

  getToolDefinitions(): AiToolDefinition[] {
    return [
      {
        name: 'search_everywhere',
        description:
          'Search across the entire OpenWA app: WhatsApp message bodies, chat/group names, products, pipeline leads, quotes, quick replies, follow-up rules/templates, sessions, webhooks, outbound SMS logs, and audit logs.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to search for (required)' },
            categories: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'all',
                  'messages',
                  'conversations',
                  'products',
                  'leads',
                  'quotes',
                  'quick_replies',
                  'followups',
                  'sessions',
                  'webhooks',
                  'audit',
                  'sms',
                ],
              },
              description: 'Limit to specific areas (default: all)',
            },
            sessionId: { type: 'string', description: 'Optional WhatsApp session filter' },
            chatId: { type: 'string', description: 'Optional single chat filter for messages' },
            groupsOnly: {
              type: 'boolean',
              description: 'When true, only search WhatsApp groups (@g.us)',
            },
            limit: { type: 'number', description: 'Max results per category (default 10, max 25)' },
            offset: {
              type: 'number',
              description: 'Pagination offset for message search (use with limit to fetch all pages)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_inbox_messages',
        description:
          'Search stored WhatsApp message text across chats and groups. Results are newest-first. For cheapest/best price, paginate with offset until truncated is false. Response includes total, returned, offset, truncated.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Text to find in message bodies' },
            sessionId: { type: 'string', description: 'Optional session filter' },
            chatId: { type: 'string', description: 'Optional single chat/group ID' },
            groupsOnly: { type: 'boolean', description: 'Only search group chats' },
            limit: { type: 'number', description: 'Max matches per page (default 25, max 100)' },
            offset: { type: 'number', description: 'Skip N matches for pagination (default 0)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_chat_messages',
        description:
          'Load recent messages from one WhatsApp chat or group (by sessionId + chatId). Use after search to read more context.',
        parameters: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'WhatsApp session ID' },
            chatId: { type: 'string', description: 'Chat ID e.g. 628...@c.us or 120...@g.us' },
            limit: { type: 'number', description: 'Max messages (default 30, max 50)' },
          },
          required: ['sessionId', 'chatId'],
        },
      },
      {
        name: 'get_app_overview',
        description:
          'Dashboard health: sessions, messages (today/24h), API activity, product catalog stats.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_message_analytics',
        description: 'Message time series, breakdown by type/session, and top active chats.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Default 24h' },
          },
        },
      },
      {
        name: 'list_inbox_conversations',
        description:
          'Unified inbox: recent conversations across all sessions with unread counts and last preview.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max rows (default 20)' },
            unreadOnly: { type: 'boolean', description: 'Only chats with unread messages' },
          },
        },
      },
      {
        name: 'list_sessions',
        description: 'List all WhatsApp sessions with status, phone, and name.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'list_webhooks',
        description: 'List configured webhooks (URL masked) and which events they listen to.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_pipeline_dashboard',
        description:
          'Sales pipeline KPIs: leads today, by stage/source, conversion, overdue follow-ups, hot leads.',
        parameters: {
          type: 'object',
          properties: { branchId: { type: 'string', description: 'Optional branch filter' } },
        },
      },
      {
        name: 'get_pipeline_bucket_counts',
        description: 'Count of leads in each pipeline bucket (new, waiting reply, hot, lost, etc.).',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            staffId: { type: 'string' },
          },
        },
      },
      {
        name: 'list_pipeline_leads',
        description: 'List leads in a pipeline bucket or search by name/phone/product.',
        parameters: {
          type: 'object',
          properties: {
            bucket: {
              type: 'string',
              enum: [
                'new_leads',
                'waiting_reply',
                'followup_needed',
                'payment_pending',
                'hot_leads',
                'lost_leads',
              ],
            },
            query: { type: 'string', description: 'Search instead of bucket filter' },
            branchId: { type: 'string' },
            staffId: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'get_pipeline_reports',
        description: 'Pipeline conversion, lead-source, and abandoned-lead reports.',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            from: { type: 'string', description: 'ISO date start' },
            to: { type: 'string', description: 'ISO date end' },
          },
        },
      },
      {
        name: 'list_recent_sales',
        description: 'Recent attributed CRM sales with amount, source, and linked conversation.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            branchId: { type: 'string' },
          },
        },
      },
      {
        name: 'list_followup_queue',
        description: 'List follow-up queue items (due, overdue, hot leads, or all pending).',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['due_now', 'overdue', 'today', 'hot_leads', 'all'],
            },
            limit: { type: 'number' },
            branchId: { type: 'string' },
            staffId: { type: 'string' },
          },
        },
      },
      {
        name: 'get_followup_queue_counts',
        description: 'Counts per follow-up queue filter (due now, overdue, etc.).',
        parameters: {
          type: 'object',
          properties: { branchId: { type: 'string' }, staffId: { type: 'string' } },
        },
      },
      {
        name: 'list_followup_automation',
        description: 'Follow-up automation rules, message templates, and summary counts.',
        parameters: {
          type: 'object',
          properties: { branchId: { type: 'string' } },
        },
      },
      {
        name: 'get_followup_kpi_reports',
        description: 'Staff follow-up KPI reports (completion, overdue, conversions).',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string' },
            periodStart: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
      },
      {
        name: 'search_products',
        description:
          'Search linked local inventory by name, SKU, category, variant, or IMEI/serial.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            inStockOnly: { type: 'boolean' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'get_product_health_summary',
        description:
          'Product catalog health: missing images, low/out of stock, duplicate SKUs/IMEIs, installment misconfiguration.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_inauzwa_connection',
        description: 'INAUZWA / product sync connection status and last sync.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'list_quick_replies',
        description: 'List quick reply templates available in the inbox.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'number' } },
        },
      },
      {
        name: 'list_recent_quotes',
        description: 'List recent sales quotes with status and totals.',
        parameters: {
          type: 'object',
          properties: { status: { type: 'string' }, limit: { type: 'number' } },
        },
      },
      {
        name: 'list_plugins',
        description: 'List loaded plugins and WhatsApp engine adapters with status.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'get_infrastructure_status',
        description: 'Database, Redis, queue, storage, and WhatsApp engine configuration status.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'list_recent_audit_logs',
        description: 'Recent platform audit log entries (API actions, sessions, errors).',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            search: { type: 'string', description: 'Filter by action, session, or error text' },
          },
        },
      },
      {
        name: 'get_app_settings',
        description: 'Non-secret application settings (API URL, rate limits, notifications flags).',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'memory_search',
        description:
          'Search long-term memory (markdown files) for facts about the business, staff notes, or past decisions. Call before answering questions about prior context.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural-language search query' },
            limit: { type: 'number', description: 'Max hits (default 8)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_get',
        description: 'Read lines from a memory file. Use after memory_search to fetch the exact passage.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path e.g. MEMORY.md' },
            fromLine: { type: 'number', description: '1-based start line' },
            lineCount: { type: 'number', description: 'Number of lines to read' },
          },
          required: ['path'],
        },
      },
      {
        name: 'memory_write',
        description:
          'Append a durable fact to MEMORY.md (customer preferences, decisions, policies). Use when the user shares something worth remembering.',
        parameters: {
          type: 'object',
          properties: {
            fact: { type: 'string', description: 'Short fact to remember' },
          },
          required: ['fact'],
        },
      },
      {
        name: 'memory_list_files',
        description: 'List all memory markdown files.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'shop_knowledge_list',
        description:
          'List shop knowledge markdown files that train inbox auto-reply (AI_REPLY_RULES.md, SHOP.md, FAQ.md, etc.).',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'shop_knowledge_read',
        description:
          'Read a shop knowledge file. Use before editing reply rules — especially AI_REPLY_RULES.md.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path e.g. AI_REPLY_RULES.md' },
          },
          required: ['path'],
        },
      },
      {
        name: 'shop_knowledge_search',
        description: 'Search shop knowledge markdown for policies, tone, and reply examples.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      },
      {
        name: 'shop_knowledge_write',
        description:
          'Replace entire contents of a shop knowledge markdown file. Use after shop_knowledge_read. Prefer shop_knowledge_append_rule for small rule additions. Reindexes automatically.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path e.g. AI_REPLY_RULES.md' },
            content: { type: 'string', description: 'Full new file content (markdown)' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'shop_knowledge_append_rule',
        description:
          'Append a new markdown section to a shop knowledge file (default AI_REPLY_RULES.md). Use when staff asks to add/fix auto-reply rules without rewriting the whole file.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Target file (default AI_REPLY_RULES.md)',
            },
            sectionMarkdown: {
              type: 'string',
              description: 'Markdown section to append (heading + bullets/examples)',
            },
          },
          required: ['sectionMarkdown'],
        },
      },
      {
        name: 'shop_knowledge_reindex',
        description: 'Reindex all shop knowledge files for semantic search (run after bulk edits).',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'resolve_agent_action',
        description:
          'Resolve a natural-language app settings command (Swahili or English) to a controlled agent action. Use when the user asks to change settings, open a panel, diagnose AI, or run safe operator tasks.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'User command e.g. "Zima AI auto reply"' },
            currentPage: { type: 'string' },
            currentChatId: { type: 'string' },
          },
          required: ['text'],
        },
      },
      {
        name: 'confirm_agent_action',
        description: 'Confirm a pending risky agent action after the user approved via UI button.',
        parameters: {
          type: 'object',
          properties: {
            confirmationId: { type: 'string' },
          },
          required: ['confirmationId'],
        },
      },
      {
        name: 'diagnose_ai_reply',
        description: 'Read-only: check why AI auto-reply may not be working (settings, WhatsApp, queue, safety).',
        parameters: {
          type: 'object',
          properties: {
            chatId: { type: 'string' },
          },
        },
      },
    ];
  }

  private static readonly ADMIN_ONLY_TOOLS = new Set([
    'get_infrastructure_status',
    'list_recent_audit_logs',
    'get_app_settings',
  ]);

  private static readonly KNOWLEDGE_WRITE_TOOLS = new Set([
    'shop_knowledge_write',
    'shop_knowledge_append_rule',
    'shop_knowledge_reindex',
  ]);

  private static readonly VIEWER_TOOLS = new Set([
    'get_app_overview',
    'search_everywhere',
    'search_inbox_messages',
    'get_chat_messages',
    'list_inbox_conversations',
    'search_products',
    'get_product_health_summary',
    'list_quick_replies',
  ]);

  getToolDefinitionsForRole(role: ApiKeyRole): AiToolDefinition[] {
    const all = this.getToolDefinitions();
    if (role === ApiKeyRole.ADMIN) return all;
    if (role === ApiKeyRole.OPERATOR) {
      return all.filter(t => !AiAppToolsService.ADMIN_ONLY_TOOLS.has(t.name));
    }
    return all.filter(
      t =>
        AiAppToolsService.VIEWER_TOOLS.has(t.name) &&
        !AiAppToolsService.KNOWLEDGE_WRITE_TOOLS.has(t.name),
    );
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    role: ApiKeyRole = ApiKeyRole.OPERATOR,
    context?: { userId?: string; apiKeyId?: string },
  ): Promise<string> {
    if (!this.getToolDefinitionsForRole(role).some(t => t.name === name)) {
      return JSON.stringify({ error: `Tool "${name}" is not allowed for role ${role}` });
    }
    try {
      switch (name) {
        case 'search_everywhere':
          return JSON.stringify(await this.searchEverywhere(args), null, 2);
        case 'search_inbox_messages':
          return JSON.stringify(await this.searchInboxMessages(args), null, 2);
        case 'get_chat_messages':
          return JSON.stringify(await this.getChatMessages(args), null, 2);
        case 'get_app_overview':
          return JSON.stringify(await this.getAppOverview(), null, 2);
        case 'get_message_analytics':
          return JSON.stringify(await this.getMessageAnalytics(args), null, 2);
        case 'list_inbox_conversations':
          return JSON.stringify(await this.listInboxConversations(args), null, 2);
        case 'list_sessions':
          return JSON.stringify(await this.listSessions(), null, 2);
        case 'list_webhooks':
          return JSON.stringify(await this.listWebhooks(), null, 2);
        case 'get_pipeline_dashboard':
          return JSON.stringify(
            await this.pipelineService.getDashboardStats(
              typeof args.branchId === 'string' ? args.branchId : undefined,
            ),
            null,
            2,
          );
        case 'get_pipeline_bucket_counts':
          return JSON.stringify(
            await this.pipelineService.getBucketCounts(
              typeof args.branchId === 'string' ? args.branchId : undefined,
              typeof args.staffId === 'string' ? args.staffId : undefined,
            ),
            null,
            2,
          );
        case 'list_pipeline_leads':
          return JSON.stringify(await this.listPipelineLeads(args), null, 2);
        case 'get_pipeline_reports':
          return JSON.stringify(await this.getPipelineReports(args), null, 2);
        case 'list_recent_sales':
          return JSON.stringify(await this.listRecentSales(args), null, 2);
        case 'list_followup_queue':
          return JSON.stringify(await this.listFollowupQueue(args), null, 2);
        case 'get_followup_queue_counts':
          return JSON.stringify(
            await this.queueService.getFilterCounts(
              typeof args.branchId === 'string' ? args.branchId : undefined,
              typeof args.staffId === 'string' ? args.staffId : undefined,
            ),
            null,
            2,
          );
        case 'list_followup_automation':
          return JSON.stringify(await this.listFollowupAutomation(args), null, 2);
        case 'get_followup_kpi_reports':
          return JSON.stringify(
            await this.kpiService.getReports(
              typeof args.branchId === 'string' ? args.branchId : undefined,
              typeof args.periodStart === 'string' ? args.periodStart : undefined,
            ),
            null,
            2,
          );
        case 'search_products':
          return JSON.stringify(await this.searchProducts(args), null, 2);
        case 'get_product_health_summary':
          return JSON.stringify(await this.productsService.getHealthSummary(), null, 2);
        case 'get_inauzwa_connection':
          return JSON.stringify(await this.inauzwaPrefs.toDto(), null, 2);
        case 'list_quick_replies':
          return JSON.stringify(await this.listQuickReplies(args), null, 2);
        case 'list_recent_quotes':
          return JSON.stringify(await this.listQuotes(args), null, 2);
        case 'list_plugins':
          return JSON.stringify(await this.listPlugins(), null, 2);
        case 'get_infrastructure_status':
          return JSON.stringify(await this.infraStatusService.getStatus(), null, 2);
        case 'list_recent_audit_logs':
          return JSON.stringify(await this.listRecentAuditLogs(args), null, 2);
        case 'get_app_settings':
          return JSON.stringify(this.getAppSettings(), null, 2);
        case 'memory_search': {
          const query = String(args.query ?? '').trim();
          if (!query) return JSON.stringify({ error: 'query is required' });
          const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
          const hits = await this.memoryService.search(query, limit);
          if (!hits.length) {
            return 'No matching memory chunks. Try memory_get on MEMORY.md or memory_list_files.';
          }
          return hits
            .map(
              h =>
                `[${h.path} L${h.startLine}-${h.endLine} score=${h.score.toFixed(2)}]\n${h.text}`,
            )
            .join('\n\n---\n\n');
        }
        case 'memory_get': {
          const filePath = String(args.path ?? '').trim();
          if (!filePath) return JSON.stringify({ error: 'path is required' });
          const fromLine =
            args.fromLine !== undefined ? Number(args.fromLine) : undefined;
          const lineCount =
            args.lineCount !== undefined ? Number(args.lineCount) : undefined;
          const content = this.memoryService.readFile(filePath, fromLine, lineCount);
          return content;
        }
        case 'memory_write': {
          const fact = String(args.fact ?? '').trim();
          if (!fact) return JSON.stringify({ error: 'fact is required' });
          this.memoryService.appendToMemoryDoc(fact);
          return JSON.stringify({ ok: true, appended: true });
        }
        case 'memory_list_files': {
          const files = this.memoryService.listFiles();
          if (!files.length) return 'No memory files yet.';
          return files.map(f => `${f.path} (${f.size} bytes, ${f.updatedAt})`).join('\n');
        }
        case 'shop_knowledge_list': {
          const files = this.knowledgeService.listFiles();
          if (!files.length) return 'No shop knowledge files yet.';
          return files
            .map(f => `${f.path} (${f.size} bytes, ${f.updatedAt})`)
            .join('\n');
        }
        case 'shop_knowledge_read': {
          const filePath = String(args.path ?? '').trim();
          if (!filePath) return JSON.stringify({ error: 'path is required' });
          const { path, content } = this.knowledgeService.readFile(filePath);
          return JSON.stringify({ path, content, bytes: Buffer.byteLength(content, 'utf8') }, null, 2);
        }
        case 'shop_knowledge_search': {
          const query = String(args.query ?? '').trim();
          if (!query) return JSON.stringify({ error: 'query is required' });
          const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
          const results = await this.knowledgeService.search(query, limit);
          return JSON.stringify({ count: results.length, results }, null, 2);
        }
        case 'shop_knowledge_write': {
          const filePath = String(args.path ?? '').trim();
          const content = String(args.content ?? '');
          if (!filePath) return JSON.stringify({ error: 'path is required' });
          if (!content.trim()) return JSON.stringify({ error: 'content is required' });
          const result = this.knowledgeService.writeFile(filePath, content);
          return JSON.stringify({
            ok: true,
            path: result.path,
            size: result.size,
            message: 'Shop knowledge updated and reindexed for this file.',
          });
        }
        case 'shop_knowledge_append_rule': {
          const filePath = String(args.path ?? 'AI_REPLY_RULES.md').trim();
          const sectionMarkdown = String(args.sectionMarkdown ?? '').trim();
          if (!sectionMarkdown) return JSON.stringify({ error: 'sectionMarkdown is required' });
          const result = this.knowledgeService.appendSection(filePath, sectionMarkdown);
          return JSON.stringify({
            ok: true,
            path: result.path,
            size: result.size,
            message: `Appended section to ${result.path}. Inbox auto-reply will use it on the next message.`,
          });
        }
        case 'shop_knowledge_reindex': {
          const stats = await this.knowledgeIndexService.reindexAll();
          return JSON.stringify({
            ok: true,
            files: stats.files,
            chunks: stats.chunks,
            message: 'Shop knowledge reindexed.',
          });
        }
        case 'resolve_agent_action': {
          if (!this.agentRouter) {
            return JSON.stringify({ error: 'Agent actions are not enabled on this server build.' });
          }
          const text = String(args.text ?? '').trim();
          if (!text) return JSON.stringify({ error: 'text is required' });
          const request: AgentActionRequest = {
            userId: context?.userId ?? context?.apiKeyId ?? 'staff-tool',
            userRole: role,
            text,
            currentPage: typeof args.currentPage === 'string' ? args.currentPage : undefined,
            currentChatId: typeof args.currentChatId === 'string' ? args.currentChatId : undefined,
            apiKeyId: context?.apiKeyId,
          };
          const resolved = await this.agentRouter.resolve(request, role);
          if (resolved) return JSON.stringify(resolved, null, 2);
          return JSON.stringify({ matched: false, hint: 'No high-confidence agent action for this text.' });
        }
        case 'confirm_agent_action': {
          if (!this.agentRouter) {
            return JSON.stringify({ error: 'Agent actions are not enabled on this server build.' });
          }
          const confirmationId = String(args.confirmationId ?? '').trim();
          if (!confirmationId) return JSON.stringify({ error: 'confirmationId is required' });
          const request: AgentActionRequest = {
            userId: context?.userId ?? context?.apiKeyId ?? 'staff-tool',
            userRole: role,
            text: '',
            apiKeyId: context?.apiKeyId,
          };
          const result = await this.agentRouter.confirmAndExecute(confirmationId, request, role);
          return JSON.stringify(result, null, 2);
        }
        case 'diagnose_ai_reply': {
          if (!this.agentRouter) {
            return JSON.stringify({ error: 'Agent actions are not enabled on this server build.' });
          }
          const request: AgentActionRequest = {
            userId: context?.userId ?? context?.apiKeyId ?? 'staff-tool',
            userRole: role,
            text: 'kwa nini ai haijibu',
            currentChatId: typeof args.chatId === 'string' ? args.chatId : undefined,
            apiKeyId: context?.apiKeyId,
          };
          const result = await this.agentRouter.executeById('ai.reply.diagnose', request, role);
          return JSON.stringify(result, null, 2);
        }
        // Legacy alias
        case 'count_followup_rules':
          return JSON.stringify(await this.listFollowupAutomation(args), null, 2);
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: message });
    }
  }

  private async getAppOverview() {
    const [overview, catalog] = await Promise.all([
      this.statsService.getOverview(),
      this.productsService.catalogStats(),
    ]);
    return { overview, catalog };
  }

  private async getMessageAnalytics(args: Record<string, unknown>) {
    const period =
      args.period === '7d' || args.period === '30d' ? args.period : ('24h' as const);
    return this.statsService.getMessageStats(period);
  }

  private async listInboxConversations(args: Record<string, unknown>) {
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;
    const unreadOnly = args.unreadOnly === true;
    const result = await this.messageService.queryUnifiedConversations(
      { limit, offset: 0, unread: unreadOnly ? true : undefined },
      { apiKeyId: '', role: 'admin' },
    );
    const rows = result.conversations;
    return rows.map((r) => ({
      sessionId: r.sessionId,
      sessionName: r.sessionName,
      chatId: r.chatId,
      displayName: r.displayName,
      lastMessageAt: r.lastMessageAt,
      lastPreview: r.lastPreview,
      lastDirection: r.lastDirection,
      unreadCount: r.unreadCount,
      hasUnread: r.hasUnread,
      resolved: r.resolved,
      hasFollowUp: r.hasFollowUp,
    }));
  }

  private async listSessions() {
    const sessions = await this.sessionService.findAll();
    return sessions.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      phone: s.phone ?? null,
      pushName: s.pushName ?? null,
      lastActiveAt: s.lastActiveAt ?? null,
    }));
  }

  private async listWebhooks() {
    const hooks = await this.webhookService.findAll();
    return hooks.map((w) => ({
      id: w.id,
      sessionId: w.sessionId,
      url: w.url.length > 48 ? `${w.url.slice(0, 40)}…` : w.url,
      events: w.events,
      active: w.active,
    }));
  }

  private async listPipelineLeads(args: Record<string, unknown>) {
    const branchId = typeof args.branchId === 'string' ? args.branchId : undefined;
    const staffId = typeof args.staffId === 'string' ? args.staffId : undefined;
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;

    if (typeof args.query === 'string' && args.query.trim()) {
      const results = await this.pipelineService.searchLeads(args.query, branchId, staffId, undefined, limit);
      return results.slice(0, limit);
    }

    const bucketKey = typeof args.bucket === 'string' ? args.bucket : 'new_leads';
    const bucketMap: Record<string, PipelineBucket> = {
      new_leads: PipelineBucket.NEW_LEADS,
      waiting_reply: PipelineBucket.WAITING_REPLY,
      followup_needed: PipelineBucket.FOLLOWUP_NEEDED,
      payment_pending: PipelineBucket.PAYMENT_PENDING,
      hot_leads: PipelineBucket.HOT_LEADS,
      lost_leads: PipelineBucket.LOST_LEADS,
    };
    const bucket = bucketMap[bucketKey] ?? PipelineBucket.NEW_LEADS;
    const leads = await this.pipelineService.listBucket(bucket, branchId, staffId);
    return leads.slice(0, limit);
  }

  private async getPipelineReports(args: Record<string, unknown>) {
    const branchId = typeof args.branchId === 'string' ? args.branchId : undefined;
    const from = typeof args.from === 'string' ? args.from : undefined;
    const to = typeof args.to === 'string' ? args.to : undefined;
    const [conversion, leadSources, abandoned, dashboard] = await Promise.all([
      this.pipelineService.getConversionReport(branchId, from, to),
      this.pipelineService.getLeadSourceReport(branchId, from, to),
      this.pipelineService.getAbandonedReport(branchId),
      this.pipelineService.getDashboardStats(branchId),
    ]);
    return {
      conversion,
      leadSources,
      abandoned,
      lostReasonBreakdown: dashboard.lostReasonBreakdown,
      averageResponseTimeSeconds: dashboard.averageResponseTimeSeconds,
    };
  }

  private async listRecentSales(args: Record<string, unknown>) {
    const limit = typeof args.limit === 'number' ? args.limit : 15;
    const branchId = typeof args.branchId === 'string' ? args.branchId : undefined;
    return this.pipelineService.listRecentSales(limit, branchId);
  }

  private async listFollowupQueue(args: Record<string, unknown>) {
    const filterMap: Record<string, FollowUpQueueFilter> = {
      due_now: FollowUpQueueFilter.DUE_NOW,
      overdue: FollowUpQueueFilter.OVERDUE,
      today: FollowUpQueueFilter.DUE_TODAY,
      hot_leads: FollowUpQueueFilter.HOT_LEADS,
    };
    const filterKey = typeof args.filter === 'string' ? args.filter : 'due_now';
    const branchId = typeof args.branchId === 'string' ? args.branchId : undefined;
    const staffId = typeof args.staffId === 'string' ? args.staffId : undefined;
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 30) : 15;
    const filter =
      filterMap[filterKey] ?? FollowUpQueueFilter.DUE_NOW;
    const items =
      filterKey === 'all'
        ? await this.queueService.getQueue(FollowUpQueueFilter.DUE_NOW, branchId, staffId)
        : await this.queueService.getQueue(filter, branchId, staffId);
    return items.slice(0, limit);
  }

  private async listFollowupAutomation(args: Record<string, unknown>) {
    const branchId = typeof args.branchId === 'string' ? args.branchId : undefined;
    const [rules, templates] = await Promise.all([
      this.ruleService.findAll(branchId),
      this.templateService.findAll(branchId),
    ]);
    return {
      summary: {
        rulesCount: rules.length,
        activeRules: rules.filter((r) => r.active).length,
        templatesCount: templates.length,
        activeTemplates: templates.filter((t) => t.isActive).length,
      },
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        active: r.active,
        triggerEvent: r.triggerEvent,
        stage: r.stage,
        delayMinutes: r.delayMinutes,
      })),
      templates: templates.slice(0, 20).map((t) => ({
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        category: t.category,
      })),
    };
  }

  private async searchProducts(args: Record<string, unknown>) {
    const q = typeof args.query === 'string' ? args.query : '';
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 25) : 10;
    const inStockOnly = args.inStockOnly === true;
    const result = await this.productsService.list({
      q: q || undefined,
      inStockOnly,
      limit,
      offset: 0,
    });
    const items = Array.isArray(result) ? result : result.items;
    return items.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      sellingPrice: p.sellingPrice,
      totalStock: p.totalStock,
      currency: p.currency,
    }));
  }

  private async listQuickReplies(args: Record<string, unknown>) {
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 30) : 15;
    const templates = await this.quickReplyService.findAllForManage();
    return templates.slice(0, limit).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      bodyPreview: t.body.slice(0, 120),
      isActive: t.isActive,
    }));
  }

  private async listQuotes(args: Record<string, unknown>) {
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 20) : 10;
    const status = typeof args.status === 'string' ? args.status : undefined;
    const quotes = await this.quoteService.list({
      status: status as import('../quote/quote.enums').QuoteStatus | undefined,
    });
    return quotes.slice(0, limit).map((q) => ({
      id: q.id,
      status: q.status,
      customerName: q.customerName,
      totalAmount: q.totalAmount,
      currency: q.currency,
      sessionId: q.sessionId,
      chatId: q.chatId,
      createdAt: q.createdAt,
    }));
  }

  private async listPlugins() {
    return this.pluginsService.findAll().map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      status: p.status,
      type: p.type,
      builtIn: p.builtIn,
      error: p.error ?? null,
    }));
  }

  private async listRecentAuditLogs(args: Record<string, unknown>) {
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;
    const search = typeof args.search === 'string' ? args.search : undefined;
    const { data, total } = await this.auditService.findAll({ limit, search });
    return {
      total,
      entries: data.map((l) => ({
        id: l.id,
        action: l.action,
        severity: l.severity,
        apiKeyName: l.apiKeyName,
        sessionId: l.sessionId,
        sessionName: l.sessionName,
        path: l.path,
        statusCode: l.statusCode,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt,
      })),
    };
  }

  private async searchEverywhere(args: Record<string, unknown>) {
    const query = typeof args.query === 'string' ? args.query : '';
    const categories = Array.isArray(args.categories)
      ? (args.categories.filter((c) => typeof c === 'string') as import('./ai-search.service').AiSearchCategory[])
      : undefined;
    return this.aiSearchService.searchEverywhere(query, {
      categories,
      sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
      chatId: typeof args.chatId === 'string' ? args.chatId : undefined,
      groupsOnly: args.groupsOnly === true,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
      offset: typeof args.offset === 'number' ? args.offset : undefined,
    });
  }

  private async searchInboxMessages(args: Record<string, unknown>) {
    const query = typeof args.query === 'string' ? args.query : '';
    return this.messageService.searchInboxMessages({
      query,
      sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
      chatId: typeof args.chatId === 'string' ? args.chatId : undefined,
      groupsOnly: args.groupsOnly === true,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
      offset: typeof args.offset === 'number' ? args.offset : undefined,
    });
  }

  private async getChatMessages(args: Record<string, unknown>) {
    const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
    const chatId = typeof args.chatId === 'string' ? args.chatId : '';
    if (!sessionId || !chatId) {
      return { error: 'sessionId and chatId are required' };
    }
    const limit = typeof args.limit === 'number' ? args.limit : 30;
    return this.messageService.getChatMessagesForAi(sessionId, chatId, limit);
  }

  private getAppSettings() {
    const port = this.configService.get<number>('port', 2785);
    return {
      general: {
        apiBaseUrl: (process.env.API_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
        sessionTimeoutMinutes: Math.floor(
          this.configService.get<number>('webhook.timeout', 300000) / 60000,
        ),
        autoReconnect: this.configService.get<boolean>('engine.autoReconnect', false),
        debugMode: this.configService.get<boolean>('database.logging', false),
      },
      api: {
        rateLimit: this.configService.get<number>('api.rateLimit.mediumLimit', 100),
        rateLimitWindowMs: this.configService.get<number>('api.rateLimit.mediumTtl', 60000),
      },
      engine: {
        type: this.configService.get<string>('engine.type', 'whatsapp-web.js'),
        headless: this.configService.get<boolean>('engine.headless', true),
      },
    };
  }
}
