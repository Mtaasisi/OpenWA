import { AiCustomerIntent } from '../ai-signal.enums';

jest.mock('../utils/ai-intent-detector.util', () => ({
  detectCustomerIntent: jest.fn(() => AiCustomerIntent.UNKNOWN),
}));

import { AiIntentLearningService } from './ai-intent-learning.service';
import { detectCustomerIntent } from '../utils/ai-intent-detector.util';

describe('AiIntentLearningService.tryClassifierBeforeAgent', () => {
  function makeService(classifierRaw: string | null) {
    const aiSettings = {
      getActiveConfig: jest.fn().mockResolvedValue({
        learnedReplyCacheEnabled: true,
        autoApproveConfidenceThreshold: 90,
        pendingReviewThreshold: 60,
        disableLearningForSensitive: true,
        autoLearnSafeIntents: true,
      }),
    };
    const aiChat = {
      completeStructuredPrompt: jest.fn().mockResolvedValue(classifierRaw),
    };
    const conversationFacts = { saveFact: jest.fn() };
    const unknownMessages = { upsert: jest.fn() };
    const learnedRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row: object) => row),
      save: jest.fn(async (row: object) => ({ id: 'new-1', ...row })),
    };

    return {
      service: new AiIntentLearningService(
        aiSettings as never,
        aiChat as never,
        conversationFacts as never,
        unknownMessages as never,
        learnedRepo as never,
      ),
      aiChat,
    };
  }

  beforeEach(() => {
    jest.mocked(detectCustomerIntent).mockReturnValue(AiCustomerIntent.UNKNOWN);
  });

  it('returns fast-path hit for safe high-confidence classifier result', async () => {
    const { service } = makeService(
      JSON.stringify({
        intent: 'greeting',
        suggested_reply: 'Mambo vipi Boss 😊',
        confidence: 95,
      }),
    );
    const result = await service.tryClassifierBeforeAgent({
      text: 'niaje boss',
    });
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.reply).toContain('Mambo');
      expect(result.intent).toBe('greeting');
    }
  });

  it('invokes classifier for short unknown text', async () => {
    const { service, aiChat } = makeService(null);
    const result = await service.tryClassifierBeforeAgent({ text: 'random short phrase' });
    expect(result.hit).toBe(false);
    expect(aiChat.completeStructuredPrompt).toHaveBeenCalled();
  });
});
