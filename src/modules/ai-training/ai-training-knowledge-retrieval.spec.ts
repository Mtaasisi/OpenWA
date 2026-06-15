import { AiLearningKnowledgeService } from '../ai/ai-learning-knowledge.service';
import { AiLearningInboxService } from '../ai/ai-learning-inbox.service';
import { AiLearningKnowledgeStatus } from '../ai/ai-learning.enums';

const SESSION_ID = 'sess-training-01';
const CHAT_ID = '255700000002@c.us';

describe('Training knowledge retrieval', () => {
  it('findBestMatch returns training-applied knowledge for similar inbox questions', async () => {
    const trainingKnowledge = {
      id: 'k-training-1',
      questionPattern: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      status: AiLearningKnowledgeStatus.ACTIVE,
      sourceItemId: 'train-item-1',
      timesUsed: 4,
      alternativeQuestions: null,
    };

    const repo = {
      find: jest.fn(async () => [trainingKnowledge]),
    };
    const fileService = { appendApprovedKnowledge: jest.fn() };
    const knowledge = new AiLearningKnowledgeService(repo as never, fileService as never);

    const match = await knowledge.findBestMatch('Mko wapi boss?');
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThanOrEqual(0.65);
    expect(match!.knowledge.approvedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(match!.knowledge.sourceItemId).toBe('train-item-1');
  });

  it('findBestMatch honors lowered minScore for configurable training threshold', async () => {
    const trainingKnowledge = {
      id: 'k-training-2',
      questionPattern: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      status: AiLearningKnowledgeStatus.ACTIVE,
      sourceItemId: 'train-item-2',
      timesUsed: 1,
      alternativeQuestions: ['Uko wapi leo?'],
    };

    const repo = {
      find: jest.fn(async () => [trainingKnowledge]),
    };
    const fileService = { appendApprovedKnowledge: jest.fn() };
    const knowledge = new AiLearningKnowledgeService(repo as never, fileService as never);

    const strict = await knowledge.findBestMatch('dar wapi');
    expect(strict).toBeNull();

    const relaxed = await knowledge.findBestMatch('dar wapi', 0.5);
    expect(relaxed).not.toBeNull();
    expect(relaxed!.score).toBe(0.5);
  });

  it('decideBeforeAgent reuses training-applied knowledge before agent runs', async () => {
    const settingsService = {
      getSettings: jest.fn(async () => ({
        enableLearningDetection: true,
        highConfidenceThreshold: 0.8,
        mediumConfidenceThreshold: 0.5,
        defaultUnknownReply: 'Nipe muda kidogo Boss…',
      })),
    };

    const knowledge = {
      findBestMatch: jest.fn(async () => ({
        score: 0.91,
        knowledge: {
          id: 'k-training-1',
          approvedAnswer: 'Tupo Dar es Salaam Boss.',
          sourceItemId: 'train-item-1',
        },
      })),
      recordUsage: jest.fn(async () => undefined),
    };

    const trainingScan = {
      createFromLowConfidence: jest.fn(),
      createFromHumanReply: jest.fn(),
    };

    const service = new AiLearningInboxService(
      {} as never,
      knowledge as never,
      settingsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      trainingScan as never,
    );

    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi?');
    expect(result.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(result.sourceItemId).toBe('train-item-1');
    expect(result.shouldEscalateLowConfidence).toBe(false);
    expect(knowledge.recordUsage).toHaveBeenCalledWith('k-training-1');
  });
});
