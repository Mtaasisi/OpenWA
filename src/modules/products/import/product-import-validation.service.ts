import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { InventoryItem } from '../entities/inventory-item.entity';

export interface ValidatedImportRow {
  rowNumber: number;
  status: 'valid' | 'warning' | 'error';
  mapped: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ProductImportValidationService {
  constructor(
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(InventoryItem, 'data')
    private readonly itemRepo: Repository<InventoryItem>,
  ) {}

  async validateRows(
    rows: Array<{ rowNumber: number; mapped: Record<string, unknown> }>,
    importType: string,
  ): Promise<ValidatedImportRow[]> {
    const results: ValidatedImportRow[] = [];
    const seenSkus = new Set<string>();
    const seenImeis = new Set<string>();

    for (const row of rows) {
      const errors: string[] = [];
      const warnings: string[] = [];
      const m = row.mapped;

      if (importType.includes('product') || importType === 'products_only') {
        if (!String(m.name ?? m.productName ?? '').trim()) {
          errors.push('Product name is required');
        }
        if (!String(m.category ?? '').trim()) {
          warnings.push('Category is recommended');
        }
        const price = this.num(m.sellingPrice ?? m.price);
        if (m.sellingPrice != null && price == null) {
          errors.push('Price must be numeric');
        }
        const sku = String(m.sku ?? '').trim();
        if (sku) {
          if (seenSkus.has(sku.toLowerCase())) {
            errors.push(`Duplicate SKU in file: ${sku}`);
          }
          seenSkus.add(sku.toLowerCase());
          const existing = await this.productRepo.findOne({ where: { sku } });
          if (existing) warnings.push(`SKU ${sku} already exists — will update if mode allows`);
        }
      }

      if (importType.includes('variant') || importType === 'variants_only') {
        if (!String(m.variantName ?? '').trim()) {
          errors.push('Variant name is required for variant import');
        }
      }

      if (importType.includes('imei') || importType === 'imei_only') {
        const imei = String(m.imei ?? '').trim();
        const serial = String(m.serialNumber ?? m.serial ?? '').trim();
        if (!imei && !serial) errors.push('IMEI or serial required');
        if (imei) {
          if (seenImeis.has(imei)) errors.push(`Duplicate IMEI in file: ${imei}`);
          seenImeis.add(imei);
        }
      }

      if (m.installmentEnabled === true || m.installmentEnabled === 'true') {
        if (!m.installmentMinDeposit || !m.installmentDurationDays) {
          warnings.push('Installment enabled but deposit/duration missing');
        }
      }

      results.push({
        rowNumber: row.rowNumber,
        status: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
        mapped: m,
        errors,
        warnings,
      });
    }
    return results;
  }

  private num(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
