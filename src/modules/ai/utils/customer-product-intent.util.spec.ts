import {
  hasExplicitProductPurchaseIntent,
  isSelfIntroduction,
  isSocialOrObservationalMessage,
} from './customer-product-intent.util';

describe('customer-product-intent.util', () => {
  it('detects social/Instagram comments as non-purchase', () => {
    const msg = 'Nmeona umepost bag la mtaasisi pia umepost insta';
    expect(isSocialOrObservationalMessage(msg)).toBe(true);
    expect(hasExplicitProductPurchaseIntent(msg)).toBe(false);
  });

  it('detects self introduction as non-purchase', () => {
    expect(isSelfIntroduction('Naitwa Mtaasisi JR')).toBe(true);
    expect(hasExplicitProductPurchaseIntent('Naitwa Mtaasisi JR')).toBe(false);
  });

  it('detects explicit phone stock request', () => {
    expect(hasExplicitProductPurchaseIntent('Nataka simu zipo')).toBe(true);
  });

  it('detects explicit product ask', () => {
    expect(hasExplicitProductPurchaseIntent('Uko na macbook')).toBe(true);
    expect(hasExplicitProductPurchaseIntent('Bei ya laptop')).toBe(true);
  });
});
