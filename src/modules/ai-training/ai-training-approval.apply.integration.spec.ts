import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AiTrainingApprovalService } from './ai-training-approval.service';
import { AiTrainingKnowledgeWriterService } from './ai-training-knowledge-writer.service';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiLearningItemStatus } from '../ai/ai-learning.enums';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiTrainingApprovalStatus, AiTrainingUpdateMode } from './ai-training.types';

describe('AiTrainingApprovalService apply integration', () => {
  let tmpDir: string;
  let files: Map<string, string>;
  let knowledgeWriter: AiTrainingKnowledgeWriterService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openwa-approval-apply-'));
    fs.mkdirSync(path.join(tmpDir, 'backups'), { recursive: true });
    files = new Map([['FAQ.md', '# FAQ\n\n']]);

    const knowledgeFile = {
      readFile: jest.fn((rel: string) => {
        const content = files.get(rel);
        if (content == null) throw new Error(`Missing ${rel}`);
        return { content };
      }),
      writeFile: jest.fn((rel: string, content: string) => {
        files.set(rel, content);
        const abs = path.join(tmpDir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
      }),
    };

    knowledgeWriter = new AiTrainingKnowledgeWriterService(knowledgeFile as never, {
      get: jest.fn((key: string) => (key === 'ai.knowledgePath' ? tmpDir : undefined)),
    } as never);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createService() {
    const approvalRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => v),
      findOne: jest.fn(),
    };
    const suggestionRepo = { findOne: jest.fn(), find: jest.fn() };
    const items = {
      getItem: jest.fn(),
      updateItem: jest.fn(async (id: string, patch: unknown) => ({ id, ...(patch as object) })),
      rejectItem: jest.fn(),
    };
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        trainingCenterEnabled: true,
        requireAdminApproval: false,
        allowMarkdownWrites: true,
        allowMemoryWrites: true,
        maskPrivateDataInExports: true,
        autoReindexAfterApproval: false,
        autoReindexSmallUpdatesOnly: true,
      }),
    };
    const knowledge = { createFromApproval: jest.fn(async (input: unknown) => input) };
    const audit = { log: jest.fn() };
    const memoryWriter = { appendApprovedMemory: jest.fn() };
    const reindex = { maybeAutoReindex: jest.fn().mockResolvedValue(false), markStale: jest.fn() };
    const suggestions = { listForItem: jest.fn(), generateSuggestions: jest.fn() };
    const router = new AiTrainingRouterService();

    const svc = new AiTrainingApprovalService(
      approvalRepo as never,
      suggestionRepo as never,
      items as never,
      knowledge as never,
      settings as never,
      audit as never,
      knowledgeWriter,
      memoryWriter as never,
      reindex as never,
      router,
      suggestions as never,
    );

    return { svc, items, approvalRepo, knowledge };
  }

  it('apply writes markdown backup on disk and registers knowledge row', async () => {
    const { svc, items, approvalRepo, knowledge } = createService();
    approvalRepo.findOne.mockResolvedValue({
      id: 'ap-live-1',
      trainingItemId: 'train-live-1',
      customAnswer: 'Tupo Dar es Salaam Boss.',
      targetFile: 'FAQ.md',
      updateMode: AiTrainingUpdateMode.APPEND,
      status: AiTrainingApprovalStatus.APPROVED,
    });
    items.getItem.mockResolvedValue({
      id: 'train-live-1',
      question: 'Mko wapi?',
      normalizedQuestion: 'mko wapi boss',
      status: AiLearningItemStatus.APPROVED,
    });

    const result = await svc.apply('ap-live-1', 'admin-live', ApiKeyRole.ADMIN);

    expect(result.item.status).toBe(AiLearningItemStatus.APPLIED);
    expect(result.approval.fileBackupPath).toMatch(/^backups\//);
    expect(fs.readdirSync(path.join(tmpDir, 'backups')).length).toBeGreaterThan(0);
    expect(files.get('FAQ.md')).toContain('Tupo Dar es Salaam Boss.');
    expect(knowledge.createFromApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'train-live-1',
        approvedAnswer: 'Tupo Dar es Salaam Boss.',
        questionPattern: 'Mko wapi?',
        alternativeQuestions: ['mko wapi boss'],
      }),
    );
  });
});
