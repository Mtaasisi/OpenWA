import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmSaleAttribution } from './entities/crm-sale-attribution.entity';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { Quote } from '../quote/entities/quote.entity';
import { ConversationSource } from './followup.enums';
import { normalizeLeadSource } from './utils/lead-source.util';
import { backfillSaleAttributions } from './utils/sale-attribution-backfill.util';
import type { LinkSaleDto } from './dto/followup.dto';

export interface RecordSaleAttributionInput {
  saleId: string;
  leadSource?: ConversationSource | string | null;
  conversation?: FollowupConversation | null;
  conversationId?: string | null;
  quoteId?: string | null;
  customerId?: string | null;
  assignedStaffId?: string | null;
  branchId?: string | null;
  amount?: number | null;
  grossProfit?: number | null;
}

@Injectable()
export class SaleAttributionService {
  constructor(
    @InjectRepository(CrmSaleAttribution, 'data')
    private readonly repo: Repository<CrmSaleAttribution>,
    @InjectRepository(FollowupConversation, 'data')
    private readonly convRepo: Repository<FollowupConversation>,
    @InjectRepository(Quote, 'data')
    private readonly quoteRepo: Repository<Quote>,
  ) {}

  async recordFromLinkSale(
    conversation: FollowupConversation,
    dto: LinkSaleDto,
  ): Promise<CrmSaleAttribution> {
    return this.record({
      saleId: dto.saleId,
      leadSource: dto.leadSource ?? conversation.source,
      conversation,
      quoteId: dto.quoteId ?? null,
      customerId: dto.customerId ?? conversation.customerId,
      assignedStaffId: dto.assignedStaffId ?? conversation.assignedStaffId,
      branchId: conversation.branchId,
      amount: dto.amount ?? null,
      grossProfit: dto.grossProfit ?? null,
    });
  }

  async record(input: RecordSaleAttributionInput): Promise<CrmSaleAttribution> {
    const leadSource = normalizeLeadSource(
      input.leadSource ?? input.conversation?.source ?? ConversationSource.OTHER,
    );

    const existing = await this.repo.findOne({ where: { saleId: input.saleId } });
    if (existing) {
      existing.leadSource = leadSource;
      existing.conversationId =
        input.conversationId ?? input.conversation?.id ?? existing.conversationId;
      existing.quoteId = input.quoteId ?? existing.quoteId;
      existing.customerId = input.customerId ?? existing.customerId;
      existing.assignedStaffId = input.assignedStaffId ?? existing.assignedStaffId;
      existing.branchId = input.branchId ?? existing.branchId;
      if (input.amount != null) existing.amount = input.amount;
      if (input.grossProfit != null) existing.grossProfit = input.grossProfit;
      return this.repo.save(existing);
    }

    const row = this.repo.create({
      saleId: input.saleId,
      leadSource,
      conversationId: input.conversationId ?? input.conversation?.id ?? null,
      quoteId: input.quoteId ?? null,
      customerId: input.customerId ?? input.conversation?.customerId ?? null,
      assignedStaffId: input.assignedStaffId ?? input.conversation?.assignedStaffId ?? null,
      branchId: input.branchId ?? input.conversation?.branchId ?? null,
      amount: input.amount ?? null,
      grossProfit: input.grossProfit ?? null,
    });
    return this.repo.save(row);
  }

  async backfillMissing(options: { dryRun?: boolean } = {}) {
    return backfillSaleAttributions(this.convRepo, this.quoteRepo, this.repo, options);
  }
}
