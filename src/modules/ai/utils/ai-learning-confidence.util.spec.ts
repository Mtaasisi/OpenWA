import {
  classifyConfidenceBand,
  computeConfidenceScore,
  normalizeQuestion,
  questionSimilarity,
  knowledgeAutoReplyThreshold,
} from './ai-learning-confidence.util';

describe('ai-learning-confidence.util', () => {
  it('normalizes questions', () => {
    expect(normalizeQuestion('  Hello, Boss!  ')).toBe('hello boss');
  });

  it('computes higher score with knowledge match', () => {
    const low = computeConfidenceScore({ ragMatchScore: 0.3 });
    const high = computeConfidenceScore({ ragMatchScore: 0.3, knowledgeMatchScore: 0.9 });
    expect(high).toBeGreaterThan(low);
  });

  it('classifies confidence bands', () => {
    expect(
      classifyConfidenceBand(0.85, { highConfidenceThreshold: 0.8, mediumConfidenceThreshold: 0.5 }),
    ).toBe('high');
    expect(
      classifyConfidenceBand(0.6, { highConfidenceThreshold: 0.8, mediumConfidenceThreshold: 0.5 }),
    ).toBe('medium');
    expect(
      classifyConfidenceBand(0.2, { highConfidenceThreshold: 0.8, mediumConfidenceThreshold: 0.5 }),
    ).toBe('low');
  });

  it('detects similar questions', () => {
    expect(
      questionSimilarity('iphone 13 price', 'what is iphone 13 price'),
    ).toBeGreaterThan(0.5);
  });

  it('boosts score when the shorter question is fully contained', () => {
    expect(questionSimilarity('Mko wapi boss?', 'Mko wapi?')).toBeGreaterThanOrEqual(0.72);
  });

  it('uses lower threshold for training-sourced knowledge', () => {
    expect(
      knowledgeAutoReplyThreshold({ sourceItemId: 'train-1' }, { highConfidenceThreshold: 0.8, trainingKnowledgeMatchThreshold: 0.65 }),
    ).toBe(0.65);
    expect(
      knowledgeAutoReplyThreshold({ sourceItemId: null }, { highConfidenceThreshold: 0.8, trainingKnowledgeMatchThreshold: 0.65 }),
    ).toBe(0.8);
  });

  it('clamps training threshold to high confidence ceiling', () => {
    expect(
      knowledgeAutoReplyThreshold(
        { sourceItemId: 'train-1' },
        { highConfidenceThreshold: 0.7, trainingKnowledgeMatchThreshold: 0.75 },
      ),
    ).toBe(0.7);
  });
});
