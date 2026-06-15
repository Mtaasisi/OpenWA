import { AiTrainingRouterService } from './ai-training-router.service';
import { AiTrainingSuggestionActionType } from './ai-training.types';

describe('AiTrainingRouterService', () => {
  let router: AiTrainingRouterService;

  beforeEach(() => {
    router = new AiTrainingRouterService();
  });

  it('routes customer care number request to AI_REPLY_RULES and branch tools', () => {
    const result = router.route({ question: 'Naomba namba ya customer care' });
    expect(result.targetFiles).toContain('AI_REPLY_RULES.md');
    expect(result.useDbTool).toBe(true);
    expect(result.actionType).toBe(AiTrainingSuggestionActionType.UPDATE_RULE);
  });

  it('routes warranty questions to WARRANTY_RULES.md', () => {
    const result = router.route({ question: 'Warranty ipo?' });
    expect(result.targetFiles).toContain('WARRANTY_RULES.md');
    expect(result.actionType).toBe(AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE);
  });

  it('routes installment questions to INSTALLMENT_PRODUCT_RULES.md', () => {
    const result = router.route({ question: 'Naweza lipa kidogo kidogo?' });
    expect(result.targetFiles).toContain('INSTALLMENT_PRODUCT_RULES.md');
  });

  it('routes discount questions to DISCOUNT_ESCALATION_RULES.md', () => {
    const result = router.route({ question: 'Punguzo lipo?' });
    expect(result.targetFiles).toContain('DISCOUNT_ESCALATION_RULES.md');
  });

  it('routes product questions to PRODUCT_QA.md', () => {
    const result = router.route({
      question: 'Bei ya iPhone 14 ni ngapi?',
      issueType: 'missing_product_knowledge',
    });
    expect(result.targetFiles).toContain('PRODUCT_QA.md');
  });
});
