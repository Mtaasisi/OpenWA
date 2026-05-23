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
} from './dto/product.dto';
import {
  buildProductStockSummaries,
  formatProductWhatsAppMessage,
} from './utils/product-message.format';
import { MessageService } from '../message/message.service';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';

export interface ProductWithStock extends Product {
  totalStock: number;
  variantCount: number;
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
  ) {}

  async list(options?: {
    q?: string;
    inStockOnly?: boolean;
    activeOnly?: boolean;
  }): Promise<ProductListItem[]> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .orderBy('p.sortOrder', 'ASC')
      .addOrderBy('p.name', 'ASC');

    if (options?.activeOnly !== false) {
      qb.andWhere('p.isActive = :active', { active: true });
    }

    const q = options?.q?.trim();
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
            );
        }),
      );
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

    let enriched = products.map((p) => {
      const withVariants = { ...p, variants: variantsByProduct.get(p.id) ?? [] };
      const full = this.enrichProduct(withVariants);
      const { variants: _variants, ...item } = full;
      return item;
    });

    if (options?.inStockOnly) {
      enriched = enriched.filter((p) => p.totalStock > 0);
    }
    return enriched;
  }

  async catalogStats(options?: { activeOnly?: boolean }): Promise<CatalogStats> {
    const items = await this.list({ activeOnly: options?.activeOnly !== false });
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
    const product = this.productRepo.create({
      name: dto.name.trim(),
      description: dto.description ?? null,
      sku: dto.sku ?? null,
      category: dto.category ?? null,
      imageUrl: dto.imageUrl ?? null,
      currency: dto.currency ?? null,
      sellingPrice: dto.sellingPrice ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.productRepo.save(product);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductWithStock> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    Object.assign(product, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });
    await this.productRepo.save(product);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
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

    const variantType = dto.variantType ?? 'standard';
    const isParent = dto.isParent ?? variantType === 'parent';

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
      sellingPrice: dto.sellingPrice ?? null,
      quantity: dto.quantity ?? (variantType === 'imei_child' ? 1 : 0),
      variantType: variantType as VariantType,
      isParent,
      parentVariantId: dto.parentVariantId ?? null,
      attributes: dto.attributes ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.variantRepo.save(variant);
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
      ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.variantType !== undefined ? { variantType: dto.variantType } : {}),
      ...(dto.isParent !== undefined ? { isParent: dto.isParent } : {}),
      ...(dto.parentVariantId !== undefined ? { parentVariantId: dto.parentVariantId } : {}),
      ...(dto.attributes !== undefined ? { attributes: dto.attributes } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    if (variant.variantType === 'parent' || variant.isParent) {
      variant.isParent = true;
      variant.variantType = 'parent';
    }

    await this.variantRepo.save(variant);
    return this.findOne(productId);
  }

  async removeVariant(productId: string, variantId: string): Promise<ProductWithStock> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId, productId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    await this.variantRepo.delete({ productId, parentVariantId: variantId });
    await this.variantRepo.delete({ id: variantId, productId });
    return this.findOne(productId);
  }

  async previewMessage(
    productId: string,
    options?: Omit<SendProductMessageDto, 'sessionId' | 'chatId'>,
  ): Promise<{ text: string }> {
    const product = await this.findOne(productId);
    const summaries = buildProductStockSummaries(product.variants ?? []);
    const text = formatProductWhatsAppMessage(product, summaries, {
      variantId: options?.variantId,
      includeAllVariants: options?.includeAllVariants,
      includeAvailableDevices: options?.includeAvailableDevices,
      inStockOnly: options?.inStockOnly,
    });
    return { text };
  }

  async sendToChat(productId: string, dto: SendProductMessageDto) {
    const shouldRefresh = await this.inauzwaPreferences.shouldRefreshBeforeSend(dto.refreshStock);
    if (shouldRefresh && (await this.inauzwaSyncService.isConfigured())) {
      await this.inauzwaSyncService.quickSync();
    }

    const product = await this.findOne(productId);
    const summaries = buildProductStockSummaries(product.variants ?? []);
    const text = formatProductWhatsAppMessage(product, summaries, {
      variantId: dto.variantId,
      includeAllVariants: dto.includeAllVariants ?? true,
      includeAvailableDevices: dto.includeAvailableDevices ?? false,
      inStockOnly: dto.inStockOnly ?? true,
    });

    if (!text.trim()) {
      throw new BadRequestException('Nothing to send for this product');
    }

    const textResult = await this.messageService.sendText(dto.sessionId, {
      chatId: dto.chatId,
      text,
    });

    if (dto.includeImage && product.imageUrl?.trim()) {
      await this.messageService.sendImage(dto.sessionId, {
        chatId: dto.chatId,
        url: product.imageUrl.trim(),
        caption: product.name,
      });
    }

    return textResult;
  }

  private enrichProduct(product: Product): ProductWithStock {
    const variants = product.variants ?? [];
    const summaries = buildProductStockSummaries(variants);
    const totalStock = summaries.reduce((sum, s) => sum + s.available, 0);
    const topLevel = variants.filter(
      (v) => !v.parentVariantId && v.variantType !== 'imei_child',
    );
    return {
      ...product,
      variants,
      totalStock,
      variantCount: topLevel.length,
    };
  }
}
