import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductDemandEvent } from './entities/product-demand-event.entity';
import { ProductDemandSummary } from './entities/product-demand-summary.entity';
import { ProductAlias } from './entities/product-alias.entity';
import { MissingProductRequest } from './entities/missing-product-request.entity';
import { ProductDemandRecommendation } from './entities/product-demand-recommendation.entity';
import { ProductCatalogRequest } from './entities/product-catalog-request.entity';
import {
  MissingProductStatus,
  ProductCatalogRequestStatus,
  ProductDemandIntent,
  ProductDemandRecommendationPriority,
  ProductDemandRecommendationStatus,
  ProductDemandTrend,
} from './product-demand.enums';
import {
  extractPriceMention,
  extractProductMention,
  intentToProductDemand,
} from './utils/product-demand-detect.util';
import { detectCustomerIntent } from './utils/ai-intent-detector.util';
import { ProductsService } from '../products/products.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { StockingReminder } from './entities/stocking-reminder.entity';
import { StockingReminderReason, StockingReminderStatus } from './ai-signal.enums';
import { catalogProductNamesMatch } from './utils/catalog-request-match.util';
import { ProductDemandCampaignService } from './product-demand-campaign.service';

export type ProductCatalogRequestView = ProductCatalogRequest & {
  linkedProductName?: string | null;
};

export interface RecordDemandInput {
  sessionId?: string | null;
  chatId?: string | null;
  conversationId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  messageId?: string | null;
  rawMessage: string;
}

export interface ProductDemandListQuery {
  branchId?: string;
  category?: string;
  brand?: string;
  intent?: ProductDemandIntent;
  stockStatus?: string;
  matched?: 'matched' | 'unmatched';
  installmentOnly?: boolean;
  discountOnly?: boolean;
  paymentReadyOnly?: boolean;
  trendingOnly?: boolean;
  from?: string;
  to?: string;
}

export interface RecommendationActionResult {
  recommendation: ProductDemandRecommendation;
  taskId?: string;
  campaignId?: string;
  campaignPrefill?: {
    title: string;
    message: string;
    productNames: string[];
  };
}

@Injectable()
export class ProductDemandService {
  constructor(
    @InjectRepository(ProductDemandEvent, 'data')
    private readonly eventRepo: Repository<ProductDemandEvent>,
    @InjectRepository(ProductDemandSummary, 'data')
    private readonly summaryRepo: Repository<ProductDemandSummary>,
    @InjectRepository(ProductAlias, 'data')
    private readonly aliasRepo: Repository<ProductAlias>,
    @InjectRepository(MissingProductRequest, 'data')
    private readonly missingRepo: Repository<MissingProductRequest>,
    @InjectRepository(ProductDemandRecommendation, 'data')
    private readonly recRepo: Repository<ProductDemandRecommendation>,
    @InjectRepository(ProductCatalogRequest, 'data')
    private readonly catalogRequestRepo: Repository<ProductCatalogRequest>,
    @InjectRepository(StockingReminder, 'data')
    private readonly stockingRepo: Repository<StockingReminder>,
    @Inject(forwardRef(() => ProductsService))
    private readonly products: ProductsService,
    private readonly settings: AiLearningSettingsService,
    @Inject(forwardRef(() => ProductDemandCampaignService))
    private readonly campaigns: ProductDemandCampaignService,
  ) {}

