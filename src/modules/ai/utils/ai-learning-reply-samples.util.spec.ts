import { pickReplySamplesForPrompt } from './ai-learning-reply-samples.util';
import type { LearnedReplySample } from './ai-learning-analyze.util';
import { AiCustomerIntent } from '../ai-signal.enums';

const samples: LearnedReplySample[] = [
  {
    customer: 'Mambo',
    staff: 'Mambo vipi Boss 😊 Karibu Inauzwa.',
    intent: AiCustomerIntent.GREETING,
  },
  {
    customer: 'iPhone 13 ipo?',
    staff: 'Ndio boss, iPhone 13 tunayo — bei Tsh 850,000. Unahitaji storage gani?',
    intent: AiCustomerIntent.STOCK_REQUEST,
  },
  {
    customer: 'Nitumie lipa namba',
    staff: 'Sawa boss, tumia lipa namba hii: 123456.',
    intent: AiCustomerIntent.PAYMENT_REQUEST,
  },
];

describe('pickReplySamplesForPrompt', () => {
  it('returns empty string when no samples', () => {
    expect(pickReplySamplesForPrompt('Mambo', [])).toBe('');
  });

  it('matches greeting intent samples', () => {
    const block = pickReplySamplesForPrompt('Mambo boss', samples);
    expect(block).toContain('Staff reply examples');
    expect(block).toContain('Mambo vipi Boss');
  });

  it('matches payment intent samples', () => {
    const block = pickReplySamplesForPrompt('Nitumie lipa namba', samples);
    expect(block).toContain('lipa namba');
    expect(block).not.toContain('iPhone 13');
  });

  it('matches product keyword overlap for product search', () => {
    const block = pickReplySamplesForPrompt('MacBook Pro bei gani', [
      ...samples,
      {
        customer: 'MacBook Pro mpya bei gani?',
        staff: 'MacBook Pro tunayo boss — niambie storage unayotaka.',
        intent: AiCustomerIntent.PRODUCT_SEARCH,
      },
    ]);
    expect(block.toLowerCase()).toContain('macbook');
  });
});
