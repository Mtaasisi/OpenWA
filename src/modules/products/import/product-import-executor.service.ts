import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryItemService } from '../inventory-item.service';
import { ProductAuditService } from '../product-audit.service';
import { ProductValidationService } from '../product-validation.service';
import type { ValidatedImportRow } from './product-import-validation.service';
import { ProductImportRow } from '../entities/product-import-row.entity';
import { ProductImportBatch } from '../entities/product-import-batch.entity';

type ImportRowMeta = {
  created: { product: boolean; variant: boolean; inventoryItem: boolean };
  previous: { product?: Record<string, unknown>; variant?: Record<string, unknown> };
};

@Injectable()
export class ProductImportExecutorService {
  constructor(
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(ProductImportBatch, 'data')
    private readonly batchRepo: Repository<ProductImportBatch>,
    @InjectRepository(ProductImportRow, 'data')
    private readonly rowRepo: Repository<ProductImportRow>,
    private readonly inventoryService: InventoryItemService,
    private readonly validation: ProductValidationService,
    private readonly audit: ProductAuditService,
  ) {}

  async execute(
    batch: ProductImportBatch,
    rows: ValidatedImportRow[],
    dryRun: boolean,
  ): Promise<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      if (row.status === 'error') {
        skippedCount += 1;
        await this.saveImportRow(batch.id, row, 'skip');
        continue;
      }

      if (dryRun) {
        await this.saveImportRow(batch.id, row, 'dry_run');
        continue;
      }

