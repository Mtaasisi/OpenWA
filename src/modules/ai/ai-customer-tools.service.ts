import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { ConversationStage, ConversationPriority } from '../followup/followup.enums';
import type { AiToolDefinition } from './ai-app-tools';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMemoryService } from './ai-memory.service';
import { AiProfileService } from './ai-profile.service';
import { AiSignalService } from './ai-signal.service';
import { redactStockForCustomer } from './utils/ai-behavior.util';
import { StockingReminderReason } from './ai-signal.enums';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';

export interface CustomerAgentScope {
  sessionId: string;
  chatId: string;
  branchId?: string | null;
  onEscalate: (reason: string) => Promise<void>;
}

@Injectable()
export class AiCustomerToolsService {
  constructor(
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    private readonly knowledge: AiKnowledgeService,
    private readonly memory: AiMemoryService,
    private readonly profileService: AiProfileService,
    private readonly inauzwaPreferences: InauzwaSyncPreferencesService,
    private readonly signalService: AiSignalService,
  ) {}

  getToolDefinitions(): AiToolDefinition[] {
    return [
      {
        name: 'search_products',
        description:
          'Search the linked local inventory catalog by name, SKU, category, variant, or IMEI/serial. Returns prices, stock, and variant rows when available.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search text' },
            inStockOnly: { type: 'boolean', description: 'Only products with stock' },
            limit: { type: 'number', description: 'Max results (default 8)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'update_lead',
        description:
          'Create or update the CRM lead for this WhatsApp chat (stage, product interest, priority, notes).',
        parameters: {
          type: 'object',
          properties: {
            stage: {
              type: 'string',
              description: 'Pipeline stage e.g. new_lead, needs_identified, product_suggested, negotiating',
            },
            productInterest: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'hot'] },
            customerName: { type: 'string' },
            internalNote: { type: 'string', description: 'Append to lead notes' },
          },
        },
      },
      {
        name: 'add_internal_note',
        description: 'Append an internal note for staff (not sent to the customer).',
        parameters: {
          type: 'object',
          properties: {
            note: { type: 'string' },
          },
          required: ['note'],
        },
      },
      {
        name: 'search_shop_knowledge',
        description:
          'Search shop policies, warranty, hours, and FAQ markdown files. Use before answering policy questions.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search phrase' },
            limit: { type: 'number', description: 'Max snippets (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_memory',
        description:
          'Search long-term memory files for facts learned across chats (preferences, recurring requests, business notes). Read-only.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search phrase' },
            limit: { type: 'number', description: 'Max snippets (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_branch_location',
        description:
          'Get branch location, hours, and contact details from settings. Use when customer asks where you are located.',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string', description: 'Optional branch id; uses default if omitted' },
          },
        },
      },
      {
        name: 'get_payment_details',
        description:
          'Get active payment account details for a branch. Use only when customer asks to pay or requests payment number.',
        parameters: {
          type: 'object',
          properties: {
            branchId: { type: 'string', description: 'Optional branch id; uses default if omitted' },
          },
        },
      },
      {
        name: 'note_stocking_need',
        description:
          'Create an internal stocking reminder when customer wants installment or a product that is out of stock.',
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            productId: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['productName'],
        },
      },
      {
        name: 'escalate_to_human',
        description:
          'Hand off to a human agent when you cannot help, the customer asks for a person, or the issue is sensitive.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Short reason for staff' },
          },
          required: ['reason'],
        },
      },
    ];
  }

  /** In-stock catalog excerpt from linked local inventory for inbox AI system prompt. */
  async buildCatalogContextBlock(branchId?: string | null): Promise<string> {
    return this.productsService.buildAgentCatalogContext({ branchId, limit: 28 });
  }

  async executeTool(
    scope: CustomerAgentScope,
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    switch (name) {
      case 'search_products':
        return this.searchProducts(scope, args);
      case 'update_lead':
        return this.updateLead(scope, args);
      case 'add_internal_note':
        return this.addInternalNote(scope, args);
      case 'search_shop_knowledge':
        return await this.searchShopKnowledge(args);
      case 'search_memory':
        return await this.searchMemory(args);
      case 'get_branch_location':
        return await this.getBranchLocation(scope, args);
      case 'get_payment_details':
        return await this.getPaymentDetails(scope, args);
      case 'note_stocking_need':
        return await this.noteStockingNeed(scope, args);
      case 'escalate_to_human':
        return await this.escalate(scope, args);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  private async searchProducts(
    scope: CustomerAgentScope,
    args: Record<string, unknown>,
  ): Promise<string> {
    const query = String(args.query ?? '').trim();
    if (!query) return JSON.stringify({ error: 'query is required' });

    const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 15);
    const rows = await this.productsService.searchForAgent({
      q: query,
      inStockOnly: true,
      limit,
      branchId: scope.branchId,
    });

    const inStockProducts = rows
      .filter(r => r.id !== 'exact-match-unavailable')
      .map(r => redactStockForCustomer(r as unknown as Record<string, unknown>));

    if (inStockProducts.length > 0) {
      return JSON.stringify({ count: inStockProducts.length, products: inStockProducts }, null, 2);
    }

    const altRow = rows.find(r => r.id === 'exact-match-unavailable');
    const alternatives = altRow?.relatedAlternatives ?? [];
    if (alternatives.length > 0) {
      return JSON.stringify(
        {
          count: 0,
          exactMatchUnavailable: true,
          guidance:
            'Exact match is not in stock. Do NOT say "out of stock" or list unavailable items. Offer these in-stock alternatives only.',
          alternatives,
        },
        null,
        2,
      );
    }

    return JSON.stringify(
      {
        count: 0,
        exactMatchUnavailable: true,
        guidance:
          'No in-stock match. Suggest notify-when-available or ask one clarifying question. Do NOT list unavailable products or stock counts.',
      },
      null,
      2,
    );
  }

  private async updateLead(scope: CustomerAgentScope, args: Record<string, unknown>): Promise<string> {
    const conv = await this.followupConversationService.getOrCreate(scope.sessionId, scope.chatId);

    const dto: {
      stage?: ConversationStage;
      productInterest?: string;
      priority?: ConversationPriority;
      customerName?: string;
      internalNote?: string;
    } = {};

    if (typeof args.stage === 'string' && Object.values(ConversationStage).includes(args.stage as ConversationStage)) {
      dto.stage = args.stage as ConversationStage;
    }
    if (typeof args.productInterest === 'string') dto.productInterest = args.productInterest;
    if (
      typeof args.priority === 'string' &&
      Object.values(ConversationPriority).includes(args.priority as ConversationPriority)
    ) {
      dto.priority = args.priority as ConversationPriority;
    }
    if (typeof args.customerName === 'string' && args.customerName.trim()) {
      dto.customerName = args.customerName.trim();
      await this.inboxCrmService.upsertThreadCrm(scope.sessionId, scope.chatId, {
        customerName: dto.customerName,
      });
    }
    if (typeof args.internalNote === 'string' && args.internalNote.trim()) {
      const line = args.internalNote.trim();
      dto.internalNote = conv.internalNote ? `${conv.internalNote}\n${line}` : line;
    }

    const saved = await this.followupConversationService.update(conv.id, dto);

    return JSON.stringify({
      ok: true,
      leadId: saved.id,
      stage: saved.stage,
      productInterest: saved.productInterest,
    });
  }

  private async addInternalNote(scope: CustomerAgentScope, args: Record<string, unknown>): Promise<string> {
    const note = String(args.note ?? '').trim();
    if (!note) return JSON.stringify({ error: 'note is required' });

    const crm = await this.inboxCrmService.getThreadCrm(scope.sessionId, scope.chatId);
    const merged = crm.internalNote ? `${crm.internalNote}\n${note}` : note;
    await this.inboxCrmService.upsertThreadCrm(scope.sessionId, scope.chatId, {
      internalNote: merged,
    });

    const conv = await this.followupConversationService.findByThread(scope.sessionId, scope.chatId);
    if (conv) {
      await this.followupConversationService.update(conv.id, {
        internalNote: conv.internalNote ? `${conv.internalNote}\n${note}` : note,
      });
    }

    return JSON.stringify({ ok: true });
  }

  private async searchShopKnowledge(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query ?? '').trim();
    if (!query) return JSON.stringify({ error: 'query is required' });
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
    const results = await this.knowledge.search(query, limit);
    return JSON.stringify({ count: results.length, results }, null, 2);
  }

  private async searchMemory(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query ?? '').trim();
    if (!query) return JSON.stringify({ error: 'query is required' });
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
    const results = await this.memory.search(query, limit);
    return JSON.stringify(
      {
        count: results.length,
        results: results.map(r => ({
          path: r.path,
          startLine: r.startLine,
          endLine: r.endLine,
          text: r.text.slice(0, 800),
        })),
      },
      null,
      2,
    );
  }

  private async resolveBranchId(
    scope: CustomerAgentScope,
    args: Record<string, unknown>,
  ): Promise<string | null> {
    const argBranch = typeof args.branchId === 'string' ? args.branchId.trim() : '';
    if (argBranch) return argBranch;
    if (scope.branchId) return scope.branchId;
    const preferred = await this.inboxCrmService.getPreferredBranchId(scope.sessionId, scope.chatId);
    if (preferred) return preferred;
    const prefs = await this.inauzwaPreferences.get();
    return prefs.branchId?.trim() || null;
  }

  private async getBranchLocation(
    scope: CustomerAgentScope,
    args: Record<string, unknown>,
  ): Promise<string> {
    const branchId = await this.resolveBranchId(scope, args);
    if (!branchId) {
      return JSON.stringify({
        ok: false,
        needsBranch: true,
        message: 'Branch unknown — ask customer Dar or Arusha first.',
      });
    }
    const profile = await this.profileService.getProfile(branchId);
    if (!profile) {
      return JSON.stringify({
        ok: false,
        branchId,
        message: 'No branch profile configured yet in settings.',
      });
    }
    return JSON.stringify({
      ok: true,
      branchId,
      businessName: profile.businessName,
      branchName: profile.branchName,
      locationText: this.profileService.formatLocationBlock(profile),
      deliveryPolicy: profile.deliveryPolicy,
      warrantyPolicy: profile.warrantyPolicy,
    });
  }

  private async getPaymentDetails(
    scope: CustomerAgentScope,
    args: Record<string, unknown>,
  ): Promise<string> {
    const branchId = await this.resolveBranchId(scope, args);
    if (!branchId) {
      return JSON.stringify({
        ok: false,
        needsBranch: true,
        message: 'Branch unknown — ask customer Dar or Arusha before sending payment details.',
      });
    }
    const account = await this.profileService.getDefaultPaymentAccount(branchId);
    if (!account) {
      return JSON.stringify({
        ok: false,
        branchId,
        message: 'No active payment account configured for this branch.',
      });
    }
    return JSON.stringify({
      ok: true,
      branchId,
      methodType: account.methodType,
      providerName: account.providerName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      paymentText: this.profileService.formatPaymentBlock(account),
    });
  }

  private async noteStockingNeed(
    scope: CustomerAgentScope,
    args: Record<string, unknown>,
  ): Promise<string> {
    const productName = String(args.productName ?? '').trim();
    if (!productName) return JSON.stringify({ error: 'productName is required' });
    const branchId = await this.resolveBranchId(scope, args);
    const reminder = await this.signalService.createStockingReminder({
      productName,
      productId: typeof args.productId === 'string' ? args.productId : undefined,
      sessionId: scope.sessionId,
      chatId: scope.chatId,
      branchId,
      note: typeof args.note === 'string' ? args.note : undefined,
      reason: StockingReminderReason.DEMAND_DETECTED,
    });
    return JSON.stringify({ ok: true, reminderId: reminder.id });
  }

  private async escalate(scope: CustomerAgentScope, args: Record<string, unknown>): Promise<string> {
    const reason = String(args.reason ?? 'Customer requested human assistance').trim();
    await scope.onEscalate(reason);
    return JSON.stringify({
      ok: true,
      escalated: true,
      message: 'A team member will follow up shortly.',
    });
  }
}
