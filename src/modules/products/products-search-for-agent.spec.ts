import { ProductsService } from './products.service';
import type { ProductVariant } from './entities/product-variant.entity';

const PRODUCT_ID = 'prod-11111111-1111-1111-1111-111111111111';
const VARIANT_ID = 'var-11111111-1111-1111-1111-111111111111';

function mockVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: VARIANT_ID,
    productId: PRODUCT_ID,
    name: '128GB',
    sku: null,
    sellingPrice: 500,
    quantity: 0,
    variantType: 'standard',
    isParent: false,
    parentVariantId: null,
    trackInventoryItems: true,
    attributes: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ProductVariant;
}

function createSearchService(overrides?: {
  listItems?: Array<Record<string, unknown>>;
  variants?: ProductVariant[];
  inventoryAvailable?: number;
}) {
  const listItems = overrides?.listItems ?? [
    {
      id: PRODUCT_ID,
      name: 'iPhone 15',
      sku: 'IP15',
      category: 'Phones',
      sellingPrice: 500,
      currency: 'TZS',
      totalStock: 2,
    },
  ];
  const variants = overrides?.variants ?? [mockVariant()];
  const inventoryAvailable = overrides?.inventoryAvailable ?? 2;

  const productRepo = {};
  const variantRepo = {
    find: jest.fn().mockResolvedValue(variants),
  };
  const inventoryService = {
    getSummaryForVariants: jest.fn().mockResolvedValue(
      new Map([
        [
          VARIANT_ID,
          { available: inventoryAvailable, reserved: 0, sold: 0, damaged: 0, total: inventoryAvailable },
        ],
      ]),
    ),
  };

  const service = new ProductsService(
    productRepo as never,
    variantRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    inventoryService as never,
    {} as never,
    {} as never,
    {} as never,
  );

  jest.spyOn(service, 'list').mockResolvedValue(listItems as never);

  return { service, variantRepo, inventoryService };
}

describe('ProductsService.searchForAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses inventory summaries for IMEI-tracked variants instead of variant.quantity', async () => {
    const { service, inventoryService } = createSearchService({
      variants: [mockVariant({ quantity: 0, trackInventoryItems: true })],
      inventoryAvailable: 3,
    });

    const rows = await service.searchForAgent({ q: 'iphone', limit: 5 });

    expect(inventoryService.getSummaryForVariants).toHaveBeenCalledWith([VARIANT_ID], undefined);
    expect(rows[0]?.inStock).toBe(true);
    expect(rows[0]?.variants[0]?.inStock).toBe(true);
  });

  it('returns empty when inventory summary has zero available', async () => {
    const { service } = createSearchService({
      listItems: [
        {
          id: PRODUCT_ID,
          name: 'iPhone 15',
          sku: 'IP15',
          category: 'Phones',
          sellingPrice: 500,
          currency: 'TZS',
          totalStock: 0,
        },
      ],
      variants: [mockVariant({ quantity: 0, trackInventoryItems: true })],
      inventoryAvailable: 0,
    });

    const rows = await service.searchForAgent({ q: 'iphone', limit: 5 });

    expect(rows).toEqual([]);
  });

  it('uses variant.quantity for non-tracked variants', async () => {
    const { service, inventoryService } = createSearchService({
      variants: [mockVariant({ quantity: 4, trackInventoryItems: false })],
    });

    const rows = await service.searchForAgent({ q: 'iphone', limit: 5 });

    expect(inventoryService.getSummaryForVariants).not.toHaveBeenCalled();
    expect(rows[0]?.variants[0]?.inStock).toBe(true);
  });

  it('scopes IMEI stock summaries to branch when branchId is provided', async () => {
    const { service, inventoryService } = createSearchService({
      variants: [mockVariant({ quantity: 0, trackInventoryItems: true })],
      inventoryAvailable: 2,
    });

    await service.searchForAgent({ q: 'iphone', limit: 5, branchId: 'branch-dar' });

    expect(inventoryService.getSummaryForVariants).toHaveBeenCalledWith(
      [VARIANT_ID],
      'branch-dar',
    );
  });
});

describe('ProductsService.buildAgentCatalogContext', () => {
  it('lists in-stock products from linked local inventory', async () => {
    const { service } = createSearchService({
      listItems: [
        {
          id: PRODUCT_ID,
          name: 'Samsung A05',
          sku: 'A05',
          category: 'Phones',
          sellingPrice: 250000,
          currency: 'TZS',
          totalStock: 5,
        },
      ],
    });

    const block = await service.buildAgentCatalogContext({ limit: 10 });

    expect(block).toContain('Shop inventory catalog');
    expect(block).toContain('Samsung A05');
    expect(block).toContain('250000 TZS');
    expect(block).toContain('search_products');
  });

  it('returns empty-catalog guidance when nothing is in stock', async () => {
    const { service } = createSearchService({ listItems: [] });

    const block = await service.buildAgentCatalogContext();

    expect(block).toContain('No in-stock products');
    expect(block).toContain('search_products');
  });

  it('includes branch scope label when branchId is set', async () => {
    const { service } = createSearchService({
      listItems: [
        {
          id: PRODUCT_ID,
          name: 'Samsung A05',
          sku: 'A05',
          category: 'Phones',
          sellingPrice: 250000,
          currency: 'TZS',
          totalStock: 5,
        },
      ],
    });

    const block = await service.buildAgentCatalogContext({
      limit: 10,
      branchId: 'branch-arusha',
    });

    expect(block).toContain('Branch scope: branch-arusha');
  });
});
