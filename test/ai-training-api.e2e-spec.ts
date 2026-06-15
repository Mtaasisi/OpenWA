jest.mock('../src/modules/ai-training/ai-training.service', () => ({
  AiTrainingService: jest.fn(),
}));

jest.mock('../src/modules/ai-training/ai-training-approval.service', () => ({
  AiTrainingApprovalService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AiTrainingController } from '../src/modules/ai-training/ai-training.controller';
import { AiTrainingService } from '../src/modules/ai-training/ai-training.service';
import { AiTrainingApprovalService } from '../src/modules/ai-training/ai-training-approval.service';
import { AiLearningItemStatus } from '../src/modules/ai/ai-learning.enums';
import { ApiKeyRole } from '../src/modules/auth/entities/api-key.entity';

describe('AiTraining API (e2e)', () => {
  let app: INestApplication<App>;

  const trainingService = {
    getOverview: jest.fn(),
    listItems: jest.fn(),
    getItemDetail: jest.fn(),
    createManualItem: jest.fn(),
    scanInbox: jest.fn(),
    scanSystem: jest.fn(),
    generateSuggestions: jest.fn(),
    ignoreItem: jest.fn(),
    bulkIgnore: jest.fn(),
    bulkApprove: jest.fn(),
    reindex: jest.fn(),
    getAudit: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };

  const approvalService = {
    previewApproval: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AiTrainingController],
      providers: [
        { provide: AiTrainingService, useValue: trainingService },
        { provide: AiTrainingApprovalService, useValue: approvalService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req, _res, next) => {
      (req as { apiKey?: { id: string; name: string; role: ApiKeyRole } }).apiKey = {
        id: 'e2e-admin-key',
        name: 'E2E Admin',
        role: ApiKeyRole.ADMIN,
      };
      next();
    });
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

  it('GET /api/ai-training/overview returns KPI payload', async () => {
    trainingService.getOverview.mockResolvedValue({
      pendingQuestions: 4,
      highPriority: 1,
      approvedToday: 2,
      appliedKnowledge: 6,
      needsReindex: true,
      aiSuggestions: 3,
      urgentCount: 0,
    });

    const res = await request(app.getHttpServer()).get('/api/ai-training/overview').expect(200);

    expect(res.body.pendingQuestions).toBe(4);
    expect(res.body.needsReindex).toBe(true);
  });

  it('GET /api/ai-training/items lists training queue', async () => {
    trainingService.listItems.mockResolvedValue([
      {
        id: 'train-1',
        question: 'Mko wapi?',
        status: AiLearningItemStatus.PENDING_REVIEW,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/ai-training/items')
      .query({ status: 'pending_review' })
      .expect(200);

    expect(trainingService.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review' }),
    );
    expect(res.body[0].question).toBe('Mko wapi?');
  });

  it('GET /api/ai-training/audit returns audit rows', async () => {
    trainingService.getAudit.mockResolvedValue([
      {
        id: 'log-1',
        trainingItemId: 'train-1',
        action: 'applied',
        actorType: 'admin',
        actorId: 'admin-key',
        summary: 'Applied training to FAQ.md',
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app.getHttpServer()).get('/api/ai-training/audit').expect(200);

    expect(res.body[0].action).toBe('applied');
  });

  it('POST /api/ai-training/items/:id/preview-approval returns diff preview', async () => {
    approvalService.previewApproval.mockResolvedValue({
      targetFile: 'FAQ.md',
      targetSection: null,
      updateMode: 'append',
      oldContentPreview: '# FAQ',
      newContentPreview: '# FAQ\n\nLearned rule',
      warnings: [],
      requiresAdmin: false,
    });

    const res = await request(app.getHttpServer())
      .post('/api/ai-training/items/train-1/preview-approval')
      .send({ customAnswer: 'Tupo Dar.' })
      .expect(201);

    expect(approvalService.previewApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        trainingItemId: 'train-1',
        customAnswer: 'Tupo Dar.',
      }),
    );
    expect(res.body.newContentPreview).toContain('Learned');
  });

  it('POST /api/ai-training/items/bulk-approve forwards actor role to service', async () => {
    trainingService.bulkApprove.mockResolvedValue({
      approved: ['train-2'],
      skipped: [{ id: 'train-1', reason: 'High-risk item requires admin approval' }],
      failed: [],
    });

    const res = await request(app.getHttpServer())
      .post('/api/ai-training/items/bulk-approve')
      .send({
        ids: ['train-1', 'train-2'],
        applyNow: true,
        overrides: [{ id: 'train-2', customAnswer: 'Tupo Sinza.' }],
      })
      .expect(201);

    expect(trainingService.bulkApprove).toHaveBeenCalledWith(
      ['train-1', 'train-2'],
      'E2E Admin',
      ApiKeyRole.ADMIN,
      true,
      [{ id: 'train-2', customAnswer: 'Tupo Sinza.' }],
    );
    expect(res.body.approved).toEqual(['train-2']);
    expect(res.body.skipped[0].reason).toContain('admin');
  });
});
