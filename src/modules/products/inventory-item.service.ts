import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Brackets } from 'typeorm';
import {
  InventoryItem,
  InventoryItemStatus,
} from './entities/inventory-item.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';

export interface InventoryStockSummary {
  available: number;
  reserved: number;
  sold: number;
  damaged: number;
  total: number;
}

export interface BulkPasteResult {
  valid: Array<{ imei?: string; serialNumber?: string; line: number }>;
  duplicate: Array<{ imei?: string; serialNumber?: string; line: number; reason: string }>;
  alreadyExists: Array<{ imei?: string; serialNumber?: string; line: number }>;
  invalid: Array<{ line: number; raw: string; reason: string }>;
}

@Injectable()
export class InventoryItemService {
  constructor(
    @InjectRepository(InventoryItem, 'data')
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly inauzwaPrefs: InauzwaSyncPreferencesService,
  ) {}

  async resolveBranchId(explicit?: string | null): Promise<string> {
    if (explicit?.trim()) return explicit.trim();
    const branch = await this.inauzwaPrefs.resolveEffectiveBranchId();
    return branch ?? 'default';
  }

  async listForProduct(
    productId: string,
    filters?: {
      variantId?: string;
      branchId?: string;
      status?: InventoryItemStatus;
      q?: string;
    },
  ): Promise<InventoryItem[]> {
    const qb = this.itemRepo
      .createQueryBuilder('i')
      .where('i.productId = :productId', { productId })
      .andWhere('i.deletedAt IS NULL')
      .orderBy('i.createdAt', 'DESC');

    if (filters?.variantId) {
      qb.andWhere('i.variantId = :variantId', { variantId: filters.variantId });
    }
    if (filters?.branchId) {
      qb.andWhere('i.branchId = :branchId', { branchId: filters.branchId });
    }
    if (filters?.status) {
      qb.andWhere('i.status = :status', { status: filters.status });
    }
    if (filters?.q?.trim()) {
      const like = `%${filters.q.trim()}%`;
      qb.andWhere(
        new Brackets((sq) => {
          sq.where('i.imei LIKE :like', { like })
            .orWhere('i.serialNumber LIKE :like', { like })
            .orWhere('i.barcode LIKE :like', { like });
        }),
      );
    }
    return qb.getMany();
  }

