import type { Repository } from 'typeorm';
import { FollowupConversation } from '../entities/followup-conversation.entity';
import { CrmSaleAttribution } from '../entities/crm-sale-attribution.entity';
import { Quote } from '../../quote/entities/quote.entity';
import { QuoteStatus } from '../../quote/quote.enums';
import { normalizeLeadSource } from './lead-source.util';

export interface SaleAttributionBackfillResult {
  created: number;
  skipped: number;
  dryRun: boolean;
}

export async function backfillSaleAttributions(
  convRepo: Repository<FollowupConversation>,
  quoteRepo: Repository<Quote>,
  attrRepo: Repository<CrmSaleAttribution>,
  options: { dryRun?: boolean } = {},
): Promise<SaleAttributionBackfillResult> {
  const dryRun = options.dryRun ?? false;
  let created = 0;
  let skipped = 0;

  const existingRows = await attrRepo.find({ select: ['saleId'] });
  const attributedSaleIds = new Set(existingRows.map(r => r.saleId));

  const conversations = await convRepo
    .createQueryBuilder('c')
    .where('c.linkedSaleId IS NOT NULL')
    .andWhere("TRIM(c.linkedSaleId) != ''")
    .getMany();

  for (const conv of conversations) {
    const saleId = conv.linkedSaleId!.trim();
    if (attributedSaleIds.has(saleId)) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      const row = attrRepo.create({
        saleId,
        leadSource: normalizeLeadSource(conv.source),
        conversationId: conv.id,
        quoteId: null,
        customerId: conv.customerId,
        assignedStaffId: conv.assignedStaffId,
        branchId: conv.branchId,
        amount: null,
        grossProfit: null,
      });
      await attrRepo.save(row);
    }

    attributedSaleIds.add(saleId);
    created += 1;
  }

  const quotes = await quoteRepo
    .createQueryBuilder('q')
    .where('q.linkedSaleId IS NOT NULL')
    .andWhere("TRIM(q.linkedSaleId) != ''")
    .andWhere('q.status = :status', { status: QuoteStatus.CONVERTED_TO_SALE })
    .getMany();

  for (const quote of quotes) {
    const saleId = quote.linkedSaleId!.trim();
    if (attributedSaleIds.has(saleId)) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      const row = attrRepo.create({
        saleId,
        leadSource: normalizeLeadSource(quote.leadSource ?? undefined),
        conversationId: quote.conversationId,
        quoteId: quote.id,
        customerId: quote.customerId,
        assignedStaffId: quote.assignedStaffId,
        branchId: quote.branchId,
        amount: quote.totalAmount > 0 ? quote.totalAmount : null,
        grossProfit: null,
      });
      await attrRepo.save(row);
    }

    attributedSaleIds.add(saleId);
    created += 1;
  }

  return { created, skipped, dryRun };
}
