import { shouldAskProfileQuestion } from './profile-question-planner.util';
import { ProfileQuestionKind } from '../customer-profile.enums';

const base = {
  hasName: false,
  hasCity: false,
  hasDeliveryPreference: false,
  hasBudget: false,
  hasUseCase: false,
  lastQuestionAsked: null,
  lastQuestionAskedAt: null,
  context: 'general' as const,
  customerAskedUrgentProductQuestion: false,
};

describe('profile-question-planner.util', () => {
  it('asks name in quote context when missing', () => {
    const plan = shouldAskProfileQuestion({ ...base, context: 'quote' });
    expect(plan?.kind).toBe(ProfileQuestionKind.NAME);
    expect(plan?.text).toMatch(/quote/i);
  });

  it('asks notify name question in notify context', () => {
    const plan = shouldAskProfileQuestion({ ...base, context: 'notify' });
    expect(plan?.kind).toBe(ProfileQuestionKind.NAME);
    expect(plan?.text).toMatch(/nikutambue/i);
  });

  it('skips when customer asked urgent product question', () => {
    expect(
      shouldAskProfileQuestion({
        ...base,
        context: 'quote',
        customerAskedUrgentProductQuestion: true,
      }),
    ).toBeNull();
  });

  it('asks delivery when name known and context is delivery', () => {
    const plan = shouldAskProfileQuestion({
      ...base,
      hasName: true,
      context: 'delivery',
    });
    expect(plan?.kind).toBe(ProfileQuestionKind.DELIVERY);
  });
});