  async getSummaryForVariants(
    variantIds: string[],
    branchId?: string,
  ): Promise<Map<string, InventoryStockSummary>> {
    const map = new Map<string, InventoryStockSummary>();
    if (!variantIds.length) return map;

    const qb = this.itemRepo
      .createQueryBuilder('i')
      .select('i.variantId', 'variantId')
      .addSelect('i.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('i.variantId IN (:...variantIds)', { variantIds })
      .andWhere('i.deletedAt IS NULL')
      .groupBy('i.variantId')
      .addGroupBy('i.status');

    if (branchId) {
      qb.andWhere('i.branchId = :branchId', { branchId });
    }

    const rows = await qb.getRawMany<{ variantId: string; status: string; cnt: string }>();
    for (const id of variantIds) {
      map.set(id, { available: 0, reserved: 0, sold: 0, damaged: 0, total: 0 });
    }
    for (const row of rows) {
      const summary = map.get(row.variantId)!;
      const cnt = Number(row.cnt) || 0;
      summary.total += cnt;
      if (row.status === 'available') summary.available = cnt;
      else if (row.status === 'reserved') summary.reserved = cnt;
      else if (row.status === 'sold') summary.sold = cnt;
      else if (row.status === 'damaged') summary.damaged = cnt;
    }
    return map;
  }

  async countAvailable(variantId: string, branchId?: string): Promise<number> {
    const summary = await this.getSummaryForVariants([variantId], branchId);
    return summary.get(variantId)?.available ?? 0;
  }

  async createItem(input: {
    productId: string;
    variantId: string;
    branchId?: string;
    imei?: string | null;
    serialNumber?: string | null;
    deviceId?: string | null;
    barcode?: string | null;
    status?: InventoryItemStatus;
    costPrice?: number | null;
    sellingPrice?: number | null;
    supplier?: string | null;
    purchaseBatch?: string | null;
    notes?: string | null;
    externalId?: string | null;
  }): Promise<InventoryItem> {
    const variant = await this.variantRepo.findOne({
      where: { id: input.variantId, productId: input.productId },
    });
    if (!variant) {
      throw new BadRequestException('Variant not found for this product');
    }
    if (!variant.trackInventoryItems && variant.variantType !== 'parent' && !variant.isParent) {
      throw new BadRequestException(
        'Enable "Track individual items by IMEI/Serial" on the variant before adding inventory items',
      );
    }
    const imei = input.imei?.trim() || null;
    const serial = input.serialNumber?.trim() || null;
    if (!imei && !serial) {
      throw new BadRequestException('IMEI or serial number is required');
    }

    const branchId = await this.resolveBranchId(input.branchId);
    await this.assertNoDuplicateImeiOrSerial(branchId, imei, serial);

    const item = this.itemRepo.create({
      productId: input.productId,
      variantId: input.variantId,
      branchId,
      imei,
      serialNumber: serial,
      deviceId: input.deviceId ?? null,
      barcode: input.barcode ?? null,
      status: input.status ?? 'available',
      costPrice: input.costPrice ?? variant.costPrice ?? null,
      sellingPrice: input.sellingPrice ?? variant.sellingPrice ?? null,
      supplier: input.supplier ?? null,
      purchaseBatch: input.purchaseBatch ?? null,
      notes: input.notes ?? null,
      externalId: input.externalId ?? null,
    });
    const saved = await this.itemRepo.save(item);
    await this.syncVariantQuantity(input.variantId, branchId);
    return saved;
  }

  async updateItem(
    id: string,
    productId: string,
    patch: Partial<{
      imei: string | null;
      serialNumber: string | null;
      status: InventoryItemStatus;
      costPrice: number | null;
      sellingPrice: number | null;
      notes: string | null;
      branchId: string;
    }>,
  ): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ where: { id, productId, deletedAt: IsNull() } });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (patch.status === 'sold' && item.status !== 'sold') {
      item.soldAt = new Date();
    }
    if (patch.status === 'reserved' && item.status !== 'reserved') {
      item.reservedAt = new Date();
    }
    if (patch.status === 'available') {
      item.reservedAt = null;
    }

    if (patch.imei !== undefined || patch.serialNumber !== undefined) {
      const imei = patch.imei !== undefined ? patch.imei?.trim() || null : item.imei;
      const serial =
        patch.serialNumber !== undefined ? patch.serialNumber?.trim() || null : item.serialNumber;
      const branchId = patch.branchId ?? item.branchId;
      await this.assertNoDuplicateImeiOrSerial(branchId, imei, serial, id);
      if (patch.imei !== undefined) item.imei = imei;
      if (patch.serialNumber !== undefined) item.serialNumber = serial;
    }

    Object.assign(item, {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.costPrice !== undefined ? { costPrice: patch.costPrice } : {}),
      ...(patch.sellingPrice !== undefined ? { sellingPrice: patch.sellingPrice } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.branchId !== undefined ? { branchId: patch.branchId } : {}),
    });

    const saved = await this.itemRepo.save(item);
    await this.syncVariantQuantity(item.variantId, item.branchId);
    return saved;
  }

  async softDeleteItem(id: string, productId: string): Promise<void> {
    const item = await this.itemRepo.findOne({ where: { id, productId, deletedAt: IsNull() } });
    if (!item) throw new NotFoundException('Inventory item not found');
    if (item.status === 'sold' || item.status === 'reserved') {
      throw new BadRequestException('Cannot delete sold or reserved inventory items');
    }
    item.deletedAt = new Date();
    item.status = 'inactive';
    await this.itemRepo.save(item);
    await this.syncVariantQuantity(item.variantId, item.branchId);
  }

  parseBulkPaste(text: string, branchId?: string): BulkPasteResult {
    const result: BulkPasteResult = {
      valid: [],
      duplicate: [],
      alreadyExists: [],
      invalid: [],
    };
    const seenImei = new Set<string>();
    const seenSerial = new Set<string>();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const parts = line.split(/[,;\t|]/).map((p) => p.trim()).filter(Boolean);
      const imei = parts[0]?.replace(/\s/g, '') || undefined;
      const serial = parts[1]?.replace(/\s/g, '') || undefined;

      if (!imei && !serial) {
        result.invalid.push({ line: lineNum, raw: line, reason: 'Missing IMEI and serial' });
        return;
      }
      if (imei && (imei.length < 14 || imei.length > 16 || !/^\d+$/.test(imei))) {
        result.invalid.push({ line: lineNum, raw: line, reason: 'Invalid IMEI length' });
        return;
      }
      if (imei && seenImei.has(imei)) {
        result.duplicate.push({ imei, serialNumber: serial, line: lineNum, reason: 'Duplicate in paste' });
        return;
      }
      if (serial && seenSerial.has(serial)) {
        result.duplicate.push({ imei, serialNumber: serial, line: lineNum, reason: 'Duplicate serial in paste' });
        return;
      }
      if (imei) seenImei.add(imei);
      if (serial) seenSerial.add(serial);
      result.valid.push({ imei, serialNumber: serial, line: lineNum });
    });

    void branchId;
    return result;
  }

  async bulkCreateFromPaste(
    productId: string,
    variantId: string,
    text: string,
    branchId?: string,
  ): Promise<{ created: number; skipped: number; preview: BulkPasteResult }> {
    const preview = this.parseBulkPaste(text, branchId);
    let created = 0;
    let skipped = 0;
    const resolvedBranch = await this.resolveBranchId(branchId);

    for (const row of preview.valid) {
      try {
        const exists = await this.findExisting(resolvedBranch, row.imei, row.serialNumber);
        if (exists) {
          preview.alreadyExists.push({
            imei: row.imei,
            serialNumber: row.serialNumber,
            line: row.line,
          });
          skipped += 1;
          continue;
        }
        await this.createItem({
          productId,
          variantId,
          branchId: resolvedBranch,
          imei: row.imei,
          serialNumber: row.serialNumber,
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    }
    return { created, skipped, preview };
  }

  async syncVariantQuantity(variantId: string, branchId?: string): Promise<void> {
    const available = await this.countAvailable(variantId, branchId);
    await this.variantRepo.update({ id: variantId }, { quantity: available });
  }

  async syncInauzwaItem(input: {
    productId: string;
    variantId: string;
    branchId: string;
    externalId: string;
    imei?: string | null;
    serialNumber?: string | null;
    sellingPrice?: number | null;
    isActive?: boolean;
    attributes?: Record<string, unknown> | null;
  }): Promise<{ item: InventoryItem; created: boolean }> {
    let item = await this.itemRepo.findOne({ where: { externalId: input.externalId } });
    const created = !item;
    if (!item) {
      item = this.itemRepo.create({ externalId: input.externalId, productId: input.productId });
    }

    const imei = input.imei?.trim() || (input.attributes?.imei as string)?.trim() || null;
    const serial =
      input.serialNumber?.trim() || (input.attributes?.serial_number as string)?.trim() || null;

    item.productId = input.productId;
    item.variantId = input.variantId;
    item.branchId = input.branchId;
    item.imei = imei;
    item.serialNumber = serial;
    item.sellingPrice = input.sellingPrice ?? item.sellingPrice;
    item.status = input.isActive === false ? 'inactive' : 'available';
    item.deletedAt = null;

    await this.itemRepo.save(item);
    await this.syncVariantQuantity(input.variantId, input.branchId);
    return { item, created };
  }

  private async findExisting(
    branchId: string,
    imei?: string,
    serial?: string,
  ): Promise<InventoryItem | null> {
    if (imei) {
      const byImei = await this.itemRepo.findOne({
        where: { branchId, imei, deletedAt: IsNull() },
      });
      if (byImei) return byImei;
    }
    if (serial) {
      return this.itemRepo.findOne({
        where: { branchId, serialNumber: serial, deletedAt: IsNull() },
      });
    }
    return null;
  }

  private async assertNoDuplicateImeiOrSerial(
    branchId: string,
    imei: string | null,
    serial: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (imei) {
      const dup = await this.itemRepo.findOne({
        where: { branchId, imei, deletedAt: IsNull() },
      });
      if (dup && dup.id !== excludeId) {
        throw new BadRequestException(`IMEI ${imei} already exists for this branch`);
      }
    }
    if (serial) {
      const dup = await this.itemRepo.findOne({
        where: { branchId, serialNumber: serial, deletedAt: IsNull() },
      });
      if (dup && dup.id !== excludeId) {
        throw new BadRequestException(`Serial ${serial} already exists for this branch`);
      }
    }
  }

  async getAvailableItemsForVariant(
    variantId: string,
    branchId?: string,
  ): Promise<InventoryItem[]> {
    const resolved = branchId ?? (await this.resolveBranchId());
    return this.itemRepo.find({
      where: {
        variantId,
        branchId: resolved,
        status: 'available' as InventoryItemStatus,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });
  }
}
