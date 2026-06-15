import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryItemService } from './inventory-item.service';

export type ProductHealthIssue =
  | 'missing_image'
  | 'missing_price'
  | 'missing_category'
  | 'missing_sku'
  | 'duplicate_sku'
  | 'invalid_image'
  | 'no_variants'
  | 'variant_missing_price'
  | 'variant_missing_stock'
  | 'imei_zero_available'
  | 'duplicate_imei'
  | 'low_stock'
  | 'out_of_stock'
  | 'installment_invalid'
  | 'inactive_with_active_variants';

export interface ProductHealthResult {
  productId: string;
  score: number;
  issues: ProductHealthIssue[];
  warnings: string[];
}

export interface ProductHealthSummary {
  totalProducts: number;
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  missingImages: number;
  importIssues: number;
  duplicateSkus: number;
  duplicateImeis: number;
  installmentMisconfigured: number;
}

const LOW_STOCK_DEFAULT = 10;

@Injectable()
export class ProductHealthService {
  constructor(
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(InventoryItem, 'data')
    private readonly itemRepo: Repository<InventoryItem>,
    private readonly inventoryService: InventoryItemService,
  ) {}

  async getSummary(): Promise<ProductHealthSummary> {
    const products = await this.productRepo.find();
    const active = products.filter((p) => p.isActive);
    let lowStock = 0;
    let outOfStock = 0;
    let missingImages = 0;
    let installmentMisconfigured = 0;

    for (const p of products) {
      const health = await this.checkProduct(p.id, p);
      if (health.issues.includes('low_stock')) lowStock += 1;
      if (health.issues.includes('out_of_stock')) outOfStock += 1;
      if (health.issues.includes('missing_image')) missingImages += 1;
      if (health.issues.includes('installment_invalid')) installmentMisconfigured += 1;
    }

    const skuCounts = new Map<string, number>();
    for (const p of products) {
      if (p.sku?.trim()) {
        const k = p.sku.trim().toLowerCase();
        skuCounts.set(k, (skuCounts.get(k) ?? 0) + 1);
      }
    }
    const duplicateSkus = [...skuCounts.values()].filter((c) => c > 1).length;

    const imeiRows = await this.itemRepo
      .createQueryBuilder('i')
      .select('i.imei', 'imei')
      .addSelect('i.branchId', 'branchId')
      .where('i.imei IS NOT NULL')
      .andWhere('i.deletedAt IS NULL')
      .getRawMany();
    const imeiMap = new Map<string, number>();
    for (const r of imeiRows) {
      const key = `${r.branchId}:${r.imei}`;
      imeiMap.set(key, (imeiMap.get(key) ?? 0) + 1);
    }
    const duplicateImeis = [...imeiMap.values()].filter((c) => c > 1).length;

    return {
      totalProducts: products.length,
      activeProducts: active.length,
      lowStock,
      outOfStock,
      missingImages,
      importIssues: 0,
      duplicateSkus,
      duplicateImeis,
      installmentMisconfigured,
    };
  }

  async checkProduct(productId: string, productRow?: Product): Promise<ProductHealthResult> {
    const product =
      productRow ??
      (await this.productRepo.findOne({ where: { id: productId }, relations: ['variants'] }));
    if (!product) {
      return { productId, score: 0, issues: [], warnings: ['Product not found'] };
    }

    const variants = product.variants ?? (await this.variantRepo.find({ where: { productId } }));
    const sellable = variants.filter(
      (v) => !v.parentVariantId && v.variantType !== 'imei_child' && v.isActive,
    );

    const issues: ProductHealthIssue[] = [];
    const warnings: string[] = [];

    if (!product.imageUrl?.trim() && !(product.imageUrls?.length)) {
      issues.push('missing_image');
    }
    if (product.sellingPrice == null && sellable.every((v) => v.sellingPrice == null)) {
      issues.push('missing_price');
    }
    if (!product.category?.trim()) issues.push('missing_category');
    if (!product.sku?.trim()) issues.push('missing_sku');

    if (product.installmentEnabled) {
      if (
        product.installmentMinDeposit == null ||
        product.installmentDurationDays == null ||
        product.installmentDurationDays <= 0
      ) {
        issues.push('installment_invalid');
        warnings.push('Installment enabled but deposit or duration is missing');
      }
    }

    let totalStock = 0;
    for (const v of sellable) {
      if (v.sellingPrice == null && product.sellingPrice == null) {
        issues.push('variant_missing_price');
      }
      const tracked = v.trackInventoryItems || v.isParent || v.variantType === 'parent';
      let available = v.quantity ?? 0;
      if (tracked) {
        available = await this.inventoryService.countAvailable(v.id);
        if (available === 0) {
          issues.push('imei_zero_available');
        }
      }
      totalStock += available;
      const threshold = v.lowStockThreshold ?? LOW_STOCK_DEFAULT;
      if (available > 0 && available < threshold) issues.push('low_stock');
      if (available === 0) issues.push('variant_missing_stock');
    }

    if (totalStock === 0 && sellable.length > 0) issues.push('out_of_stock');
    if (!product.isActive && sellable.some((v) => v.isActive)) {
      issues.push('inactive_with_active_variants');
    }

    const uniqueIssues = [...new Set(issues)];
    const score = Math.max(0, 100 - uniqueIssues.length * 8);
    return { productId, score, issues: uniqueIssues, warnings };
  }

  async checkDuplicateSkus(excludeProductId?: string): Promise<string[]> {
    const products = await this.productRepo.find();
    const map = new Map<string, string[]>();
    for (const p of products) {
      if (p.sku?.trim()) {
        const k = p.sku.trim().toLowerCase();
        const list = map.get(k) ?? [];
        list.push(p.id);
        map.set(k, list);
      }
    }
    const dupes: string[] = [];
    for (const [, ids] of map) {
      if (ids.length > 1 && (!excludeProductId || ids.includes(excludeProductId))) {
        dupes.push(...ids);
      }
    }
    return [...new Set(dupes)];
  }
}
