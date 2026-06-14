import { detectCustomerAiOptOut } from './ai-customer-opt-out.util';

describe('ai-customer-opt-out', () => {
  it('detects common opt-out phrases', () => {
    expect(detectCustomerAiOptOut('STOP')).toBe(true);
    expect(detectCustomerAiOptOut('stop replying')).toBe(true);
    expect(detectCustomerAiOptOut('hello there')).toBe(false);
  });
});
