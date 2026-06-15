import { resolveThreadSearchMatchReason } from './inbox-search-match.util';

describe('resolveThreadSearchMatchReason', () => {
  it('prefers display name over last message', () => {
    expect(
      resolveThreadSearchMatchReason(
        'juma',
        { displayName: 'Juma Trader', chatId: '255@c.us', lastPreview: 'hello juma' },
      ),
    ).toBe('display_name');
  });

  it('detects customer phone match', () => {
    expect(
      resolveThreadSearchMatchReason(
        '255700',
        { displayName: 'Boss', chatId: '255700000001@c.us', lastPreview: 'hi' },
        { customerName: 'Boss', customerPhone: '255700000001' } as never,
      ),
    ).toBe('customer_phone');
  });

  it('detects product interest from followup', () => {
    expect(
      resolveThreadSearchMatchReason(
        'macbook',
        { displayName: 'Boss', chatId: 'x@c.us', lastPreview: 'hi' },
        null,
        { customerName: 'Boss', productInterest: 'MacBook Air' },
      ),
    ).toBe('product_interest');
  });
});
