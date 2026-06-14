import { AiLearningOutcome } from '../ai-learning.enums';
import { bumpSuccessRate, detectLearningOutcome } from './ai-learning-outcome.util';

describe('ai-learning-outcome.util', () => {
  it('detects positive replies', () => {
    expect(detectLearningOutcome('Asante sana boss')).toBe(
      AiLearningOutcome.CUSTOMER_REPLIED_POSITIVELY,
    );
  });

  it('detects purchase intent', () => {
    expect(detectLearningOutcome('Nataka kununua leo')).toBe(
      AiLearningOutcome.CUSTOMER_BOUGHT,
    );
  });

  it('detects corrections', () => {
    expect(detectLearningOutcome('Sio hiyo bei')).toBe(
      AiLearningOutcome.STAFF_CORRECTED_LATER,
    );
  });

  it('treats very short text as ignored', () => {
    expect(detectLearningOutcome('x')).toBe(AiLearningOutcome.CUSTOMER_IGNORED);
  });

  it('bumps success rate up on positive outcomes', () => {
    expect(
      bumpSuccessRate(0.5, AiLearningOutcome.CUSTOMER_REPLIED_POSITIVELY),
    ).toBeCloseTo(0.55);
  });

  it('bumps success rate down on poor performance', () => {
    expect(bumpSuccessRate(0.5, AiLearningOutcome.POOR_PERFORMANCE)).toBeCloseTo(0.4);
  });
});
