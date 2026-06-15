import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImportBatch } from '../entities/product-import-batch.entity';
import { ProductImportRow } from '../entities/product-import-row.entity';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { ProductAuditService } from '../product-audit.service';

type CreatedFlags = { product?: boolean; variant?: boolean; inventoryItem?: boolean };

@Injectable()
export class ProductImportRollbackService {
  constructor(
    @InjectRepository(ProductImportBatch, 'data')
    private readonly batchRepo: Repository<ProductImportBatch>,
    @InjectRepository(ProductImportRow, 'data')
    private readonly rowRepo: Repository<ProductImportRow>,
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(InventoryItem, 'data')
    private readonly itemRepo: Repository<InventoryItem>,
    private readonly audit: ProductAuditService,
  ) {}

  async rollback(batchId: string): Promise<{ rolledBack: number; warnings: string[] }> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status === 'rolled_back') {
      throw new BadRequestException('Import batch already rolled back');
    }

    const rows = await this.rowRepo.find({
      where: { importBatchId: batchId },
      order: { rowNumber: 'DESC' },
    });
    const warnings: string[] = [];
    let rolledBack = 0;

    for (const row of rows) {
      if (row.action === 'skip' || row.action === 'error' || row.action === 'dry_run') continue;

      const previous = row.previousValues ?? {};
      const created = (previous.created as CreatedFlags | undefined) ?? {};

      if (row.action === 'update' || previous.product || previous.variant) {
        if (row.targetVariantId && previous.variant) {
          await this.variantRepo.update(row.targetVariantId, previous.variant as Partial<ProductVariant>);
          rolledBack += 1;
        }
        if (row.targetProductId && previous.product) {
          await this.productRepo.update(row.targetProductId, previous.product as Partial<Product>);
          rolledBack += 1;
        }
      }

      if (row.action !== 'create' && !created.product && !created.variant && !created.inventoryItem) {
        continue;
      }

      if (row.targetInventoryItemId && created.inventoryItem) {
        const item = await this.itemRepo.findOne({ where: { id: row.targetInventoryItemId } });
        if (item && (item.status === 'sold' || item.status === 'reserved')) {
          warnings.push(`Skipped inventory item ${item.id} (${item.status})`);
        } else if (item) {
          await this.itemRepo.delete(item.id);
          rolledBack += 1;
        }
      }

      if (row.targetVariantId && created.variant) {
        const itemCount = await this.itemRepo.count({ where: { variantId: row.targetVariantId } });
        if (itemCount === 0) {
          await this.variantRepo.delete({ id: row.targetVariantId });
          rolledBack += 1;
        } else {
          warnings.push(`Skipped variant delete ${row.targetVariantId} (inventory items remain)`);
        }
      }

      if (row.targetProductId && created.product) {
        const variantCount = await this.variantRepo.count({ where: { productId: row.targetProductId } });
        if (variantCount === 0) {
          await this.productRepo.delete({ id: row.targetProductId });
          rolledBack += 1;
        } else {
          warnings.push(`Skipped product delete ${row.targetProductId} (variants remain)`);
        }
      }
    }

    batch.status = 'rolled_back';
    batch.completedAt = new Date();
    await this.batchRepo.save(batch);
    await this.audit.log({
      productId: rows[0]?.targetProductId ?? 'import',
      action: 'import_rollback',
      metadata: { batchId, rolledBack, warnings },
    });

    return { rolledBack, warnings };
  }
}