  async recordFromMessage(input: RecordDemandInput): Promise<ProductDemandEvent | null> {
    const settings = await this.settings.getSettings();
    if (!settings.trackProductMentions) return null;

    const productName =
      extractProductMention(input.rawMessage) ?? input.rawMessage.trim().slice(0, 120);
    if (!productName || productName.length < 3) return null;

    const intent = detectCustomerIntent(input.rawMessage);
    const demandIntent = intentToProductDemand(intent, input.rawMessage);
    const match = await this.matchProduct(productName);

    const stockStatus = match.product
      ? match.product.inStock
        ? 'in_stock'
        : 'out_of_stock'
      : 'unknown';

    const event = this.eventRepo.create({
      sessionId: input.sessionId ?? null,
      chatId: input.chatId ?? null,
      conversationId: input.conversationId ?? null,
      customerId: input.customerId ?? null,
      branchId: input.branchId ?? null,
      messageId: input.messageId ?? null,
      rawMessage: input.rawMessage,
      detectedProductName: productName,
      matchedProductId: match.productId,
      matchedVariantId: match.variantId,
      category: match.category,
      brand: match.brand,
      intent: demandIntent,
      confidenceScore: match.confidence,
      stockStatusInternal: stockStatus,
      priceMentioned: extractPriceMention(input.rawMessage),
      customerBudget: null,
      customerOffer: null,
    });
    const saved = await this.eventRepo.save(event);
    await this.rollupSummary(saved);
    if (!match.productId && settings.trackUnmatchedProducts) {
      await this.upsertMissing(saved);
    }
    return saved;
  }

  private async matchProduct(name: string): Promise<{
    productId: string | null;
    variantId: string | null;
    category: string | null;
    brand: string | null;
    confidence: number;
    product: { inStock: boolean } | null;
  }> {
    const alias = await this.aliasRepo
      .createQueryBuilder('a')
      .where('LOWER(a.aliasText) = LOWER(:name)', { name: name.trim() })
      .orderBy('a.confidenceScore', 'DESC')
      .getOne();
    if (alias) {
      return {
        productId: alias.productId,
        variantId: alias.variantId,
        category: alias.category,
        brand: alias.brand,
        confidence: alias.confidenceScore,
        product: { inStock: true },
      };
    }

    const results = await this.products.searchForAgent({ q: name, limit: 3 });
    const top = results[0];
    if (!top) {
      return {
        productId: null,
        variantId: null,
        category: null,
        brand: null,
        confidence: 0,
        product: null,
      };
    }
    return {
      productId: top.id,
      variantId: top.variants[0]?.name ? null : null,
      category: top.category,
      brand: null,
      confidence: 0.75,
      product: { inStock: top.inStock },
    };
  }

  private async rollupSummary(event: ProductDemandEvent): Promise<void> {
    const period = 'week';
    const qb = this.summaryRepo
      .createQueryBuilder('s')
      .where('s.period = :period', { period });
    if (event.branchId) qb.andWhere('s.branchId = :branchId', { branchId: event.branchId });
    else qb.andWhere('s.branchId IS NULL');
    if (event.matchedProductId) {
      qb.andWhere('s.productId = :productId', { productId: event.matchedProductId });
    } else {
      qb.andWhere('s.productId IS NULL');
      qb.andWhere('s.detectedProductName = :name', { name: event.detectedProductName });
    }
    let summary = await qb.getOne();
    if (!summary) {
      summary = this.summaryRepo.create({
        branchId: event.branchId,
        productId: event.matchedProductId,
        variantId: event.matchedVariantId,
        detectedProductName: event.matchedProductId ? null : event.detectedProductName,
        category: event.category,
        brand: event.brand,
        period,
        requestCount: 0,
        uniqueCustomers: 0,
        priceRequests: 0,
        availabilityRequests: 0,
        installmentRequests: 0,
        discountRequests: 0,
        paymentReadyCount: 0,
        outOfStockCount: 0,
      });
    }
    summary.requestCount = (summary.requestCount ?? 0) + 1;
    summary.lastAskedAt = event.createdAt;
    if (event.customerId) {
      const ids = new Set(summary.customerIds ?? []);
      if (!ids.has(event.customerId)) {
        ids.add(event.customerId);
        summary.customerIds = [...ids];
        summary.uniqueCustomers = ids.size;
      }
    }
    if (event.intent === ProductDemandIntent.PRICE_REQUEST) {
      summary.priceRequests = (summary.priceRequests ?? 0) + 1;
    }
    if (event.intent === ProductDemandIntent.AVAILABILITY_REQUEST) {
      summary.availabilityRequests = (summary.availabilityRequests ?? 0) + 1;
    }
    if (event.intent === ProductDemandIntent.INSTALLMENT_REQUEST) {
      summary.installmentRequests = (summary.installmentRequests ?? 0) + 1;
    }
    if (event.intent === ProductDemandIntent.DISCOUNT_REQUEST) {
      summary.discountRequests = (summary.discountRequests ?? 0) + 1;
    }
    if (event.intent === ProductDemandIntent.PAYMENT_READY) {
      summary.paymentReadyCount = (summary.paymentReadyCount ?? 0) + 1;
    }
    if (event.stockStatusInternal === 'out_of_stock') {
      summary.outOfStockCount = (summary.outOfStockCount ?? 0) + 1;
    }
    if (summary.requestCount >= 10) summary.trend = ProductDemandTrend.RISING;
    summary.recommendedAction = this.suggestAction(summary);
    await this.summaryRepo.save(summary);
    await this.ensureRecommendations(summary);
  }

