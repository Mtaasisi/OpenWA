import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProductDemandController } from '../src/modules/ai/product-demand.controller';
import { ProductDemandService } from '../src/modules/ai/product-demand.service';
import { ProductDemandCampaignService } from '../src/modules/ai/product-demand-campaign.service';
import { ProductCatalogRequestStatus } from '../src/modules/ai/product-demand.enums';

describe('ProductDemand API (e2e)', () => {
  let app: INestApplication<App>;

  const campaignService = {
    listCampaigns: jest.fn(),
    getCampaign: jest.fn(),
    getCampaignMetrics: jest.fn(),
  };

  const demandService = {
    listProductRequests: jest.fn(),
    getProductRequest: jest.fn(),
    updateProductRequest: jest.fn(),
    linkProductRequestToCatalog: jest.fn(),
    getMissingDetail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductDemandController],
      providers: [
        { provide: ProductDemandService, useValue: demandService },
        { provide: ProductDemandCampaignService, useValue: campaignService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/product-demand/product-requests defaults to active filter', async () => {
    demandService.listProductRequests.mockResolvedValue([
      { id: 'req-1', productName: 'Samsung A55', status: ProductCatalogRequestStatus.OPEN },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/product-demand/product-requests')
      .expect(200);

    expect(demandService.listProductRequests).toHaveBeenCalledWith(undefined);
    expect(res.body[0].productName).toBe('Samsung A55');
  });

  it('GET /api/product-demand/product-requests?status=done filters completed', async () => {
    demandService.listProductRequests.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/product-demand/product-requests')
      .query({ status: 'done' })
      .expect(200);

    expect(demandService.listProductRequests).toHaveBeenCalledWith('done');
  });

  it('GET /api/product-demand/product-requests/:id returns one request', async () => {
    demandService.getProductRequest.mockResolvedValue({
      id: 'req-1',
      productName: 'iPhone 14',
      status: ProductCatalogRequestStatus.IN_PROGRESS,
    });

    const res = await request(app.getHttpServer())
      .get('/api/product-demand/product-requests/req-1')
      .expect(200);

    expect(res.body.productName).toBe('iPhone 14');
  });

  it('GET /api/product-demand/campaigns/metrics returns counts', async () => {
    campaignService.getCampaignMetrics.mockResolvedValue({
      draft: 2,
      sent: 1,
      cancelled: 0,
      total: 3,
      sms: 2,
      whatsapp: 1,
      totalRecipients: 12,
    });

    const res = await request(app.getHttpServer())
      .get('/api/product-demand/campaigns/metrics')
      .expect(200);

    expect(res.body.draft).toBe(2);
    expect(res.body.totalRecipients).toBe(12);
  });

  it('GET /api/product-demand/campaigns lists demand outreach campaigns', async () => {
    campaignService.listCampaigns.mockResolvedValue([
      { id: 'camp-1', title: 'Restock iPhone', status: 'draft', recipientCount: 5 },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/product-demand/campaigns')
      .expect(200);

    expect(res.body[0].title).toBe('Restock iPhone');
  });

  it('GET /api/product-demand/missing/:id returns recent inbox chats', async () => {
    demandService.getMissingDetail.mockResolvedValue({
      missing: { id: 'miss-1', rawProductName: 'Galaxy Tab' },
      recentChats: [{ sessionId: 'sess-1', chatId: '255700@c.us', customerId: null, lastMessage: 'Tab bei?' }],
    });

    const res = await request(app.getHttpServer())
      .get('/api/product-demand/missing/miss-1')
      .expect(200);

    expect(res.body.recentChats).toHaveLength(1);
    expect(res.body.missing.rawProductName).toBe('Galaxy Tab');
  });

  it('POST /api/product-demand/product-requests/:id/link-product links catalog product', async () => {
    demandService.linkProductRequestToCatalog.mockResolvedValue({
      id: 'req-1',
      productName: 'Samsung A55',
      productId: 'prod-1',
      linkedProductName: 'Samsung A55',
      status: ProductCatalogRequestStatus.DONE,
    });

    const res = await request(app.getHttpServer())
      .post('/api/product-demand/product-requests/req-1/link-product')
      .send({ productId: 'prod-1' })
      .expect(201);

    expect(demandService.linkProductRequestToCatalog).toHaveBeenCalledWith('req-1', 'prod-1');
    expect(res.body.linkedProductName).toBe('Samsung A55');
  });
});
