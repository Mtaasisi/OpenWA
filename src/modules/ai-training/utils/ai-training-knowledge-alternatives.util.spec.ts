import { buildTrainingAlternativeQuestions } from './ai-training-knowledge-alternatives.util';

describe('buildTrainingAlternativeQuestions', () => {
  it('collects normalized question and trigger phrases', () => {
    const alts = buildTrainingAlternativeQuestions(
      {
        question: 'Mko wapi?',
        normalizedQuestion: 'mko wapi boss',
        title: 'Location question',
        detectedIntent: 'store_location',
      },
      {
        customInstruction: 'TRIGGERS: mko wapi, uko wapi\nACTION: reply location',
        extraPhrases: ['Uko wapi leo?'],
      },
    );

    expect(alts).toEqual(
      expect.arrayContaining(['mko wapi boss', 'Location question', 'store_location', 'Uko wapi leo?']),
    );
  });

  it('dedupes against the primary question', () => {
    const alts = buildTrainingAlternativeQuestions({
      question: 'Mko wapi?',
      normalizedQuestion: 'mko wapi',
      title: null,
      detectedIntent: null,
    });
    expect(alts).toHaveLength(0);
  });
});
