import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant, VariantType } from './entities/product-variant.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  SendProductMessageDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  BulkPasteInventoryDto,
  GenerateVariantsDto,
} from './dto/product.dto';
import {
  buildProductStockSummaries,
  formatProductWhatsAppMessage,
} from './utils/product-message.format';
import {
  resolveProductInstallmentForAgent,
  resolveVariantInstallment,
} from './utils/product-installment.util';
import {
  resolveProductImageUrls,
  truncateWhatsAppCaption,
} from './utils/product-images.util';
import { MessageService } from '../message/message.service';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import { FollowupHookService } from '../followup/followup-hook.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { ConversationStage } from '../followup/followup.enums';
import { ApiKey } from '../auth/entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ProductDemandService } from '../ai/product-demand.service';
import { InventoryItemService } from './inventory-item.service';
import { ProductHealthService } from './product-health.service';
import { ProductValidationService } from './product-validation.service';
import { ProductAuditService } from './product-audit.service';
import type { InventoryItem } from './entities/inventory-item.entity';

export interface ProductWithStock extends Product {
  totalStock: number;
  variantCount: number;
  inventorySummary?: {
    available: number;
    reserved: number;
    sold: number;
    imeiTrackedVariants: number;
  };
  inventoryItems?: InventoryItem[];
  health?: Awaited<ReturnType<ProductHealthService['checkProduct']>>;
}

/** List rows omit variant payloads; variants load on GET :id only. */
export type ProductListItem = Omit<ProductWithStock, 'variants'>;

export interface CatalogStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: number;
  scaleMax: number;
  currencyHint: string | null;
}

/** Compact catalog rows for the inbox AI agent (stock counts are internal — not for customer text). */
export interface AgentProductSearchRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  sellingPrice: number | null;
  currency: string | null;
  inStock: boolean;
  variants: Array<{
    name: string;
    sellingPrice: number | null;
    inStock: boolean;
    installmentEnabled: boolean;
    installmentMinDeposit: number | null;
    installmentDurationDays: number | null;
    installmentPolicy: string | null;
    installmentRequiresApproval: boolean;
    allowInstallmentWhenOutOfStock: boolean;
  }>;
  installmentEnabled: boolean;
  installmentMinDeposit: number | null;
  installmentDurationDays: number | null;
  installmentPolicy: string | null;
  installmentRequiresApproval: boolean;
  allowInstallmentWhenOutOfStock: boolean;
  relatedAlternatives?: Array<{ name: string; sellingPrice: number | null; currency: string | null }>;
}

