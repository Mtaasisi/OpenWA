import { AiCustomerIntent } from '../ai-signal.enums';
import {
  buildRulesBlock,
  CORE_AI_REPLY_RULES,
  loadIntentPack,
} from './ai-reply-rule-packs';
import { resolveHistoryLimit } from '../cost/ai-context-optimizer.util';
import {
  estimateTokensFromBlocks,
  resolvePromptBudgetWarning,
} from './ai-prompt-token-estimator.util';

describe('ai-prompt-assembler (rule packs + budgets)', () => {
  it('greeting intent injects CORE + greeting pack only', () => {
    const block = buildRulesBlock(AiCustomerIntent.GREETING, 'Mambo');
    expect(block).toContain(CORE_AI_REPLY_RULES);
    expect(block).toContain(loadIntentPack('GREETING'));
    expect(block).not.toContain('search_products');
    expect(block.length).toBeLessThan(2500);
  });

  it('product intent injects product pack', () => {
    const block = buildRulesBlock(AiCustomerIntent.PRODUCT_SEARCH, 'Bei ya iPhone 14');
    expect(block).toContain('search_products');
    expect(block).not.toContain('AI_REPLY_RULES.md');
  });

  it('never includes deprecated full markdown file name', () => {
    const intents = [
      AiCustomerIntent.GREETING,
      AiCustomerIntent.PRODUCT_SEARCH,
      AiCustomerIntent.COMPLAINT,
      AiCustomerIntent.UNKNOWN,
    ];
    for (const intent of intents) {
      const block = buildRulesBlock(intent, 'test message');
      expect(block).not.toMatch(/AI_REPLY_RULES\.md/);
      expect(block).not.toMatch(/AI_REPLY_EXAMPLES\.md/);
    }
  });

  it('greeting history limit is 3; complex product intent allows 5', () => {
    expect(resolveHistoryLimit(AiCustomerIntent.GREETING)).toBe(3);
    expect(resolveHistoryLimit(AiCustomerIntent.PRODUCT_SEARCH)).toBe(5);
    expect(resolveHistoryLimit(AiCustomerIntent.COMPLAINT)).toBe(5);
  });

  it('warns when simple greeting prompt exceeds 500 token budget', () => {
    const breakdown = estimateTokensFromBlocks({
      rules: 'x'.repeat(2200),
      knowledge: '',
      history: '',
      tools: '',
      customerMessage: 'Mambo',
      crm: '',
      catalog: '',
      memory: '',
    });
    const warning = resolvePromptBudgetWarning(breakdown, 'greeting', {
      simpleBudget: 500,
      autoReplyBudget: 1500,
    });
    expect(warning).toBe('simple_exceeded');
    expect(breakdown.total_estimated_input_tokens).toBeGreaterThan(500);
  });
});
