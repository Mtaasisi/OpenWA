import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AiLearningItemsController } from '../src/modules/ai/ai-learning-items.controller';
import { AiLearningItemsService } from '../src/modules/ai/ai-learning-items.service';
import { AiLearningKnowledgeService } from '../src/modules/ai/ai-learning-knowledge.service';
import { AiLearningSettingsService } from '../src/modules/ai/ai-learning-settings.service';
import { AiLearningItemStatus } from '../src/modules/ai/ai-learning.enums';

describe('AiLearning API (e2e)', () => {
  let app: INestApplication<App>;

  const itemsService = {
    getOverview: jest.fn(),
    listItems: jest.fn(),
    getItem: jest.fn(),
    findSimilar: jest.fn(),
    listHistory: jest.fn(),
    approveItem: jest.fn(),
    rejectItem: jest.fn(),
    ignoreItem: jest.fn(),
    updateItem: jest.fn(),
    replyAndTeach: jest.fn(),
    teachOnly: jest.fn(),
    replyOnly: jest.fn(),
    mergeItems: jest.fn(),
  };

  const knowledgeService = {
    listKnowledge: jest.fn(),
    updateKnowledge: jest.fn(),
    disableKnowledge: jest.fn(),
    markNeedsReview: jest.fn(),
  };

  const settingsService = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    resetDefaults: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AiLearningItemsController],
      providers: [
        { provide: AiLearningItemsService, useValue: itemsService },
        { provide: AiLearningKnowledgeService, useValue: knowledgeService },
        { provide: AiLearningSettingsService, useValue: settingsService },
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

  it('GET /api/ai-learning/overview returns KPI payload', async () => {
    itemsService.getOverview.mockResolvedValue({
      pendingLearning: 3,
      unknownQuestionsToday: 1,
      mostAskedProduct: 'iPhone 14',
      outOfStockDemand: 2,
      installmentDemand: 4,
      aiPausedChats: 0,
    });

    const res = await request(app.getHttpServer()).get('/api/ai-learning/overview').expect(200);

    expect(res.body.pendingLearning).toBe(3);
    expect(res.body.mostAskedProduct).toBe('iPhone 14');
  });

  it('GET /api/ai-learning/items?status=pending_review lists pending questions', async () => {
    itemsService.listItems.mockResolvedValue([
      {
        id: 'item-1',
        question: 'Bei ya simu?',
        status: AiLearningItemStatus.PENDING_REVIEW,
        confidenceScore: 0.3,
        timesAsked: 1,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/ai-learning/items')
      .query({ status: 'pending_review' })
      .expect(200);

    expect(itemsService.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review' }),
    );
    expect(res.body).toHaveLength(1);
    expect(res.body[0].question).toBe('Bei ya simu?');
  });

  it('GET /api/ai-learning/settings returns learning settings', async () => {
    settingsService.getSettings.mockResolvedValue({
      enableLearningDetection: true,
      trackCustomerOutcome: true,
      highConfidenceThreshold: 0.8,
      mediumConfidenceThreshold: 0.5,
      defaultUnknownReply: 'Nipe muda kidogo Boss…',
    });

    const res = await request(app.getHttpServer()).get('/api/ai-learning/settings').expect(200);

    expect(res.body.trackCustomerOutcome).toBe(true);
    expect(res.body.defaultUnknownReply).toContain('Nipe muda');
  });

  it('GET /api/ai-learning/history returns approved items', async () => {
    itemsService.listHistory.mockResolvedValue([
      {
        id: 'hist-1',
        question: 'Delivery time?',
        adminFinalAnswer: 'Same day in Dar.',
        status: AiLearningItemStatus.APPROVED,
      },
    ]);

    const res = await request(app.getHttpServer()).get('/api/ai-learning/history').expect(200);

    expect(res.body[0].adminFinalAnswer).toBe('Same day in Dar.');
  });
});