const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly inauzwaSyncService: InauzwaSyncService,
    private readonly inauzwaPreferences: InauzwaSyncPreferencesService,
    @Inject(forwardRef(() => FollowupHookService))
    private readonly followupHookService: FollowupHookService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryItemService,
    private readonly healthService: ProductHealthService,
    private readonly validationService: ProductValidationService,
    private readonly productAudit: ProductAuditService,
    @Inject(forwardRef(() => ProductDemandService))
    private readonly productDemand?: ProductDemandService,
  ) {}

  async findNamesByIds(ids: string[]): Promise<Record<string, string>> {
    if (!ids.length) return {};
    const rows = await this.productRepo.find({
      where: { id: In(ids) },
      select: ['id', 'name'],
    });
    return Object.fromEntries(rows.map(row => [row.id, row.name]));
  }

  async list(options?: {
    q?: string;
    inStockOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
    branchId?: string | null;
  }): Promise<ProductListItem[] | { items: ProductListItem[]; total: number; hasMore: boolean }> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .orderBy('p.sortOrder', 'ASC')
      .addOrderBy('p.name', 'ASC');

    if (options?.activeOnly !== false) {
      qb.andWhere('p.isActive = :active', { active: true });
    }

    const q = options?.q?.trim();
    const branchId = options?.branchId?.trim() || null;
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('p.name LIKE :like', { like })
            .orWhere('p.sku LIKE :like', { like })
            .orWhere('p.category LIKE :like', { like })
            .orWhere(
              `EXISTS (
                SELECT 1 FROM crm_product_variants cv
                WHERE cv.productId = p.id
                  AND (
                    cv.name LIKE :like
                    OR cv.sku LIKE :like
                    OR CAST(cv.attributes AS TEXT) LIKE :like
                  )
              )`,
              { like },
            )
            .orWhere(
              `EXISTS (
                SELECT 1 FROM crm_inventory_items ii
                WHERE ii.productId = p.id
                  AND ii.deletedAt IS NULL
                  AND (:branchId IS NULL OR ii.branchId = :branchId)
                  AND (
                    ii.imei LIKE :like
                    OR ii.serialNumber LIKE :like
                    OR ii.barcode LIKE :like
                  )
              )`,
              { like, branchId },
            );
        }),
      );
    }

    const paginate = options?.limit != null && options.limit > 0;
    let total = 0;
    if (paginate) {
      total = await qb.getCount();
      qb.skip(Math.max(0, options.offset ?? 0)).take(options.limit!);
    }

    const products = await qb.getMany();
    if (products.length === 0) {
      return [];
    }

    const productIds = products.map((p) => p.id);
    const variants = await this.variantRepo.find({
      where: { productId: In(productIds) },
    });
    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    let enriched: ProductListItem[] = await Promise.all(
      products.map(async (p) => {
        const withVariants = { ...p, variants: variantsByProduct.get(p.id) ?? [] };
        const full = await this.enrichProduct(withVariants, branchId);
        const { variants: _variants, ...item } = full;
        return item;
      }),
    );

    if (options?.inStockOnly) {
      enriched = enriched.filter((p) => p.totalStock > 0);
    }
    if (paginate) {
      const offset = options.offset ?? 0;
      return {
        items: enriched,
        total,
        hasMore: offset + enriched.length < total,
      };
    }
    return enriched;
  }

  /** Product + variant summary for inbox AI (search_products tool). */
  async searchForAgent(options: {
    q: string;
    inStockOnly?: boolean;
    limit?: number;
    branchId?: string | null;
  }): Promise<AgentProductSearchRow[]> {
    const branchId = options.branchId?.trim() || null;
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 15);
    const includeOutOfStock = options.inStockOnly === false;
    const result = await this.list({
      q: options.q.trim(),
      inStockOnly: !includeOutOfStock,
      activeOnly: true,
      limit,
      offset: 0,
      branchId,
    });
    const items = Array.isArray(result) ? result : result.items;
    if (!items.length) return [];

    const productIds = items.map(p => p.id);
    const variants = await this.variantRepo.find({
      where: { productId: In(productIds), isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const variantsByProduct = new Map<string, ProductVariant[]>();
    const trackedVariantIds: string[] = [];
    for (const v of variants) {
      if (v.variantType === 'imei_child') continue;
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
      if (v.trackInventoryItems || v.isParent || v.variantType === 'parent') {
        trackedVariantIds.push(v.id);
      }
    }

    const stockMap = trackedVariantIds.length
      ? await this.inventoryService.getSummaryForVariants(trackedVariantIds, branchId ?? undefined)
      : new Map<string, { available: number }>();

    const rows = items.map(p => {
      const productVariants = variantsByProduct.get(p.id) ?? [];
      const productInstallment = resolveProductInstallmentForAgent(p, productVariants);
      const variantRows = productVariants.slice(0, 6).map(v => {
        const installment = resolveVariantInstallment(v, p);
        return {
          name: v.name,
          sellingPrice: v.sellingPrice ?? p.sellingPrice,
          inStock: this.isVariantInStock(v, stockMap),
          installmentEnabled: installment.installmentEnabled,
          installmentMinDeposit: installment.installmentMinDeposit,
          installmentDurationDays: installment.installmentDurationDays,
          installmentPolicy: installment.installmentPolicy,
          installmentRequiresApproval: installment.installmentRequiresApproval,
          allowInstallmentWhenOutOfStock: installment.allowInstallmentWhenOutOfStock,
        };
      });
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        sellingPrice: p.sellingPrice,
        currency: p.currency,
        inStock: p.totalStock > 0,
        variants: variantRows,
        installmentEnabled: productInstallment.installmentEnabled,
        installmentMinDeposit: productInstallment.installmentMinDeposit,
        installmentDurationDays: productInstallment.installmentDurationDays,
        installmentPolicy: productInstallment.installmentPolicy,
        installmentRequiresApproval: productInstallment.installmentRequiresApproval,
        allowInstallmentWhenOutOfStock: productInstallment.allowInstallmentWhenOutOfStock,
      };
    });

    const availableRows = rows
      .map(row => {
        const inStockVariants = row.variants.filter(v => v.inStock);
        if (!row.inStock && inStockVariants.length === 0) return null;
        return { ...row, variants: inStockVariants.length ? inStockVariants : row.variants };
      })
      .filter((row): row is AgentProductSearchRow => row !== null);

    if (availableRows.length > 0) return availableRows;

    const broader = await this.list({
      q: options.q.trim().split(/\s+/)[0] ?? options.q.trim(),
      activeOnly: true,
      limit: Math.min(limit + 4, 12),
      offset: 0,
      branchId,
    });
    const broaderItems = (Array.isArray(broader) ? broader : broader.items).filter(
      bp => !items.some(p => p.id === bp.id) && bp.totalStock > 0,
    );
    if (!broaderItems.length) return [];

    const alt = broaderItems.slice(0, 4).map(bp => ({
      name: bp.name,
      sellingPrice: bp.sellingPrice,
      currency: bp.currency,
    }));
    return [
      {
        id: 'exact-match-unavailable',
        name: options.q.trim(),
        sku: null,
        category: null,
        sellingPrice: null,
        currency: null,
        inStock: false,
        variants: [],
        installmentEnabled: false,
        installmentMinDeposit: null,
        installmentDurationDays: null,
        installmentPolicy: null,
        installmentRequiresApproval: false,
        allowInstallmentWhenOutOfStock: false,
        relatedAlternatives: alt,
      },
    ];
  }

  /** Compact in-stock catalog excerpt for inbox AI system prompt (linked local inventory). */
  async buildAgentCatalogContext(options?: {
    limit?: number;
    branchId?: string | null;
  }): Promise<string> {
    const branchId = options?.branchId?.trim() || null;
    const limit = Math.min(Math.max(options?.limit ?? 28, 1), 40);
    const result = await this.list({
      activeOnly: true,
      inStockOnly: true,
      limit,
      offset: 0,
      branchId,
    });
    const items = Array.isArray(result) ? result : result.items;
    if (!items.length) {
      return [
        '=== Shop inventory catalog (local CRM) ===',
        'No in-stock products in the linked inventory yet.',
        'Use search_products after products are synced or added in Products.',
      ].join('\n');
    }

    const lines = [
      '=== Shop inventory catalog (local CRM — linked inventory) ===',
      branchId ? `Branch scope: ${branchId}` : null,
      `In-stock products (${items.length} shown — use search_products for variants, IMEI, and exact prices):`,
    ].filter(Boolean) as string[];
    for (const p of items) {
      const price =
        p.sellingPrice != null
          ? `${p.sellingPrice}${p.currency ? ` ${p.currency}` : ''}`
          : 'price on request';
      const sku = p.sku ? ` · SKU ${p.sku}` : '';
      const cat = p.category ? ` [${p.category}]` : '';
      lines.push(`- ${p.name}${cat}${sku} — ${price}`);
    }
    lines.push(
      'Search tips: product name, SKU, category, variant name, or IMEI/serial via search_products.',
    );
    return lines.join('\n');
  }

  async catalogStats(options?: { activeOnly?: boolean }): Promise<CatalogStats> {
    const listResult = await this.list({ activeOnly: options?.activeOnly !== false });
    const items = Array.isArray(listResult) ? listResult : listResult.items;
    const scaleMax = Math.max(
      LOW_STOCK_THRESHOLD,
      ...items.map((p) => p.totalStock),
      1,
    );
    const currencies = new Set(
      items.map((p) => p.currency?.trim()).filter((c): c is string => !!c),
    );
    const inventoryValue = items.reduce((sum, p) => {
      const unit = p.sellingPrice ?? 0;
      return sum + unit * p.totalStock;
    }, 0);

    return {
      total: items.length,
      lowStock: items.filter(
        (p) => p.totalStock > 0 && p.totalStock < LOW_STOCK_THRESHOLD,
      ).length,
      outOfStock: items.filter((p) => p.totalStock === 0).length,
      inventoryValue,
      scaleMax,
      currencyHint: currencies.size === 1 ? [...currencies][0] : null,
    };
  }

  async findOne(id: string): Promise<ProductWithStock> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return this.enrichProduct(product);
  }

  async create(dto: CreateProductDto): Promise<ProductWithStock> {
    await this.validationService.assertUniqueProductSku(dto.sku);
    const product = this.productRepo.create({
      name: dto.name.trim(),
      description: dto.description ?? null,
      sku: dto.sku ?? null,
      category: dto.category ?? null,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      barcode: dto.barcode ?? null,
      tags: dto.tags ?? null,
      warrantyDefault: dto.warrantyDefault ?? null,
      supplier: dto.supplier ?? null,
      visibility: dto.visibility ?? 'public',
      costPrice: dto.costPrice ?? null,
      imageUrl: dto.imageUrl ?? null,
      currency: dto.currency ?? null,
      sellingPrice: dto.sellingPrice ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      ...this.installmentPatch(dto),
    });
    const saved = await this.productRepo.save(product);
    if (this.productDemand) {
      await this.productDemand.fulfillMatchingCatalogRequests(saved.id, saved.name);
    }
    await this.productAudit.log({ productId: saved.id, action: 'product_created' });
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductWithStock> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    if (dto.sku !== undefined) {
      await this.validationService.assertUniqueProductSku(dto.sku, id);
    }
    Object.assign(product, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
      ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      ...(dto.warrantyDefault !== undefined ? { warrantyDefault: dto.warrantyDefault } : {}),
      ...(dto.supplier !== undefined ? { supplier: dto.supplier } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...this.installmentPatch(dto),
    });
    await this.productRepo.save(product);
    await this.productAudit.log({ productId: id, action: 'product_updated' });
    return this.findOne(id);
  }

  async remove(id: string, force = false): Promise<void> {
    if (!force) {
      await this.validationService.assertCanHardDeleteProduct(id);
    }
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    if (!force) {
      product.isActive = false;
      await this.productRepo.save(product);
      await this.productAudit.log({ productId: id, action: 'product_deactivated' });
      return;
    }
    const result = await this.productRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  async addVariant(productId: string, dto: CreateVariantDto): Promise<ProductWithStock> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    this.validationService.rejectImeiChildVariantCreate(dto.variantType);
    await this.validationService.assertUniqueVariantSku(dto.sku);

    let variantType = dto.variantType ?? 'standard';
    let trackInventoryItems = dto.trackInventoryItems ?? false;
    let isParent = dto.isParent ?? false;

    if (trackInventoryItems) {
      variantType = 'standard';
      isParent = false;
    } else if (variantType === 'parent') {
      trackInventoryItems = true;
      isParent = true;
    }

    if (dto.parentVariantId) {
      const parent = await this.variantRepo.findOne({
        where: { id: dto.parentVariantId, productId },
      });
      if (!parent) {
        throw new BadRequestException('Parent variant not found for this product');
      }
    }

    const variant = this.variantRepo.create({
      productId,
      name: dto.name.trim(),
      sku: dto.sku ?? null,
      barcode: dto.barcode ?? null,
      costPrice: dto.costPrice ?? null,
      sellingPrice: dto.sellingPrice ?? null,
      quantity: trackInventoryItems ? 0 : (dto.quantity ?? 0),
      variantType: variantType as VariantType,
      isParent,
      trackInventoryItems,
      lowStockThreshold: dto.lowStockThreshold ?? 10,
      parentVariantId: dto.parentVariantId ?? null,
      attributes: dto.attributes ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.variantRepo.save(variant);
    await this.productAudit.log({
      productId,
      variantId: variant.id,
      action: 'variant_created',
    });
    return this.findOne(productId);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductWithStock> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }

    this.validationService.assertQuantityEditAllowed(variant, dto.quantity);
    if (dto.sku !== undefined) {
      await this.validationService.assertUniqueVariantSku(dto.sku, variantId);
    }

    if (dto.parentVariantId !== undefined && dto.parentVariantId) {
      const parent = await this.variantRepo.findOne({
        where: { id: dto.parentVariantId, productId },
      });
      if (!parent) {
        throw new BadRequestException('Parent variant not found for this product');
      }
    }

    Object.assign(variant, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
      ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
      ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.trackInventoryItems !== undefined
        ? { trackInventoryItems: dto.trackInventoryItems }
        : {}),
      ...(dto.lowStockThreshold !== undefined
        ? { lowStockThreshold: dto.lowStockThreshold }
        : {}),
      ...(dto.variantType !== undefined ? { variantType: dto.variantType } : {}),
      ...(dto.isParent !== undefined ? { isParent: dto.isParent } : {}),
      ...(dto.parentVariantId !== undefined ? { parentVariantId: dto.parentVariantId } : {}),
      ...(dto.attributes !== undefined ? { attributes: dto.attributes } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...this.installmentPatch(dto),
    });

    if (variant.trackInventoryItems) {
      variant.variantType = 'standard';
      variant.isParent = false;
      variant.quantity = await this.inventoryService.countAvailable(variant.id);
    } else if (variant.variantType === 'parent' || variant.isParent) {
      variant.isParent = true;
      variant.variantType = 'parent';
      variant.trackInventoryItems = true;
    }

    await this.variantRepo.save(variant);
    await this.productAudit.log({ productId, variantId, action: 'variant_updated' });
    return this.findOne(productId);
  }

  async removeVariant(productId: string, variantId: string, force = false): Promise<ProductWithStock> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    if (!force) {
      await this.validationService.assertCanDeleteVariant(productId, variantId);
      variant.isActive = false;
      await this.variantRepo.save(variant);
      await this.productAudit.log({ productId, variantId, action: 'variant_deactivated' });
      return this.findOne(productId);
    }
    await this.variantRepo.delete({ productId, parentVariantId: variantId });
    await this.variantRepo.delete({ id: variantId, productId });
    return this.findOne(productId);
  }

  async getHealthSummary() {
    return this.healthService.getSummary();
  }

  async getProductHealth(productId: string) {
    return this.healthService.checkProduct(productId);
  }

  async listInventoryItems(
    productId: string,
    filters?: { variantId?: string; branchId?: string; status?: string; q?: string },
  ) {
    return this.inventoryService.listForProduct(productId, filters as never);
  }

  async createInventoryItem(productId: string, dto: CreateInventoryItemDto) {
    const item = await this.inventoryService.createItem({
      productId,
      variantId: dto.variantId,
      branchId: dto.branchId,
      imei: dto.imei,
      serialNumber: dto.serialNumber,
      deviceId: dto.deviceId,
      barcode: dto.barcode,
      status: dto.status,
      costPrice: dto.costPrice,
      sellingPrice: dto.sellingPrice,
      supplier: dto.supplier,
      purchaseBatch: dto.purchaseBatch,
      notes: dto.notes,
    });
    await this.productAudit.log({
      productId,
      variantId: dto.variantId,
      inventoryItemId: item.id,
      action: 'inventory_item_created',
    });
    return this.findOne(productId);
  }

  async updateInventoryItem(productId: string, itemId: string, dto: UpdateInventoryItemDto) {
    await this.inventoryService.updateItem(itemId, productId, dto);
    await this.productAudit.log({
      productId,
      inventoryItemId: itemId,
      action: 'inventory_item_updated',
      metadata: { status: dto.status },
    });
    return this.findOne(productId);
  }

  async deleteInventoryItem(productId: string, itemId: string) {
    await this.inventoryService.softDeleteItem(itemId, productId);
    await this.productAudit.log({
      productId,
      inventoryItemId: itemId,
      action: 'inventory_item_deactivated',
    });
    return this.findOne(productId);
  }

  async bulkPasteInventory(productId: string, dto: BulkPasteInventoryDto) {
    if (dto.dryRun) {
      return {
        preview: this.inventoryService.parseBulkPaste(dto.text, dto.branchId),
        created: 0,
        skipped: 0,
      };
    }
    const result = await this.inventoryService.bulkCreateFromPaste(
      productId,
      dto.variantId,
      dto.text,
      dto.branchId,
    );
    await this.productAudit.log({
      productId,
      variantId: dto.variantId,
      action: 'inventory_bulk_paste',
      metadata: { created: result.created },
    });
    return result;
  }

  async generateVariants(productId: string, dto: GenerateVariantsDto) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const storage = dto.storageOptions?.length ? dto.storageOptions : [''];
    const colors = dto.colorOptions?.length ? dto.colorOptions : [''];
    const rams = dto.ramOptions?.length ? dto.ramOptions : [''];
    const conditions = dto.conditionOptions?.length ? dto.conditionOptions : [''];
    const grades = dto.gradeOptions?.length ? dto.gradeOptions : [''];

    const created: string[] = [];
    const skuBase = product.sku?.trim() || product.name.replace(/\s+/g, '-').toUpperCase().slice(0, 12);

    for (const st of storage) {
      for (const co of colors) {
        for (const ra of rams) {
          for (const cond of conditions) {
            for (const gr of grades) {
              const parts = [st, co, ra, cond, gr].filter(Boolean);
              const name = parts.join(' / ') || 'Variant';
              const skuPattern = dto.skuPattern ?? '{PRODUCT_SKU}-{STORAGE}-{COLOR}-{CONDITION}';
              const sku = skuPattern
                .replace('{PRODUCT_SKU}', skuBase)
                .replace('{STORAGE}', st || 'STD')
                .replace('{COLOR}', co || 'NA')
                .replace('{RAM}', ra || 'NA')
                .replace('{CONDITION}', cond || 'NA')
                .replace('{GRADE}', gr || 'NA');

              const existing = await this.variantRepo.findOne({
                where: { productId, sku },
              });
              if (existing) continue;

              const variant = this.variantRepo.create({
                productId,
                name,
                sku,
                sellingPrice: dto.basePrice ?? product.sellingPrice,
                attributes: {
                  ...(st ? { storage: st } : {}),
                  ...(co ? { color: co } : {}),
                  ...(ra ? { ram: ra } : {}),
                  ...(cond ? { condition: cond } : {}),
                  ...(gr ? { grade: gr } : {}),
                },
                variantType: 'standard',
                isActive: true,
              });
              await this.variantRepo.save(variant);
              created.push(name);
            }
          }
        }
      }
    }

    await this.productAudit.log({
      productId,
      action: 'variants_generated',
      metadata: { count: created.length },
    });
    return { created, count: created.length };
  }

  async getProductHistory(productId: string) {
    return this.productAudit.listForProduct(productId);
  }

  async previewMessage(
    productId: string,
    options?: Omit<SendProductMessageDto, 'sessionId' | 'chatId'>,
  ): Promise<{ text: string }> {
    const product = await this.findOne(productId);
    const inventoryItems = await this.inventoryService.listForProduct(productId);
    const itemsByVariant = new Map<string, typeof inventoryItems>();
    for (const item of inventoryItems) {
      const list = itemsByVariant.get(item.variantId) ?? [];
      list.push(item);
      itemsByVariant.set(item.variantId, list);
    }
    const summaries = buildProductStockSummaries(product.variants ?? [], itemsByVariant);
    const text = formatProductWhatsAppMessage(product, summaries, {
      variantId: options?.variantId,
      includeAllVariants: options?.includeAllVariants,
      includeAvailableDevices: options?.includeAvailableDevices,
      inStockOnly: options?.inStockOnly,
      includeStockLabels: true,
    });
    return { text };
  }

  async sendToChat(productId: string, dto: SendProductMessageDto, apiKey: ApiKey) {
    await this.messageService.assertInboxSendAllowed(apiKey, dto.sessionId, dto.chatId);

    const product = await this.findOne(productId);
    const summaries = buildProductStockSummaries(product.variants ?? []);
    const inStockOnly = dto.inStockOnly ?? true;
    const includeAllVariants = dto.includeAllVariants ?? true;
    const topLevelCount = summaries.length;

    if (dto.variantId) {
      const variantRow = summaries.find((s) => s.variant.id === dto.variantId);
      if (!variantRow) {
        throw new BadRequestException(
          `Variant ${dto.variantId} not found or is not active for this product`,
        );
      }
      if (inStockOnly && variantRow.available <= 0) {
        throw new BadRequestException(
          'Selected variant has no stock. Turn off "In stock only" or choose another variant.',
        );
      }
    } else if (topLevelCount > 0 && includeAllVariants === false) {
      const inStockRows = inStockOnly ? summaries.filter((s) => s.available > 0) : summaries;
      if (inStockRows.length === 0) {
        throw new BadRequestException(
          inStockOnly
            ? 'No active variants with stock for this product. Turn off "In stock only" or pick a variant.'
            : 'No active variants for this product.',
        );
      }
    }

    const shouldRefresh = await this.inauzwaPreferences.shouldRefreshBeforeSend(dto.refreshStock);
    if (shouldRefresh && (await this.inauzwaSyncService.canQuickSync())) {
      try {
        await this.inauzwaSyncService.quickSync();
        const refreshed = await this.findOne(productId);
        Object.assign(product, refreshed);
      } catch {
        // Best-effort stock refresh; continue with cached product data.
      }
    }

    const refreshedSummaries = buildProductStockSummaries(
      product.variants ?? [],
      await (async () => {
        const items = await this.inventoryService.listForProduct(productId);
        const map = new Map<string, typeof items>();
        for (const item of items) {
          const list = map.get(item.variantId) ?? [];
          list.push(item);
          map.set(item.variantId, list);
        }
        return map;
      })(),
    );
    const text = formatProductWhatsAppMessage(product, refreshedSummaries, {
      variantId: dto.variantId,
      includeAllVariants,
      includeAvailableDevices: dto.includeAvailableDevices ?? false,
      inStockOnly,
      customerFacing: true,
    });

    if (!text.trim()) {
      throw new BadRequestException(
        inStockOnly
          ? 'Nothing to send for this product with in-stock filter enabled. Turn off "In stock only" or choose a variant that has stock.'
          : 'Nothing to send for this product',
      );
    }

    const imageUrls = dto.includeImage ? resolveProductImageUrls(product) : [];
    const caption = truncateWhatsAppCaption(text);
    const actorStaffId = apiKey.id;

    const productSendOpts = {
      actorStaffId,
      source: 'product_send',
    };

    let result;
    if (imageUrls.length > 0) {
      try {
        if (imageUrls.length === 1) {
          result = await this.messageService.sendImage(
            dto.sessionId,
            {
              chatId: dto.chatId,
              url: imageUrls[0],
              caption,
            },
            productSendOpts,
          );
        } else {
          result = await this.messageService.sendImageAlbum(
            dto.sessionId,
            {
              chatId: dto.chatId,
              urls: imageUrls,
              caption,
            },
            productSendOpts,
          );
        }
      } catch {
        result = await this.messageService.sendText(
          dto.sessionId,
          { chatId: dto.chatId, text },
          productSendOpts,
        );
      }
    } else {
      result = await this.messageService.sendText(
        dto.sessionId,
        { chatId: dto.chatId, text },
        productSendOpts,
      );
    }

    void this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      apiKey,
      sessionId: dto.sessionId,
      metadata: {
        source: 'product-send',
        productId: product.id,
        variantId: dto.variantId ?? null,
        includeImage: dto.includeImage ?? false,
        chatId: dto.chatId,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      },
    });

    if (actorStaffId) {
      try {
        await this.followupConversationService.recordStaffMessage(
          dto.sessionId,
          dto.chatId,
          actorStaffId,
        );
      } catch {
        /* best-effort */
      }
    }

    try {
      const totalStock = refreshedSummaries.reduce((s, x) => s + x.available, 0);
      const stage =
        totalStock === 0 ? ConversationStage.PRODUCT_SUGGESTED : ConversationStage.PRICE_SENT;
      const conv = await this.followupConversationService.getOrCreate(dto.sessionId, dto.chatId);
      await this.followupConversationService.update(conv.id, {
        productInterest: product.name,
        productId: product.id,
        stage,
      });
      await this.followupHookService.handleStageChange(dto.sessionId, dto.chatId, stage);
    } catch {
      // follow-up stage update is best-effort
    }

    return result;
  }

  private installmentPatch(
    dto: CreateProductDto | UpdateProductDto | UpdateVariantDto,
  ): Partial<Product | ProductVariant> {
    const patch: Partial<Product> = {};
    if (dto.installmentEnabled !== undefined) patch.installmentEnabled = dto.installmentEnabled;
    if (dto.installmentMinDeposit !== undefined) patch.installmentMinDeposit = dto.installmentMinDeposit;
    if (dto.installmentDurationDays !== undefined) {
      patch.installmentDurationDays = dto.installmentDurationDays;
    }
    if (dto.installmentScheduleType !== undefined) {
      patch.installmentScheduleType = dto.installmentScheduleType;
    }
    if (dto.installmentPolicy !== undefined) patch.installmentPolicy = dto.installmentPolicy;
    if (dto.installmentPenaltyPolicy !== undefined) {
      patch.installmentPenaltyPolicy = dto.installmentPenaltyPolicy;
    }
    if (dto.installmentExpiryDays !== undefined) patch.installmentExpiryDays = dto.installmentExpiryDays;
    if (dto.installmentRequiresApproval !== undefined) {
      patch.installmentRequiresApproval = dto.installmentRequiresApproval;
    }
    if (dto.allowInstallmentWhenOutOfStock !== undefined) {
      patch.allowInstallmentWhenOutOfStock = dto.allowInstallmentWhenOutOfStock;
    }
    if (dto.stockingReminderEnabled !== undefined) {
      patch.stockingReminderEnabled = dto.stockingReminderEnabled;
    }
    if (dto.installmentNotes !== undefined) patch.installmentNotes = dto.installmentNotes;
    return patch;
  }

  private isVariantInStock(
    variant: ProductVariant,
    stockMap: Map<string, { available: number }>,
  ): boolean {
    if (variant.trackInventoryItems || variant.isParent || variant.variantType === 'parent') {
      return (stockMap.get(variant.id)?.available ?? 0) > 0;
    }
    return variant.quantity > 0;
  }

  private async enrichProduct(
    product: Product,
    branchId?: string | null,
  ): Promise<ProductWithStock> {
    const scopedBranchId = branchId?.trim() || null;
    const variants = product.variants ?? [];
    const sellable = variants.filter(
      (v) => !v.parentVariantId && v.variantType !== 'imei_child',
    );

    const trackedIds = sellable
      .filter((v) => v.trackInventoryItems || v.isParent || v.variantType === 'parent')
      .map((v) => v.id);

    const inventoryItems = await this.inventoryService.listForProduct(product.id, {
      branchId: scopedBranchId ?? undefined,
    });
    const itemsByVariant = new Map<string, typeof inventoryItems>();
    for (const item of inventoryItems) {
      const list = itemsByVariant.get(item.variantId) ?? [];
      list.push(item);
      itemsByVariant.set(item.variantId, list);
    }

    if (trackedIds.length) {
      const summaries = await this.inventoryService.getSummaryForVariants(
        trackedIds,
        scopedBranchId ?? undefined,
      );
      for (const v of sellable) {
        if (trackedIds.includes(v.id)) {
          v.quantity = summaries.get(v.id)?.available ?? 0;
        }
      }
    }

    const stockSummaries = buildProductStockSummaries(variants, itemsByVariant);
    const totalStock = stockSummaries.reduce((sum, s) => sum + s.available, 0);

    let inventorySummary = {
      available: 0,
      reserved: 0,
      sold: 0,
      imeiTrackedVariants: trackedIds.length,
    };
    if (trackedIds.length) {
      const stockMap = await this.inventoryService.getSummaryForVariants(
        trackedIds,
        scopedBranchId ?? undefined,
      );
      for (const id of trackedIds) {
        const s = stockMap.get(id);
        if (s) {
          inventorySummary.available += s.available;
          inventorySummary.reserved += s.reserved;
          inventorySummary.sold += s.sold;
        }
      }
    }

    const health = await this.healthService.checkProduct(product.id, product);

    return {
      ...product,
      variants,
      totalStock,
      variantCount: sellable.length,
      inventorySummary,
      health,
    };
  }
}