  private suggestAction(summary: ProductDemandSummary): string {
    if (summary.outOfStockCount >= 3) return 'restock';
    if (summary.installmentRequests >= 5) return 'enable_installment';
    if (summary.discountRequests >= 5) return 'review_price';
    if (summary.paymentReadyCount >= 3) return 'follow_up_sale';
    if (!summary.productId && summary.requestCount >= 5) return 'add_to_catalog';
    return 'monitor';
  }

  private async upsertMissing(event: ProductDemandEvent): Promise<void> {
    const key = event.detectedProductName.trim().toLowerCase();
    let row = await this.missingRepo
      .createQueryBuilder('m')
      .where('LOWER(m.rawProductName) = :key', { key })
      .getOne();
    if (!row) {
      row = this.missingRepo.create({
        rawProductName: event.detectedProductName,
        branchId: event.branchId,
        status: MissingProductStatus.UNMATCHED,
        exampleMessages: [event.rawMessage ?? ''],
        customerIds: event.customerId ? [event.customerId] : [],
      });
    } else {
      row.timesAsked = (row.timesAsked ?? 0) + 1;
      const msgs = row.exampleMessages ?? [];
      if (event.rawMessage && msgs.length < 10) msgs.push(event.rawMessage);
      row.exampleMessages = msgs;
      if (event.customerId) {
        const ids = new Set(row.customerIds ?? []);
        ids.add(event.customerId);
        row.uniqueCustomers = ids.size;
        row.customerIds = [...ids];
      }
    }
    await this.missingRepo.save(row);
  }

