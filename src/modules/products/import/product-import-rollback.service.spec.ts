import { ProductImportRollbackService } from './product-import-rollback.service';

describe('ProductImportRollbackService', () => {
  it('restores updated product fields from previousValues', async () => {
    const batch = { id: 'batch-1', status: 'completed', completedAt: null };
    const rows = [
      {
        id: 'row-1',
        importBatchId: 'batch-1',
        rowNumber: 2,
        action: 'update',
        targetProductId: 'prod-1',
        targetVariantId: null,
        targetInventoryItemId: null,
        previousValues: {
          product: { name: 'Old Name', sku: 'OLD-SKU', sellingPrice: 100 },
        },
      },
    ];

    const productRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    const variantRepo = { update: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0) };
    const itemRepo = { findOne: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0) };
    const batchRepo = {
      findOne: jest.fn().mockResolvedValue(batch),
      save: jest.fn().mockImplementation(async (b) => b),
    };
    const rowRepo = { find: jest.fn().mockResolvedValue(rows) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new ProductImportRollbackService(
      batchRepo as never,
      rowRepo as never,
      productRepo as never,
      variantRepo as never,
      itemRepo as never,
      audit as never,
    );

    const result = await service.rollback('batch-1');

    expect(productRepo.update).toHaveBeenCalledWith('prod-1', {
      name: 'Old Name',
      sku: 'OLD-SKU',
      sellingPrice: 100,
    });
    expect(result.rolledBack).toBeGreaterThan(0);
    expect(batchRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'rolled_back' }));
  });

  it('deletes created inventory items when not sold or reserved', async () => {
    const batch = { id: 'batch-2', status: 'completed', completedAt: null };
    const rows = [
      {
        id: 'row-2',
        importBatchId: 'batch-2',
        rowNumber: 3,
        action: 'create',
        targetProductId: 'prod-2',
        targetVariantId: 'var-2',
        targetInventoryItemId: 'item-2',
        previousValues: {
          created: { product: false, variant: false, inventoryItem: true },
        },
      },
    ];

    const productRepo = { update: jest.fn(), delete: jest.fn() };
    const variantRepo = { update: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(1) };
    const itemRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'item-2', status: 'available' }),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    const batchRepo = {
      findOne: jest.fn().mockResolvedValue(batch),
      save: jest.fn().mockImplementation(async (b) => b),
    };
    const rowRepo = { find: jest.fn().mockResolvedValue(rows) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new ProductImportRollbackService(
      batchRepo as never,
      rowRepo as never,
      productRepo as never,
      variantRepo as never,
      itemRepo as never,
      audit as never,
    );

    const result = await service.rollback('batch-2');

    expect(itemRepo.delete).toHaveBeenCalledWith('item-2');
    expect(result.rolledBack).toBeGreaterThan(0);
  });
});
