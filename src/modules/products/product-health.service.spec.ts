import { ProductHealthService } from './product-health.service';

describe('ProductHealthService', () => {
  it('scores product with missing fields lower', async () => {
    const service = new ProductHealthService({} as never, {} as never, {} as never, {
      countAvailable: async () => 0,
      getSummaryForVariants: async () => new Map(),
    } as never);

    const result = await service.checkProduct('id', {
      id: 'id',
      name: 'Test',
      description: null,
      sku: null,
      category: null,
      brand: null,
      model: null,
      barcode: null,
      tags: null,
      warrantyDefault: null,
      supplier: null,
      visibility: 'public',
      costPrice: null,
      imageUrl: null,
      imageUrls: null,
      currency: 'TZS',
      sellingPrice: null,
      isActive: true,
      sortOrder: 0,
      externalId: null,
      installmentEnabled: true,
      installmentMinDeposit: null,
      installmentDurationDays: null,
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    expect(result.issues).toContain('missing_image');
    expect(result.issues).toContain('installment_invalid');
    expect(result.score).toBeLessThan(100);
  });
});
