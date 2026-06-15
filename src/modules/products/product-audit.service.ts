import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductAuditEvent } from './entities/product-audit-event.entity';

@Injectable()
export class ProductAuditService {
  constructor(
    @InjectRepository(ProductAuditEvent, 'data')
    private readonly auditRepo: Repository<ProductAuditEvent>,
  ) {}

  async log(input: {
    productId: string;
    action: string;
    variantId?: string | null;
    inventoryItemId?: string | null;
    actorId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const row = this.auditRepo.create({
      productId: input.productId,
      action: input.action,
      variantId: input.variantId ?? null,
      inventoryItemId: input.inventoryItemId ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? null,
    });
    await this.auditRepo.save(row);
  }

  async listForProduct(productId: string, limit = 50): Promise<ProductAuditEvent[]> {
    return this.auditRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