      try {
        const meta: ImportRowMeta = { created: { product: false, variant: false, inventoryItem: false }, previous: {} };
        let targetProductId: string | null = null;
        let targetVariantId: string | null = null;
        let targetInventoryItemId: string | null = null;
        let rowAction: 'create' | 'update' = 'update';

        const m = row.mapped;
        const name = String(m.name ?? m.productName ?? '').trim();
        let product = await this.findProduct(m);

        if (!product && name) {
          await this.validation.assertUniqueProductSku(String(m.sku ?? ''));
          product = this.productRepo.create({
            name,
            sku: String(m.sku ?? '').trim() || null,
            category: String(m.category ?? '').trim() || null,
            brand: String(m.brand ?? '').trim() || null,
            model: String(m.model ?? '').trim() || null,
            description: String(m.description ?? '').trim() || null,
            sellingPrice: this.num(m.sellingPrice ?? m.price),
            costPrice: this.num(m.costPrice ?? m.cost),
            barcode: String(m.barcode ?? '').trim() || null,
            isActive: true,
          });
          product = await this.productRepo.save(product);
          meta.created.product = true;
          rowAction = 'create';
          createdCount += 1;
          await this.audit.log({ productId: product.id, action: 'import_product_created' });
        } else if (product && batch.mode !== 'create_only') {
          meta.previous.product = this.snapshotProduct(product);
          Object.assign(product, {
            ...(name ? { name } : {}),
            ...(m.sku ? { sku: String(m.sku) } : {}),
            ...(m.category ? { category: String(m.category) } : {}),
            ...(m.sellingPrice != null ? { sellingPrice: this.num(m.sellingPrice) } : {}),
          });
          await this.productRepo.save(product);
          updatedCount += 1;
        }

        if (product) {
          targetProductId = product.id;

          if (String(m.variantName ?? '').trim()) {
            const variantName = String(m.variantName).trim();
            let variant = await this.variantRepo.findOne({
              where: { productId: product.id, name: variantName },
            });
            if (!variant) {
              variant = this.variantRepo.create({
                productId: product.id,
                name: variantName,
                sku: String(m.variantSku ?? '').trim() || null,
                sellingPrice: this.num(m.sellingPrice ?? m.price),
                costPrice: this.num(m.costPrice ?? m.cost),
                quantity: this.num(m.stockQuantity ?? m.stock) ?? 0,
                attributes: this.buildAttrs(m),
                isActive: true,
                variantType: 'standard',
              });
              variant = await this.variantRepo.save(variant);
              meta.created.variant = true;
              if (rowAction !== 'create') rowAction = 'create';
              createdCount += 1;
            } else if (batch.mode !== 'create_only') {
              meta.previous.variant = this.snapshotVariant(variant);
              if (m.stockQuantity != null) variant.quantity = this.num(m.stockQuantity) ?? variant.quantity;
              if (m.sellingPrice != null) variant.sellingPrice = this.num(m.sellingPrice);
              await this.variantRepo.save(variant);
              updatedCount += 1;
            }

            if (variant) {
              targetVariantId = variant.id;

              const imei = String(m.imei ?? '').trim();
              const serial = String(m.serialNumber ?? m.serial ?? '').trim();
              if (imei || serial) {
                if (!variant.trackInventoryItems) {
                  variant.trackInventoryItems = true;
                  await this.variantRepo.save(variant);
                }
                const item = await this.inventoryService.createItem({
                  productId: product.id,
                  variantId: variant.id,
                  branchId: String(m.branch ?? batch.branchId ?? ''),
                  imei: imei || null,
                  serialNumber: serial || null,
                  costPrice: this.num(m.costPrice),
                  sellingPrice: this.num(m.sellingPrice),
                });
                targetInventoryItemId = item.id;
                meta.created.inventoryItem = true;
                if (rowAction !== 'create') rowAction = 'create';
                createdCount += 1;
              }
            }
          }
        }

        await this.saveImportRow(batch.id, row, rowAction, {
          targetProductId,
          targetVariantId,
          targetInventoryItemId,
          previousValues: { ...meta.previous, created: meta.created },
        });
      } catch (err) {
        skippedCount += 1;
        row.errors.push(err instanceof Error ? err.message : String(err));
        await this.saveImportRow(batch.id, row, 'error');
      }
    }

    return { createdCount, updatedCount, skippedCount };
  }

  private snapshotProduct(product: Product): Record<string, unknown> {
    return {
      name: product.name,
      sku: product.sku,
      category: product.category,
      brand: product.brand,
      model: product.model,
      description: product.description,
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice,
      barcode: product.barcode,
    };
  }

  private snapshotVariant(variant: ProductVariant): Record<string, unknown> {
    return {
      name: variant.name,
      sku: variant.sku,
      sellingPrice: variant.sellingPrice,
      costPrice: variant.costPrice,
      quantity: variant.quantity,
      attributes: variant.attributes,
      trackInventoryItems: variant.trackInventoryItems,
    };
  }

  private async findProduct(m: Record<string, unknown>): Promise<Product | null> {
    const externalId = String(m.externalId ?? '').trim();
    if (externalId) {
      const p = await this.productRepo.findOne({ where: { externalId } });
      if (p) return p;
    }
    const sku = String(m.sku ?? '').trim();
    if (sku) {
      const p = await this.productRepo.findOne({ where: { sku } });
      if (p) return p;
    }
    const barcode = String(m.barcode ?? '').trim();
    if (barcode) {
      const p = await this.productRepo.findOne({ where: { barcode } });
      if (p) return p;
    }
    const name = String(m.name ?? m.productName ?? '').trim();
    const brand = String(m.brand ?? '').trim();
    const model = String(m.model ?? '').trim();
    if (name && brand && model) {
      return this.productRepo.findOne({ where: { name, brand, model } });
    }
    if (name) return this.productRepo.findOne({ where: { name } });
    return null;
  }

  private buildAttrs(m: Record<string, unknown>): Record<string, string> | null {
    const attrs: Record<string, string> = {};
    for (const key of ['color', 'storage', 'ram', 'condition', 'grade']) {
      const v = String(m[key] ?? '').trim();
      if (v) attrs[key] = v;
    }
    return Object.keys(attrs).length ? attrs : null;
  }

  private num(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private async saveImportRow(
    batchId: string,
    row: ValidatedImportRow,
    action: string,
    targets?: {
      targetProductId?: string | null;
      targetVariantId?: string | null;
      targetInventoryItemId?: string | null;
      previousValues?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await this.rowRepo.save(
      this.rowRepo.create({
        importBatchId: batchId,
        rowNumber: row.rowNumber,
        rowData: row.mapped as Record<string, unknown>,
        mappedData: row.mapped,
        status: row.status,
        errors: row.errors.length ? row.errors : null,
        warnings: row.warnings.length ? row.warnings : null,
        targetProductId: targets?.targetProductId ?? null,
        targetVariantId: targets?.targetVariantId ?? null,
        targetInventoryItemId: targets?.targetInventoryItemId ?? null,
        previousValues: targets?.previousValues ?? null,
        action,
      }),
    );
  }
}
