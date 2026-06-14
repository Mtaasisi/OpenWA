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
import { MissingProductStatus } from './product-demand.enums';
import { ProductsService } from '../products/products.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { ProductDemandCampaignService } from './product-demand-campaign.service';

describe('ProductDemandService missing detail', () => {
  let service: ProductDemandService;

  const missingRow: MissingProductRequest = {
    id: 'miss-1',
    rawProductName: 'iPhone 15 Pro',
    possibleCategory: null,
    brand: null,
    timesAsked: 2,
    uniqueCustomers: 1,
    branchId: null,
    suggestedProductId: null,
    confidenceScore: null,
    status: MissingProductStatus.UNMATCHED,
    exampleMessages: ['Bei ya iPhone 15 Pro?'],
    customerIds: ['cust-1'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const missingRepo = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'miss-1' ? missingRow : null,
    ),
  };

  const eventRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [
        {
          sessionId: 'sess-1',
          chatId: '255700000000@c.us',
          customerId: 'cust-1',
          rawMessage: 'Bei ya iPhone 15 Pro?',
          createdAt: new Date('2026-06-01'),
        },
        {
          sessionId: 'sess-1',
          chatId: '255700000000@c.us',
          customerId: 'cust-1',
          rawMessage: 'Still waiting',
          createdAt: new Date('2026-06-02'),
        },
      ]),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductDemandService,
        { provide: getRepositoryToken(ProductDemandEvent, 'data'), useValue: eventRepo },
        { provide: getRepositoryToken(ProductDemandSummary, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductAlias, 'data'), useValue: {} },
        { provide: getRepositoryToken(MissingProductRequest, 'data'), useValue: missingRepo },
        { provide: getRepositoryToken(ProductDemandRecommendation, 'data'), useValue: {} },
        { provide: getRepositoryToken(ProductCatalogRequest, 'data'), useValue: {} },
        { provide: getRepositoryToken(StockingReminder, 'data'), useValue: {} },
        { provide: ProductsService, useValue: { findNamesByIds: jest.fn() } },
        { provide: AiLearningSettingsService, useValue: { getSettings: jest.fn() } },
        { provide: ProductDemandCampaignService, useValue: {} },
      ],
    }).compile();
    service = module.get(ProductDemandService);
  });

  it('returns missing row with deduped recent chats', async () => {
    const detail = await service.getMissingDetail('miss-1');
    expect(detail.missing.rawProductName).toBe('iPhone 15 Pro');
    expect(detail.recentChats).toHaveLength(1);
    expect(detail.recentChats[0].chatId).toBe('255700000000@c.us');
    expect(detail.recentChats[0].lastMessage).toBe('Bei ya iPhone 15 Pro?');
  });

  it('throws when missing product not found', async () => {
    await expect(service.getMissingDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
