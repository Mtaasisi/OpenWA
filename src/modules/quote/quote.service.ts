import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { QuoteStatus, QuotePermission } from './quote.enums';
import {
  AddQuoteItemDto,
  ConvertQuoteDto,
  CreateChatQuoteDto,
  QuoteItemInputDto,
  SendQuoteDto,
  UpdateQuoteDto,
} from './dto/quote.dto';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductsService } from '../products/products.service';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { MessageService } from '../message/message.service';
import { assertApiKeySessionAccess } from '../../common/utils/api-key-session.util';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { FollowupHookService } from '../followup/followup-hook.service';
import { ConversationStage } from '../followup/followup.enums';
import { formatQuoteWhatsAppMessage } from './utils/quote-message.format';
import { InauzwaSaleService } from './inauzwa-sale.service';
import { ApiKey } from '../auth/entities/api-key.entity';
import { hasQuotePermission } from './utils/permissions.util';
import { SmsService } from '../sms/sms.service';

const LOW_STOCK_THRESHOLD = 10;

function stockStatusForQty(qty: number): string {
  if (qty <= 0) return 'out_of_stock';
  if (qty < LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

function lineTotal(item: Pick<QuoteItemInputDto, 'quantity' | 'unitPrice' | 'discountAmount'>): number {
  const gross = item.quantity * item.unitPrice;
  const disc = item.discountAmount ?? 0;
  return Math.max(0, gross - disc);
}

@Injectable()
export class QuoteService {
  constructor(
    @InjectRepository(Quote, 'data')
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(QuoteItem, 'data')
    private readonly itemRepo: Repository<QuoteItem>,
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly productsService: ProductsService,
    private readonly inauzwaPrefs: InauzwaSyncPreferencesService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
    @Inject(forwardRef(() => FollowupHookService))
    private readonly followupHookService: FollowupHookService,
    private readonly inauzwaSaleService: InauzwaSaleService,
    private readonly smsService: SmsService,
  ) {}

  async list(filters: {
    sessionId?: string;
    chatId?: string;
    branchId?: string;
    status?: QuoteStatus;
  }): Promise<Quote[]> {
    const qb = this.quoteRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.items', 'items')
      .orderBy('q.createdAt', 'DESC')
      .addOrderBy('items.sortOrder', 'ASC');

    if (filters.sessionId) qb.andWhere('q.sessionId = :sessionId', { sessionId: filters.sessionId });
    if (filters.chatId) qb.andWhere('q.chatId = :chatId', { chatId: filters.chatId });
    if (filters.status) qb.andWhere('q.status = :status', { status: filters.status });
    if (filters.branchId) {
      qb.andWhere('(q.branchId = :branchId OR q.branchId IS NULL)', { branchId: filters.branchId });
    }

    return qb.getMany();
  }

  async search(query: string, limit = 15): Promise<Quote[]> {
    const q = query.trim();
    if (!q) return [];
    const like = `%${q}%`;
    return this.quoteRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.items', 'items')
      .where(
        '(q.customerName LIKE :like OR q.customerPhone LIKE :like OR q.quoteNumber LIKE :like OR q.notes LIKE :like OR items.itemName LIKE :like OR items.description LIKE :like)',
        { like },
      )
      .orderBy('q.createdAt', 'DESC')
      .addOrderBy('items.sortOrder', 'ASC')
      .take(Math.min(limit, 25))
      .getMany();
  }

  async findOne(id: string): Promise<Quote> {
    const quote = await this.quoteRepo.findOne({ where: { id }, relations: ['items'] });
    if (!quote) throw new NotFoundException('Quote not found');
    quote.items = [...(quote.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return quote;
  }

  async createFromChat(dto: CreateChatQuoteDto, apiKey: ApiKey): Promise<Quote> {
    const branchId = dto.branchId ?? (await this.inauzwaPrefs.resolveEffectiveBranchId());
    const prefs = await this.inauzwaPrefs.get();
    const currency = prefs.currency || 'TZS';

    let conversationId = dto.conversationId ?? null;
    let leadSource: string | null = null;
    let conv = null as Awaited<ReturnType<FollowupConversationService['findByThread']>>;
    if (!conversationId) {
      conv = await this.followupConversationService.findByThread(dto.sessionId, dto.chatId);
      conversationId = conv?.id ?? null;
    } else {
      conv = await this.followupConversationService.findById(conversationId).catch(() => null);
    }
    leadSource = conv?.source ?? 'whatsapp';

    const quoteNumber = await this.nextQuoteNumber();
    const quote = this.quoteRepo.create({
      quoteNumber,
      branchId: branchId ?? null,
      customerId: dto.customerId ?? conv?.customerId ?? null,
      customerName: dto.customerName ?? conv?.customerName ?? null,
      customerPhone: dto.customerPhone ?? conv?.customerPhone ?? null,
      sessionId: dto.sessionId,
      chatId: dto.chatId,
      conversationId,
      assignedStaffId: conv?.assignedStaffId ?? apiKey.id,
      leadSource,
      status: QuoteStatus.DRAFT,
      currency,
      notes: dto.notes ?? null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : this.defaultValidUntil(),
      paymentInstructions: prefs.defaultPaymentInstructions ?? null,
      branchPickupInfo: prefs.defaultBranchPickupInfo ?? null,
      createdBy: apiKey.id,
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      taxAmount: 0,
      totalAmount: 0,
    });

    const saved = await this.quoteRepo.save(quote);
    if (dto.items?.length) {
      await this.replaceItems(saved, dto.items, apiKey);
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateQuoteDto, apiKey: ApiKey): Promise<Quote> {
    const quote = await this.findOne(id);
    this.assertEditable(quote);

    if (dto.discountAmount != null && dto.discountAmount > 0) {
      this.assertDiscountAllowed(apiKey, dto.discountAmount);
    }

    if (dto.customerName !== undefined) quote.customerName = dto.customerName;
    if (dto.customerPhone !== undefined) quote.customerPhone = dto.customerPhone;
    if (dto.customerId !== undefined) quote.customerId = dto.customerId;
    if (dto.notes !== undefined) quote.notes = dto.notes;
    if (dto.paymentInstructions !== undefined) quote.paymentInstructions = dto.paymentInstructions;
    if (dto.branchPickupInfo !== undefined) quote.branchPickupInfo = dto.branchPickupInfo;
    if (dto.validUntil !== undefined) quote.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.discountAmount !== undefined) quote.discountAmount = dto.discountAmount;
    if (dto.deliveryFee !== undefined) quote.deliveryFee = dto.deliveryFee;
    if (dto.taxAmount !== undefined) quote.taxAmount = dto.taxAmount;

    await this.quoteRepo.save(quote);

    if (dto.items) {
      await this.replaceItems(quote, dto.items, apiKey);
    } else {
      await this.recalculateTotals(quote.id);
    }

    return this.findOne(id);
  }

  async addItem(quoteId: string, dto: AddQuoteItemDto, apiKey: ApiKey): Promise<Quote> {
    const quote = await this.findOne(quoteId);
    this.assertEditable(quote);
    if ((dto.discountAmount ?? 0) > 0) this.assertDiscountAllowed(apiKey, dto.discountAmount ?? 0);

    const enriched = await this.enrichItemInput(dto);
    const sortOrder = quote.items.length;
    const item = this.itemRepo.create({
      quoteId: quote.id,
      ...enriched,
      sortOrder,
    });
    await this.itemRepo.save(item);
    await this.recalculateTotals(quoteId);
    return this.findOne(quoteId);
  }

  async removeItem(quoteId: string, itemId: string): Promise<Quote> {
    const quote = await this.findOne(quoteId);
    this.assertEditable(quote);
    const item = quote.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Quote item not found');
    await this.itemRepo.delete(itemId);
    await this.recalculateTotals(quoteId);
    return this.findOne(quoteId);
  }

  async setDeliveryFee(quoteId: string, deliveryFee: number): Promise<Quote> {
    const quote = await this.findOne(quoteId);
    this.assertEditable(quote);
    quote.deliveryFee = Math.max(0, deliveryFee);
    await this.quoteRepo.save(quote);
    await this.recalculateTotals(quoteId);
    return this.findOne(quoteId);
  }

  async previewMessage(id: string): Promise<{ body: string }> {
    const quote = await this.findOne(id);
    const prefs = await this.inauzwaPrefs.get();
    return {
      body: formatQuoteWhatsAppMessage(quote, {
        businessName: prefs.businessName,
        paymentInstructions: quote.paymentInstructions ?? prefs.defaultPaymentInstructions,
        branchPickupInfo: quote.branchPickupInfo ?? prefs.defaultBranchPickupInfo,
      }),
    };
  }

  async send(id: string, dto: SendQuoteDto, apiKey: ApiKey): Promise<Quote> {
    const quote = await this.findOne(id);
    if (quote.status === QuoteStatus.CONVERTED_TO_SALE) {
      throw new BadRequestException('Quote already converted to sale');
    }
    if (quote.items.length === 0) {
      throw new BadRequestException('Add at least one item before sending');
    }

    assertApiKeySessionAccess(apiKey, quote.sessionId);

    const preview = dto.messageBody?.trim() || (await this.previewMessage(id)).body;
    await this.messageService.sendText(
      quote.sessionId,
      { chatId: quote.chatId, text: preview },
      { actorStaffId: apiKey.id, source: 'quote' },
    );

    quote.status = QuoteStatus.SENT;
    await this.quoteRepo.save(quote);

    try {
      const proformaId = await this.inauzwaSaleService.mirrorProformaFromQuote(quote);
      if (proformaId) {
        quote.externalProformaId = proformaId;
        await this.quoteRepo.save(quote);
      }
    } catch {
      // non-blocking — local quote still sent
    }

    if (quote.conversationId) {
      const conv = await this.followupConversationService.findById(quote.conversationId);
      if (conv) {
        await this.followupHookService.handleStageChange(
          conv.sessionId,
          conv.chatId,
          ConversationStage.PRICE_SENT,
        );
      }
    }

    return this.findOne(id);
  }

  async notifyBySms(id: string, apiKey: ApiKey) {
    const quote = await this.findOne(id);
    if (quote.items.length === 0) {
      throw new BadRequestException('Quote has no items');
    }

    let phone = quote.customerPhone;
    if (!phone && quote.conversationId) {
      const conv = await this.followupConversationService.findById(quote.conversationId);
      phone = conv?.customerPhone ?? null;
    }
    if (!phone) {
      throw new BadRequestException('Customer phone required for SMS notification');
    }

    const customerName = quote.customerName ?? 'Mteja';
    const amount = `${quote.currency ?? 'TSh'} ${quote.totalAmount.toLocaleString()}`;
    const message = `Habari ${customerName}, quote yako iko tayari. Jumla: ${amount}. Tafadhali angalia WhatsApp au wasiliana nasi.`;

    return this.smsService.send(
      {
        toPhone: phone,
        message,
        customerId: quote.customerId ?? undefined,
        conversationId: quote.conversationId ?? undefined,
        relatedType: 'quote',
        relatedId: quote.id,
      },
      apiKey,
    );
  }

  async setStatus(id: string, status: QuoteStatus): Promise<Quote> {
    const quote = await this.findOne(id);
    if (quote.status === QuoteStatus.CONVERTED_TO_SALE) {
      throw new BadRequestException('Quote already converted');
    }

    if (status === QuoteStatus.EXPIRED && quote.validUntil) {
      const now = new Date();
      if (quote.validUntil > now && quote.status !== QuoteStatus.SENT) {
        // allow manual expire
      }
    }

    quote.status = status;
    await this.quoteRepo.save(quote);

    if (status === QuoteStatus.ACCEPTED && quote.conversationId) {
      const conv = await this.followupConversationService.findById(quote.conversationId);
      if (conv) {
        await this.followupHookService.handleStageChange(
          conv.sessionId,
          conv.chatId,
          ConversationStage.NEGOTIATING,
        );
      }
    }

    return this.findOne(id);
  }

  async convertToSale(id: string, dto: ConvertQuoteDto, apiKey: ApiKey): Promise<Quote> {
    const quote = await this.findOne(id);
    if (quote.status === QuoteStatus.CONVERTED_TO_SALE) {
      throw new BadRequestException('Quote already converted');
    }
    if (quote.status !== QuoteStatus.ACCEPTED && quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException('Quote must be sent or accepted before conversion');
    }
    if (quote.items.length === 0) {
      throw new BadRequestException('Quote has no items');
    }

    const prefs = await this.inauzwaPrefs.get();
    let linkedSaleId = dto.linkedSaleId?.trim() || null;

    if (prefs.pushSalesToInauzwa) {
      const result = await this.inauzwaSaleService.checkoutFromQuote(quote, {
        paymentPending: dto.paymentPending ?? false,
      });
      linkedSaleId = result.saleId;
    } else if (!linkedSaleId) {
      linkedSaleId = `SALE-${Date.now().toString(36).toUpperCase()}`;
    }

    quote.linkedSaleId = linkedSaleId;
    quote.status = QuoteStatus.CONVERTED_TO_SALE;
    await this.quoteRepo.save(quote);

    if (quote.conversationId) {
      await this.followupConversationService.linkSale(quote.conversationId, {
        saleId: linkedSaleId,
        leadSource: (quote.leadSource as import('../followup/followup.enums').ConversationSource) ?? undefined,
        customerId: quote.customerId ?? undefined,
        assignedStaffId: quote.assignedStaffId ?? apiKey.id,
        quoteId: quote.id,
        amount: quote.totalAmount,
      });
    }

    return this.findOne(id);
  }

  private async replaceItems(quote: Quote, items: QuoteItemInputDto[], apiKey: ApiKey): Promise<void> {
    for (const item of items) {
      if ((item.discountAmount ?? 0) > 0) {
        this.assertDiscountAllowed(apiKey, item.discountAmount ?? 0);
      }
    }
    await this.itemRepo.delete({ quoteId: quote.id });
    let order = 0;
    for (const input of items) {
      const enriched = await this.enrichItemInput(input);
      await this.itemRepo.save(
        this.itemRepo.create({
          quoteId: quote.id,
          ...enriched,
          sortOrder: order++,
        }),
      );
    }
    await this.recalculateTotals(quote.id);
  }

  private async enrichItemInput(
    dto: QuoteItemInputDto,
  ): Promise<Omit<QuoteItem, 'id' | 'quoteId' | 'quote' | 'sortOrder'>> {
    let itemName = dto.itemName.trim();
    let description = dto.description ?? null;
    let unitPrice = dto.unitPrice;
    let stockStatus: string | null = null;
    let metadata = dto.metadata ?? null;
    let productId = dto.productId ?? null;
    let variantId = dto.variantId ?? null;

    if (productId) {
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) throw new BadRequestException('Product not found');
      if (!itemName) itemName = product.name;

      if (variantId) {
        const variant = await this.variantRepo.findOne({ where: { id: variantId, productId } });
        if (!variant) throw new BadRequestException('Variant not found');
        if (dto.unitPrice == null && variant.sellingPrice != null) unitPrice = variant.sellingPrice;
        stockStatus = stockStatusForQty(variant.quantity);
        metadata = {
          ...(metadata ?? {}),
          externalProductId: product.externalId,
          externalVariantId: variant.externalId,
          variantName: variant.name,
        };
      } else {
        const full = await this.productsService.findOne(productId);
        if (dto.unitPrice == null && full.sellingPrice != null) unitPrice = full.sellingPrice;
        stockStatus = stockStatusForQty(full.totalStock);
        metadata = {
          ...(metadata ?? {}),
          externalProductId: product.externalId,
        };
      }
    }

    const discountAmount = dto.discountAmount ?? 0;
    const totalPrice = lineTotal({ quantity: dto.quantity, unitPrice, discountAmount });

    return {
      productId,
      variantId,
      itemName,
      description,
      quantity: dto.quantity,
      unitPrice,
      discountAmount,
      totalPrice,
      warranty: dto.warranty ?? null,
      stockStatus,
      metadata,
    };
  }

  private async recalculateTotals(quoteId: string): Promise<void> {
    const quote = await this.findOne(quoteId);
    const subtotal = quote.items.reduce((sum, i) => sum + i.totalPrice, 0);
    quote.subtotal = subtotal;
    quote.totalAmount = Math.max(
      0,
      subtotal - quote.discountAmount + quote.deliveryFee + quote.taxAmount,
    );
    await this.quoteRepo.save(quote);
  }

  private async nextQuoteNumber(): Promise<string> {
    const stamp = new Date();
    const y = stamp.getFullYear();
    const m = String(stamp.getMonth() + 1).padStart(2, '0');
    const d = String(stamp.getDate()).padStart(2, '0');
    const prefix = `Q-${y}${m}${d}-`;
    const count = await this.quoteRepo
      .createQueryBuilder('q')
      .where('q.quoteNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  private defaultValidUntil(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  private assertEditable(quote: Quote): void {
    if (quote.status === QuoteStatus.CONVERTED_TO_SALE) {
      throw new BadRequestException('Cannot edit a converted quote');
    }
  }

  private assertDiscountAllowed(apiKey: ApiKey, amount: number): void {
    if (amount <= 0) return;
    if (!hasQuotePermission(apiKey, QuotePermission.APPROVE_QUOTE_DISCOUNT)) {
      throw new ForbiddenException('Missing permission to apply discounts');
    }
  }
}
