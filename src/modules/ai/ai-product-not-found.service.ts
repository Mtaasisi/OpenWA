import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { ProductDemandService } from './product-demand.service';
import { AiSettingsService } from './ai-settings.service';
import { ProductCatalogRequest } from './entities/product-catalog-request.entity';
import { ProductCatalogRequestStatus } from './product-demand.enums';
import {
  buildProductNotFoundFallbackReply,
  extractProductSearchQuery,
  looksLikeProductQuery,
  normalizeProductQuery,
} from './utils/product-not-found-fallback.util';

export interface ProductNotFoundResolveInput {
  sessionId: string;
  chatId: string;
  incomingText: string;
  branchId?: string | null;
  messageId?: string | null;
  customerId?: string | null;
}

export interface ProductNotFoundResolveResult {
  reply: string;
  productQuery: string;
  demandRecorded: boolean;
}

@Injectable()
export class AiProductNotFoundService {
  private readonly logger = new Logger(AiProductNotFoundService.name);

  constructor(
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ProductDemandService))
    private readonly productDemand: ProductDemandService,
    private readonly aiSettings: AiSettingsService,
    @InjectRepository(ProductCatalogRequest, 'data')
    private readonly catalogRequestRepo: Repository<ProductCatalogRequest>,
  ) {}

  async tryResolveNotFoundReply(
    input: ProductNotFoundResolveInput,
  ): Promise<ProductNotFoundResolveResult | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.replyWhenProductNotFound === false) return null;

    const incomingText = input.incomingText.trim();
    if (!looksLikeProductQuery(incomingText)) return null;

    const productQuery = extractProductSearchQuery(incomingText);
    if (!productQuery) return null;

    const searchResults = await this.productsService.searchForAgent({
      q: productQuery,
      limit: 5,
      inStockOnly: false,
      branchId: input.branchId,
    });
    if (searchResults.length > 0) return null;

    const alternatives = await this.findRelatedAlternatives(productQuery, input.branchId);
    const reply = buildProductNotFoundFallbackReply(productQuery, incomingText, alternatives);
    const demandRecorded = await this.recordDemandWithDedup({
      ...input,
      productQuery,
      reply,
    });

    return { reply, productQuery, demandRecorded };
  }

  private async findRelatedAlternatives(
    query: string,
    branchId?: string | null,
  ): Promise<string[]> {
    const broad = query.split(/\s+/)[0];
    if (broad.length < 3) return [];
    const related = await this.productsService.searchForAgent({
      q: broad,
      limit: 5,
      inStockOnly: false,
      branchId,
    });
    return related.map(p => p.name).filter(Boolean);
  }

  private async recordDemandWithDedup(input: {
    sessionId: string;
    chatId: string;
    incomingText: string;
    branchId?: string | null;
    messageId?: string | null;
    customerId?: string | null;
    productQuery: string;
    reply: string;
  }): Promise<boolean> {
    try {
      try {
        await this.productDemand.recordFromMessage({
          sessionId: input.sessionId,
          chatId: input.chatId,
          branchId: input.branchId ?? null,
          messageId: input.messageId ?? null,
          customerId: input.customerId ?? null,
          rawMessage: input.incomingText,
        });
      } catch (eventError) {
        this.logger.warn(
          `Product demand event record failed: ${eventError instanceof Error ? eventError.message : String(eventError)}`,
        );
      }

      const normalized = normalizeProductQuery(input.productQuery);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingQb = this.catalogRequestRepo
        .createQueryBuilder('r')
        .where('LOWER(r.productName) = :name', { name: normalized })
        .andWhere('r.createdAt >= :since', { since })
        .andWhere('r.status IN (:...statuses)', {
          statuses: [
            ProductCatalogRequestStatus.OPEN,
            ProductCatalogRequestStatus.IN_PROGRESS,
          ],
        });
      if (input.branchId) {
        existingQb.andWhere('r.branchId = :branchId', { branchId: input.branchId });
      } else {
        existingQb.andWhere('r.branchId IS NULL');
      }
      const existing = await existingQb.getOne();

      if (existing) {
        existing.customerCount = (existing.customerCount ?? 1) + 1;
        const examples = existing.exampleMessages ?? [];
        if (!examples.includes(input.incomingText)) {
          existing.exampleMessages = [...examples, input.incomingText].slice(-5);
        }
        await this.catalogRequestRepo.save(existing);
      } else {
        await this.productDemand.createProductRequest({
          productName: input.productQuery,
          branchId: input.branchId ?? null,
          customerCount: 1,
          exampleMessages: [input.incomingText],
          notes: `AI product-not-found: ${input.incomingText}`,
          createStockingReminder: true,
        });
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Product demand record failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
