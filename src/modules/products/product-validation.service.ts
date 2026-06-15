import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { InventoryItem } from './entities/inventory-item.entity';

@Injectable()
export class ProductValidationService {
  constructor(
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(InventoryItem, 'data')
    private readonly itemRepo: Repository<InventoryItem>,
  ) {}

  async assertUniqueProductSku(sku: string | null | undefined, excludeProductId?: string): Promise<void> {
    const normalized = sku?.trim();
    if (!normalized) return;
    const existing = await this.productRepo.findOne({ where: { sku: normalized } });
    if (existing && existing.id !== excludeProductId) {
      throw new BadRequestException(`Product SKU "${normalized}" is already in use`);
    }
  }

  async assertUniqueVariantSku(
    sku: string | null | undefined,
    excludeVariantId?: string,
  ): Promise<void> {
    const normalized = sku?.trim();
    if (!normalized) return;
    const existing = await this.variantRepo.findOne({ where: { sku: normalized } });
    if (existing && existing.id !== excludeVariantId) {
      throw new BadRequestException(`Variant SKU "${normalized}" is already in use`);
    }
  }

  async assertCanHardDeleteProduct(productId: string): Promise<void> {
    const soldOrReserved = await this.itemRepo.count({
      where: {
        productId,
        status: Not('available' as never),
        deletedAt: IsNull(),
      },
    });
    if (soldOrReserved > 0) {
      throw new BadRequestException(
        'Product has sold or reserved inventory items. Deactivate instead of deleting.',
      );
    }
  }

  async assertCanDeleteVariant(productId: string, variantId: string): Promise<void> {
    const blocked = await this.itemRepo.count({
      where: {
        productId,
        variantId,
        deletedAt: IsNull(),
      },
    });
    const soldReserved = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.variantId = :variantId', { variantId })
      .andWhere('i.productId = :productId', { productId })
      .andWhere('i.deletedAt IS NULL')
      .andWhere('i.status IN (:...statuses)', { statuses: ['sold', 'reserved'] })
      .getCount();
    if (soldReserved > 0) {
      throw new BadRequestException(
        'Variant has sold or reserved inventory items. Deactivate instead.',
      );
    }
    void blocked;
  }

  rejectImeiChildVariantCreate(variantType?: string): void {
    if (variantType === 'imei_child') {
      throw new BadRequestException(
        'IMEI/serial items must be added via Inventory tab (POST /products/:id/inventory-items)',
      );
    }
  }

  assertQuantityEditAllowed(variant: ProductVariant, quantity?: number): void {
    if (quantity === undefined) return;
    const tracked =
      variant.trackInventoryItems || variant.isParent || variant.variantType === 'parent';
    if (tracked) {
      throw new BadRequestException(
        'Stock quantity for IMEI-tracked variants is calculated from inventory items',
      );
    }
    if (quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
    }
  }
}
