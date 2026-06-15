import { AiLearningKnowledgeService } from '../ai/ai-learning-knowledge.service';
import { AiLearningInboxService } from '../ai/ai-learning-inbox.service';
import { AiLearningKnowledgeStatus } from '../ai/ai-learning.enums';
import type { AiLearningKnowledge } from '../ai/entities/ai-learning-knowledge.entity';

const SESSION_ID = 'sess-flow-01';
const CHAT_ID = '255700000003@c.us';

function createInMemoryKnowledgeService() {
  const rows: AiLearningKnowledge[] = [];
  let seq = 0;
  const repo = {
    create: jest.fn((input: Partial<AiLearningKnowledge>) => ({ ...input })),
    save: jest.fn(async (input: Partial<AiLearningKnowledge>) => {
      const saved = {
        id: `k-${++seq}`,
        timesUsed: 0,
        successRate: null,
        alternativeQuestions: null,
        category: null,
        targetFile: 'FAQ.md',
        approvedBy: null,
        approvedAt: new Date(),
        reviewDate: null,
        sessionId: null,
        chatId: null,
        sourceItemId: null,
        internalNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: AiLearningKnowledgeStatus.ACTIVE,
        ...input,
      } as AiLearningKnowledge;
      rows.push(saved);
      return saved;
    }),
    find: jest.fn(async () => rows.filter(row => row.status === AiLearningKnowledgeStatus.ACTIVE)),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      rows.find(row => row.id === where.id) ?? null,
    ),
    increment: jest.fn(async ({ id }: { id: string }, _field: string, amount: number) => {
      const row = rows.find(item => item.id === id);
      if (row) row.timesUsed += amount;
    }),
    update: jest.fn(async (id: string, patch: Partial<AiLearningKnowledge>) => {
      const row = rows.find(item => item.id === id);
      if (row) Object.assign(row, patch);
    }),
  };
  const fileService = { appendApprovedKnowledge: jest.fn() };
  const service = new AiLearningKnowledgeService(repo as never, fileService as never);
  return { service, rows };
}

describe('Training apply → inbox retrieval flow', () => {
  it('registers applied training knowledge and reuses it on the next similar question', async () => {
    const { service: knowledge, rows } = createInMemoryKnowledgeService();

    await knowledge.createFromApproval({
      questionPattern: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      approvedBy: 'admin-1',
      sourceItemId: 'train-flow-1',
      writeToFile: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceItemId).toBe('train-flow-1');

    const settingsService = {
      getSettings: jest.fn(async () => ({
        enableLearningDetection: true,
        highConfidenceThreshold: 0.8,
        mediumConfidenceThreshold: 0.5,
        defaultUnknownReply: 'Nipe muda kidogo Boss…',
      })),
    };
    const trainingScan = {
      createFromLowConfidence: jest.fn(),
      createFromHumanReply: jest.fn(),
    };

    const inbox = new AiLearningInboxService(
      {} as never,
      knowledge as never,
      settingsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      trainingScan as never,
    );

    const first = await inbox.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi?');
    expect(first.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(first.sourceItemId).toBe('train-flow-1');
    expect(first.shouldEscalateLowConfidence).toBe(false);

    const paraphrase = await inbox.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi boss?');
    expect(paraphrase.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(paraphrase.sourceItemId).toBe('train-flow-1');

    const second = await inbox.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi?');
    expect(second.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(rows[0].timesUsed).toBeGreaterThanOrEqual(1);
  });

  it('does not reuse applied knowledge when similarity is too low', async () => {
    const { service: knowledge } = createInMemoryKnowledgeService();
    await knowledge.createFromApproval({
      questionPattern: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      sourceItemId: 'train-flow-2',
      writeToFile: false,
    });

    const settingsService = {
      getSettings: jest.fn(async () => ({
        enableLearningDetection: true,
        highConfidenceThreshold: 0.8,
        mediumConfidenceThreshold: 0.5,
        defaultUnknownReply: 'Nipe muda kidogo Boss…',
      })),
    };
    const inbox = new AiLearningInboxService(
      {} as never,
      knowledge as never,
      settingsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { createFromLowConfidence: jest.fn(), createFromHumanReply: jest.fn() } as never,
    );

    const result = await inbox.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Bei ya simu?', 0.1);
    expect(result.useApprovedAnswer).toBeNull();
    expect(result.shouldEscalateLowConfidence).toBe(true);
  });

  it('reuses training knowledge when admin lowers trainingKnowledgeMatchThreshold', async () => {
    const { service: knowledge } = createInMemoryKnowledgeService();
    await knowledge.createFromApproval({
      questionPattern: 'Mko wapi?',
      alternativeQuestions: ['Uko wapi leo?'],
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      sourceItemId: 'train-flow-3',
      writeToFile: false,
    });

    const settingsService = {
      getSettings: jest.fn(async () => ({
        enableLearningDetection: true,
        highConfidenceThreshold: 0.8,
        mediumConfidenceThreshold: 0.5,
        trainingKnowledgeMatchThreshold: 0.5,
        defaultUnknownReply: 'Nipe muda kidogo Boss…',
      })),
    };
    const inbox = new AiLearningInboxService(
      {} as never,
      knowledge as never,
      settingsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { createFromLowConfidence: jest.fn(), createFromHumanReply: jest.fn() } as never,
    );

    const result = await inbox.decideBeforeAgent(SESSION_ID, CHAT_ID, 'dar wapi', 0.1);
    expect(result.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(result.sourceItemId).toBe('train-flow-3');
    expect(result.shouldEscalateLowConfidence).toBe(false);
  });
});
