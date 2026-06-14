import { AiCustomerIntent } from '../ai-signal.enums';
import {
  detectCustomerIntent,
  isCasualChatMessage,
  isPureGreeting,
} from './ai-intent-detector.util';
import { looksLikeProductQuery } from './product-not-found-fallback.util';

/** Phrases that must never trigger product-not-found fast path. */
const MUST_NOT_BE_PRODUCT_QUERY = [
  'Niaje',
  'Niaje boss',
  'Asante',
  'Thanks',
  'Thank you',
  'Sawa boss',
  'Ok boss',
  'Hujambo',
  'Shwari',
  'Safi',
  'Fresh',
  'Hapana',
  'Ndio',
  'Ehee',
  'Cool',
  'Nice',
  'Poa',
  'Sawa',
  'Mambo',
  'Hi boss',
  'Good morning',
  'Bei gani',
  'Duka lipo wapi',
  'Punguza bei',
  'Upo online now',
  'ipo?',
  'Nataka',
  'Uko na',
  'Naitwa Mtaasisi JR',
  'Nmeona umepost bag la mtaasisi pia umepost insta',
  'Nimeona post yako ya Instagram',
];

/** Phrases that should trigger product-not-found when catalog has no match. */
const MUST_BE_PRODUCT_QUERY = [
  'Uko na macbook',
  'Nataka iPhone 15',
  'Macbook',
  'Chaji',
  'Bei ya laptop',
  'Nataka simu zipo',
  'Simu zipo',
];

describe('intent misfire audit', () => {
  for (const phrase of MUST_NOT_BE_PRODUCT_QUERY) {
    it(`does not treat "${phrase}" as product query`, () => {
      expect(looksLikeProductQuery(phrase)).toBe(false);
    });
  }

  for (const phrase of MUST_BE_PRODUCT_QUERY) {
    it(`treats "${phrase}" as product query`, () => {
      expect(looksLikeProductQuery(phrase)).toBe(true);
    });
  }

  it('classifies casual chat without product intent', () => {
    expect(isCasualChatMessage('Asante boss')).toBe(true);
    expect(isCasualChatMessage('Sawa boss')).toBe(true);
    expect(detectCustomerIntent('Hapana')).toBe(AiCustomerIntent.UNKNOWN);
    expect(isPureGreeting('Hujambo')).toBe(true);
  });
});
