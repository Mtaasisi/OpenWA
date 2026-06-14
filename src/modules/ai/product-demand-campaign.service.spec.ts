import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductDemandCampaignService } from './product-demand-campaign.service';
import { ProductDemandCampaign } from './entities/product-demand-campaign.entity';
import { ProductDemandEvent } from './entities/product-demand-event.entity';
import { ProductDemandSummary } from './entities/product-demand-summary.entity';
import { ProductDemandRecommendation } from './entities/product-demand-recommendation.entity';
import { ProductDemandCampaignChannel } from './product-demand.enums';
import { SmsService } from '../sms/sms.service';
import { InboxSendPipelineService } from '../message/inbox-send-pipeline.service';
import { WhatsAppCampaignPreflightService } from '../whatsapp-safety/services/whatsapp-campaign-preflight.service';

describe('ProductDemandCampaignService', () => {
  let service: ProductDemandCampaignService;
  let preflight: { preflight: jest.Mock };
  const campaigns: ProductDemandCampaign[] = [];

  const campaignRepo = {
    create: jest.fn((data: Partial<ProductDemandCampaign>) => ({
      id: `camp-${campaigns.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      recipientCount: 0,
      sentCount: 0,
      status: 'draft',
      channel: 'sms',
      ...data,
    })),
    save: jest.fn(async (row: ProductDemandCampaign) => {
      const idx = campaigns.findIndex(c => c.id === row.id);
      if (idx >= 0) campaigns[idx] = row;
      else campaigns.push(row);
      return row;
    }),
    find: jest.fn(async () => campaigns),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      campaigns.find(c => c.id === where.id) ?? null,
    ),
  };

  const eventRepo = {
    find: jest.fn(async () => [
      {
        sessionId: 'sess-1',
        chatId: '255700000000@c.us',
        customerId: 'cust-1',
        rawMessage: 'Need iPhone 15',
        createdAt: new Date(),
      },
    ]),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => []),
    })),
  };

  const summaryRepo = {
    findOne: jest.fn(async () => ({
      id: 'sum-1',
      productId: 'prod-1',
      detectedProductName: 'iPhone 15',
    })),
  };

  const recRepo = {
    findOne: jest.fn(async () => ({
      id: 'rec-1',
      title: 'Restock iPhone 15',
      reason: 'High demand',
      productNames: ['iPhone 15'],
      productIds: ['prod-1'],
      summaryId: 'sum-1',
      customersAffected: 3,
      branchId: null,
      priority: 'high',
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    campaigns.length = 0;
    preflight = {
      preflight: jest.fn(async () => ({
        launchAllowed: true,
        requiredFixes: [],
        recipients: [{ chatId: '255700000000@c.us', skipped: false }],
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductDemandCampaignService,
        { provide: getRepositoryToken(ProductDemandCampaign, 'data'), useValue: campaignRepo },
        { provide: getRepositoryToken(ProductDemandEvent, 'data'), useValue: eventRepo },
        { provide: getRepositoryToken(ProductDemandSummary, 'data'), useValue: summaryRepo },
        { provide: getRepositoryToken(ProductDemandRecommendation, 'data'), useValue: recRepo },
        { provide: SmsService, useValue: { bulkSend: jest.fn() } },
        {
          provide: InboxSendPipelineService,
          useValue: {
            send: jest.fn(async () => ({ messageId: 'msg-1' })),
          },
        },
        { provide: WhatsAppCampaignPreflightService, useValue: preflight },
      ],
    }).compile();
    service = module.get(ProductDemandCampaignService);
  });

  it('creates campaign from recommendation with recipients', async () => {
    const campaign = await service.createFromRecommendation('rec-1', 'staff-1');
    expect(campaign.title).toBe('Restock iPhone 15');
    expect(campaign.recipientCount).toBe(1);
    expect(campaign.recipients?.[0].chatId).toBe('255700000000@c.us');
    expect(campaign.recommendationId).toBe('rec-1');
  });

  it('lists saved campaigns', async () => {
    await service.createFromRecommendation('rec-1');
    const rows = await service.listCampaigns();
    expect(rows).toHaveLength(1);
  });

  it('returns campaign metrics', async () => {
    await service.createFromRecommendation('rec-1');
    const metrics = await service.getCampaignMetrics();
    expect(metrics.draft).toBe(1);
    expect(metrics.approved).toBe(0);
    expect(metrics.totalRecipients).toBe(1);
  });

  it('blocks WhatsApp send until campaign is approved', async () => {
    const campaign = await service.createFromRecommendation('rec-1');
    campaign.channel = ProductDemandCampaignChannel.WHATSAPP;
    campaign.sessionId = 'sess-1';
    await campaignRepo.save(campaign);

    await expect(
      service.sendCampaign(campaign.id, { id: 'key-1' } as never, {
        channel: ProductDemandCampaignChannel.WHATSAPP,
        sessionId: 'sess-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves launch after preflight passes', async () => {
    const campaign = await service.createFromRecommendation('rec-1');
    campaign.channel = ProductDemandCampaignChannel.WHATSAPP;
    campaign.sessionId = 'sess-1';
    await campaignRepo.save(campaign);

    const approved = await service.approveLaunch(campaign.id, { id: 'admin-1' } as never);
    expect(approved.status).toBe('approved');
    expect(preflight.preflight).toHaveBeenCalled();
  });
});
