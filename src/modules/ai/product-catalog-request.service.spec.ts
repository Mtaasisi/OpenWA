import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductDemandService } from './product-demand.service';
import { ProductDemandEvent } from './entities/product-demand-event.entity';
import { ProductDemandSummary } from './entities/product-demand-summary.entity';
import { ProductAlias } from './entities/product-alias.entity';
import { MissingProductRequest } from './entities/missing-product-request.entity';
import { ProductDemandRecommendation } from './entities/product-demand-recommendation.entity';
import { ProductCatalogRequest } from './entities/product-catalog-request.entity';
import { StockingReminder } from './entities/stocking-reminder.entity';
import { ProductCatalogRequestStatus } from './product-demand.enums';
import { ProductsService } from '../products/products.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { ProductDemandCampaignService } from './product-demand-campaign.service';

function createCatalogStore() {
  const rows: ProductCatalogRequest[] = [];

  const repo = {
    create: jest.fn((data: Partial<ProductCatalogRequest>) => ({
      id: `req-${rows.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      customerCount: 1,
      priority: 'medium',
      status: ProductCatalogRequestStatus.OPEN,
      ...data,
    })),
    save: jest.fn(async (row: ProductCatalogRequest) => {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      return row;
    }),
    findOne: jest.fn(async (opts: { where: { id: string } }) =>
      rows.find(r => r.id === opts.where.id) ?? null,
    ),
    find: jest.fn(async () =>
      rows.filter(
        r =>
          r.status === ProductCatalogRequestStatus.OPEN ||
          r.status === ProductCatalogRequestStatus.IN_PROGRESS,
      ),
    ),
    createQueryBuilder: jest.fn(() => {
      let statuses: string[] | null = null;
      let status: string | null = null;
      const qb = {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
          if (params?.statuses) statuses = params.statuses as string[];
          if (params?.status) status = params.status as string;
          return qb;
        }),
        getMany: jest.fn(async () => {
          let result = [...rows];
          if (statuses) result = result.filter(r => statuses!.includes(r.status));
          else if (status) result = result.filter(r => r.status === status);
          return result;
        }),
      };
      return qb;
    }),
  };

  return { repo, rows };
}

describe('ProductDemandService catalog requests', () => {
  let service: ProductDemandService;
  let store: ReturnType<typeof createCatalogStore>;

  beforeEach(async () => {
    store = createCatalogStore();
    store.rows.push(
      {
        id: 'req-open',
        productName: 'iPhone 15',
        category: null,
        brand: null,
        suggestedSpecs: null,
        branchId: null,
        customerCount: 3,
        exampleMessages: null,
        priority: 'high',
        notes: null,
        assignedStaffId: null,
        dueDate: null,
        missingProductRequestId: null,
        productId: null,
        fulfilledAt: null,
        status: ProductCatalogRequestStatus.OPEN,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'req-done',
        productName: 'Galaxy S24',
        category: null,
        brand: null,
        suggestedSpecs: null,
        branchId: null,
        customerCount: 1,
        exampleMessages: null,
        priority: 'medium',
        notes: null,
        assignedStaffId: null,
        dueDate: null,
        missingProductRequestId: null,
        productId: null,
        fulfilledAt: new Date(),
        status: ProductCatalogRequestStatus.DONE,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductDemandService,
        { provide: getRepositoryToken(ProductDemandEvent, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductDemandSummary, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductAlias, 'data'), useValue: {} },
        { provide: getRepositoryToken(MissingProductRequest, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductDemandRecommendation, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductCatalogRequest, 'data'), useValue: store.repo },
        { provide: getRepositoryToken(StockingReminder, 'data'), useValue: {} },
        {
          provide: ProductsService,
          useValue: {
            findNamesByIds: jest.fn(async (ids: string[]) =>
              Object.fromEntries(
                ids.map(id => [
                  id,
                  id === 'prod-iphone' ? 'iPhone 15' : 'Catalog product',
                ]),
              ),
            ),
            findOne: jest.fn(async (id: string) => ({ id, name: 'iPhone 15' })),
          },
        },
        { provide: AiLearningSettingsService, useValue: { getSettings: jest.fn() } },
        { provide: ProductDemandCampaignService, useValue: {} },
      ],
    }).compile();

    service = module.get(ProductDemandService);
  });

  it('lists active requests (open + in_progress)', async () => {
    const rows = await service.listProductRequests('active');
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe('iPhone 15');
  });

  it('lists all requests when filter is all', async () => {
    const rows = await service.listProductRequests('all');
    expect(rows).toHaveLength(2);
  });

  it('updates request status to done', async () => {
    const updated = await service.updateProductRequest('req-open', {
      status: ProductCatalogRequestStatus.DONE,
      notes: 'Added to catalog',
    });
    expect(updated.status).toBe(ProductCatalogRequestStatus.DONE);
    expect(updated.notes).toBe('Added to catalog');
  });

  it('throws when request missing', async () => {
    await expect(service.getProductRequest('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('auto-fulfills open requests with matching product name', async () => {
    const count = await service.fulfillMatchingCatalogRequests('prod-new', 'iphone 15');
    expect(count).toBe(1);
    const rows = await service.listProductRequests('all');
    const fulfilled = rows.find(r => r.id === 'req-open');
    expect(fulfilled?.status).toBe(ProductCatalogRequestStatus.DONE);
    expect(fulfilled?.productId).toBe('prod-new');
  });

  it('links request to catalog product and marks done', async () => {
    store.rows.push({
      id: 'req-link',
      productName: 'Pixel 8',
      category: null,
      brand: null,
      suggestedSpecs: null,
      branchId: null,
      customerCount: 2,
      exampleMessages: null,
      priority: 'medium',
      notes: null,
      assignedStaffId: null,
      dueDate: null,
      missingProductRequestId: null,
      productId: null,
      fulfilledAt: null,
      status: ProductCatalogRequestStatus.OPEN,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = await service.linkProductRequestToCatalog('req-link', 'prod-iphone');
    expect(updated.productId).toBe('prod-iphone');
    expect(updated.status).toBe(ProductCatalogRequestStatus.DONE);
    expect(updated.linkedProductName).toBe('iPhone 15');
  });
});