  async listSummaries(query: ProductDemandListQuery = {}): Promise<ProductDemandSummary[]> {
    const qb = this.summaryRepo.createQueryBuilder('s').orderBy('s.requestCount', 'DESC');
    if (query.branchId) qb.andWhere('s.branchId = :branchId', { branchId: query.branchId });
    if (query.category) qb.andWhere('s.category = :category', { category: query.category });
    if (query.brand) qb.andWhere('s.brand = :brand', { brand: query.brand });
    if (query.matched === 'matched') qb.andWhere('s.productId IS NOT NULL');
    if (query.matched === 'unmatched') qb.andWhere('s.productId IS NULL');
    if (query.installmentOnly) qb.andWhere('s.installmentRequests > 0');
    if (query.discountOnly) qb.andWhere('s.discountRequests > 0');
    if (query.paymentReadyOnly) qb.andWhere('s.paymentReadyCount > 0');
    if (query.trendingOnly) qb.andWhere('s.trend = :trend', { trend: ProductDemandTrend.RISING });
    if (query.from) qb.andWhere('s.lastAskedAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('s.lastAskedAt <= :to', { to: query.to });
    return qb.take(200).getMany();
  }

  async getSummaryDetail(id: string): Promise<{
    summary: ProductDemandSummary;
    recentEvents: ProductDemandEvent[];
  }> {
    const summary = await this.summaryRepo.findOne({ where: { id } });
    if (!summary) throw new NotFoundException('Demand summary not found');
    const qb = this.eventRepo.createQueryBuilder('e').orderBy('e.createdAt', 'DESC').take(20);
    if (summary.productId) {
      qb.andWhere('e.matchedProductId = :pid', { pid: summary.productId });
    } else {
      qb.andWhere('e.detectedProductName = :name', {
        name: summary.detectedProductName,
      });
    }
    const recentEvents = await qb.getMany();
    return { summary, recentEvents };
  }

  async getOverview(): Promise<{
    mostAskedProduct: string | null;
    mostAskedCategory: string | null;
    topMissingProduct: string | null;
    highestInstallmentDemand: number;
    highestDiscountPressure: number;
    paymentReadyDemand: number;
    trendingThisWeek: number;
  }> {
    const top = await this.summaryRepo.find({ order: { requestCount: 'DESC' }, take: 1 });
    const topCat = await this.summaryRepo
      .createQueryBuilder('s')
      .select('s.category', 'category')
      .addSelect('SUM(s.requestCount)', 'cnt')
      .where('s.category IS NOT NULL')
      .groupBy('s.category')
      .orderBy('cnt', 'DESC')
      .limit(1)
      .getRawOne<{ category: string }>();
    const topMissing = await this.missingRepo.find({
      order: { timesAsked: 'DESC' },
      take: 1,
    });
    const installment = await this.summaryRepo
      .createQueryBuilder('s')
      .select('MAX(s.installmentRequests)', 'max')
      .getRawOne<{ max: string }>();
    const discount = await this.summaryRepo
      .createQueryBuilder('s')
      .select('MAX(s.discountRequests)', 'max')
      .getRawOne<{ max: string }>();
    const paymentReady = await this.summaryRepo
      .createQueryBuilder('s')
      .select('SUM(s.paymentReadyCount)', 'sum')
      .getRawOne<{ sum: string }>();
    const trending = await this.summaryRepo.count({
      where: { trend: ProductDemandTrend.RISING },
    });

    return {
      mostAskedProduct: top[0]?.detectedProductName ?? top[0]?.productId ?? null,
      mostAskedCategory: topCat?.category ?? null,
      topMissingProduct: topMissing[0]?.rawProductName ?? null,
      highestInstallmentDemand: Number(installment?.max ?? 0),
      highestDiscountPressure: Number(discount?.max ?? 0),
      paymentReadyDemand: Number(paymentReady?.sum ?? 0),
      trendingThisWeek: trending,
    };
  }

  /** Rebuild weekly demand summaries from stored events (recovery after rollup bugs). */
  async backfillSummariesFromEvents(): Promise<{ processed: number; summaries: number }> {
    const events = await this.eventRepo.find({ order: { createdAt: 'ASC' } });
    await this.summaryRepo.clear();
    await this.missingRepo.clear();
    for (const event of events) {
      await this.rollupSummary(event);
      if (!event.matchedProductId) {
        await this.upsertMissing(event);
      }
    }
    const summaries = await this.summaryRepo.count();
    return { processed: events.length, summaries };
  }

  listMissing(status?: MissingProductStatus): Promise<MissingProductRequest[]> {
    const qb = this.missingRepo.createQueryBuilder('m').orderBy('m.timesAsked', 'DESC');
    if (status) qb.andWhere('m.status = :status', { status });
    return qb.take(200).getMany();
  }

  async getMissingDetail(id: string): Promise<{
    missing: MissingProductRequest;
    recentChats: Array<{
      sessionId: string;
      chatId: string;
      customerId: string | null;
      lastMessage: string | null;
      lastAskedAt: Date;
    }>;
  }> {
    const missing = await this.missingRepo.findOne({ where: { id } });
    if (!missing) throw new NotFoundException('Missing product not found');

    const events = await this.eventRepo
      .createQueryBuilder('e')
      .where('LOWER(e.detectedProductName) = :key', {
        key: missing.rawProductName.trim().toLowerCase(),
      })
      .andWhere('e.sessionId IS NOT NULL')
      .andWhere('e.chatId IS NOT NULL')
      .orderBy('e.createdAt', 'DESC')
      .take(50)
      .getMany();

    const seen = new Set<string>();
    const recentChats: Array<{
      sessionId: string;
      chatId: string;
      customerId: string | null;
      lastMessage: string | null;
      lastAskedAt: Date;
    }> = [];

    for (const event of events) {
      const key = `${event.sessionId}:${event.chatId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recentChats.push({
        sessionId: event.sessionId!,
        chatId: event.chatId!,
        customerId: event.customerId,
        lastMessage: event.rawMessage,
        lastAskedAt: event.createdAt,
      });
    }

    return { missing, recentChats };
  }

  async mapMissing(
    id: string,
    input: {
      productId: string;
      variantId?: string;
      aliasNames?: string[];
      createdBy?: string;
    },
  ): Promise<MissingProductRequest> {
    const row = await this.missingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Missing product not found');
    row.suggestedProductId = input.productId;
    row.status = MissingProductStatus.MAPPED;
    await this.missingRepo.save(row);
    const aliases = [row.rawProductName, ...(input.aliasNames ?? [])];
    for (const aliasText of aliases) {
      await this.aliasRepo.save(
        this.aliasRepo.create({
          aliasText,
          productId: input.productId,
          variantId: input.variantId ?? null,
          createdBy: input.createdBy ?? null,
          confidenceScore: 0.9,
        }),
      );
    }
    return row;
  }

  async ignoreMissing(id: string): Promise<MissingProductRequest> {
    const row = await this.missingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Missing product not found');
    row.status = MissingProductStatus.IGNORED;
    return this.missingRepo.save(row);
  }

  async addAlias(input: {
    aliasText: string;
    productId: string;
    variantId?: string;
    category?: string;
    brand?: string;
    createdBy?: string;
  }): Promise<ProductAlias> {
    return this.aliasRepo.save(
      this.aliasRepo.create({
        aliasText: input.aliasText,
        productId: input.productId,
        variantId: input.variantId ?? null,
        category: input.category ?? null,
        brand: input.brand ?? null,
        createdBy: input.createdBy ?? null,
        confidenceScore: 0.85,
      }),
    );
  }

  async createStockingReminder(input: {
    productId?: string;
    productName?: string;
    sessionId?: string;
    chatId?: string;
    branchId?: string;
    note?: string;
  }): Promise<StockingReminder> {
    return this.stockingRepo.save(
      this.stockingRepo.create({
        productId: input.productId ?? null,
        productName: input.productName ?? null,
        sessionId: input.sessionId ?? null,
        chatId: input.chatId ?? null,
        branchId: input.branchId ?? null,
        note: input.note ?? null,
        reason: StockingReminderReason.DEMAND_DETECTED,
        status: StockingReminderStatus.OPEN,
      }),
    );
  }

  listRecommendations(): Promise<ProductDemandRecommendation[]> {
    return this.recRepo.find({
      where: { status: ProductDemandRecommendationStatus.OPEN },
      order: { priority: 'DESC', createdAt: 'DESC' },
      take: 50,
    });
  }

  private async ensureRecommendations(summary: ProductDemandSummary): Promise<void> {
    if (summary.outOfStockCount >= 3 && summary.productId) {
      const exists = await this.recRepo.findOne({
        where: { summaryId: summary.id, status: ProductDemandRecommendationStatus.OPEN },
      });
      if (!exists) {
        await this.recRepo.save(
          this.recRepo.create({
            title: `Restock ${summary.detectedProductName ?? summary.productId}`,
            reason: 'High out-of-stock demand detected from customer messages',
            dataProof: `${summary.outOfStockCount} OOS requests`,
            expectedImpact: 'Recover lost sales from waiting customers',
            priority: ProductDemandRecommendationPriority.HIGH,
            suggestedAction: 'create_stocking_reminder',
            productIds: summary.productId ? [summary.productId] : null,
            productNames: summary.detectedProductName ? [summary.detectedProductName] : null,
            customersAffected: summary.requestCount,
            branchId: summary.branchId,
            summaryId: summary.id,
          }),
        );
      }
    }
  }

  async recommendationAction(
    id: string,
    action: 'accept' | 'task' | 'campaign' | 'stocking' | 'done',
    createdBy?: string | null,
  ): Promise<RecommendationActionResult> {
    const row = await this.recRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Recommendation not found');
    const result: RecommendationActionResult = { recommendation: row };

    if (action === 'stocking' && row.productIds?.[0]) {
      await this.createStockingReminder({
        productId: row.productIds[0],
        productName: row.productNames?.[0],
        branchId: row.branchId ?? undefined,
        note: row.reason,
      });
    }

    if (action === 'task') {
      const created = await this.createProductRequest({
        productName: row.productNames?.[0] ?? row.title,
        customerCount: row.customersAffected,
        branchId: row.branchId,
        priority: row.priority,
        notes: `${row.reason}\n${row.dataProof ?? ''}`.trim(),
      });
      result.taskId = created.request.id;
    }

    if (action === 'campaign') {
      const campaign = await this.campaigns.createFromRecommendation(id, createdBy);
      result.campaignId = campaign.id;
      result.campaignPrefill = {
        title: campaign.title,
        message: campaign.message,
        productNames: campaign.productNames ?? [row.title],
      };
    }

    row.status =
      action === 'done'
        ? ProductDemandRecommendationStatus.DONE
        : ProductDemandRecommendationStatus.ACCEPTED;
    result.recommendation = await this.recRepo.save(row);
    return result;
  }

  async createProductRequest(input: {
    productName: string;
    category?: string | null;
    brand?: string | null;
    suggestedSpecs?: string | null;
    branchId?: string | null;
    customerCount?: number;
    exampleMessages?: string[];
    priority?: string;
    notes?: string | null;
    assignedStaffId?: string | null;
    dueDate?: Date | null;
    missingProductRequestId?: string | null;
    createdBy?: string | null;
    createStockingReminder?: boolean;
  }): Promise<{ request: ProductCatalogRequest; stockingReminder?: StockingReminder }> {
    const request = await this.catalogRequestRepo.save(
      this.catalogRequestRepo.create({
        productName: input.productName.trim(),
        category: input.category ?? null,
        brand: input.brand ?? null,
        suggestedSpecs: input.suggestedSpecs ?? null,
        branchId: input.branchId ?? null,
        customerCount: input.customerCount ?? 1,
        exampleMessages: input.exampleMessages ?? null,
        priority: input.priority ?? 'medium',
        notes: input.notes ?? null,
        assignedStaffId: input.assignedStaffId ?? null,
        dueDate: input.dueDate ?? null,
        missingProductRequestId: input.missingProductRequestId ?? null,
        createdBy: input.createdBy ?? null,
        status: ProductCatalogRequestStatus.OPEN,
      }),
    );

    if (input.missingProductRequestId) {
      const missing = await this.missingRepo.findOne({
        where: { id: input.missingProductRequestId },
      });
      if (missing) {
        missing.status = MissingProductStatus.ADDED_TO_CATALOG;
        await this.missingRepo.save(missing);
      }
    }

    let stockingReminder: StockingReminder | undefined;
    if (input.createStockingReminder) {
      stockingReminder = await this.createStockingReminder({
        productName: input.productName,
        branchId: input.branchId ?? undefined,
        note: input.notes ?? `Catalog request: ${input.productName}`,
      });
    }

    return { request, stockingReminder };
  }

  async listProductRequests(status?: string): Promise<ProductCatalogRequestView[]> {
    const qb = this.catalogRequestRepo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .take(100);

    const filter = status?.trim() || 'active';
    if (filter === 'active') {
      qb.andWhere('r.status IN (:...statuses)', {
        statuses: [
          ProductCatalogRequestStatus.OPEN,
          ProductCatalogRequestStatus.IN_PROGRESS,
        ],
      });
    } else if (filter !== 'all') {
      qb.andWhere('r.status = :status', { status: filter });
    }

    const rows = await qb.getMany();
    return this.attachLinkedProductNames(rows);
  }

  async getProductRequest(id: string): Promise<ProductCatalogRequestView> {
    const row = await this.catalogRequestRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Product request not found');
    const [enriched] = await this.attachLinkedProductNames([row]);
    return enriched;
  }

  private async attachLinkedProductNames(
    rows: ProductCatalogRequest[],
  ): Promise<ProductCatalogRequestView[]> {
    const productIds = [
      ...new Set(rows.map(r => r.productId).filter((id): id is string => Boolean(id))),
    ];
    const nameMap = productIds.length
      ? await this.products.findNamesByIds(productIds)
      : {};
    return rows.map(row => ({
      ...row,
      linkedProductName: row.productId ? nameMap[row.productId] ?? null : null,
    }));
  }

  async linkProductRequestToCatalog(
    id: string,
    productId: string,
  ): Promise<ProductCatalogRequestView> {
    await this.products.findOne(productId);
    const row = await this.catalogRequestRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Product request not found');
    if (
      row.status === ProductCatalogRequestStatus.DONE ||
      row.status === ProductCatalogRequestStatus.CANCELLED
    ) {
      throw new BadRequestException('Product request is already closed');
    }
    row.productId = productId;
    row.status = ProductCatalogRequestStatus.DONE;
    row.fulfilledAt = new Date();
    const saved = await this.catalogRequestRepo.save(row);
    const [enriched] = await this.attachLinkedProductNames([saved]);
    return enriched;
  }

  async fulfillMatchingCatalogRequests(
    productId: string,
    productName: string,
  ): Promise<number> {
    const rows = await this.catalogRequestRepo.find({
      where: {
        status: In([
          ProductCatalogRequestStatus.OPEN,
          ProductCatalogRequestStatus.IN_PROGRESS,
        ]),
      },
      take: 200,
    });
    const now = new Date();
    let count = 0;
    for (const row of rows) {
      if (!catalogProductNamesMatch(row.productName, productName)) continue;
      row.productId = productId;
      row.status = ProductCatalogRequestStatus.DONE;
      row.fulfilledAt = now;
      await this.catalogRequestRepo.save(row);
      count += 1;
    }
    return count;
  }

  async updateProductRequest(
    id: string,
    patch: {
      status?: ProductCatalogRequestStatus | string;
      notes?: string | null;
      assignedStaffId?: string | null;
      dueDate?: Date | null;
      priority?: string;
    },
  ): Promise<ProductCatalogRequest> {
    const row = await this.getProductRequest(id);
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.assignedStaffId !== undefined) row.assignedStaffId = patch.assignedStaffId;
    if (patch.dueDate !== undefined) row.dueDate = patch.dueDate;
    if (patch.priority !== undefined) row.priority = patch.priority;
    return this.catalogRequestRepo.save(row);
  }

  async dismissRecommendation(id: string): Promise<ProductDemandRecommendation> {
    const row = await this.recRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Recommendation not found');
    row.status = ProductDemandRecommendationStatus.DISMISSED;
    return this.recRepo.save(row);
  }

  async getDashboardCounts(): Promise<{
    outOfStockDemand: number;
    installmentDemand: number;
    missingProducts: number;
  }> {
    const oos = await this.summaryRepo
      .createQueryBuilder('s')
      .select('SUM(s.outOfStockCount)', 'sum')
      .getRawOne<{ sum: string }>();
    const inst = await this.summaryRepo
      .createQueryBuilder('s')
      .select('SUM(s.installmentRequests)', 'sum')
      .getRawOne<{ sum: string }>();
    const missing = await this.missingRepo.count({
      where: { status: MissingProductStatus.UNMATCHED },
    });
    return {
      outOfStockDemand: Number(oos?.sum ?? 0),
      installmentDemand: Number(inst?.sum ?? 0),
      missingProducts: missing,
    };
  }
}
