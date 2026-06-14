import {
  buildProductNotFoundFallbackReply,
  isBroadChargerQuery,
  isMacBookQuery,
  looksLikeProductQuery,
} from './product-not-found-fallback.util';
import { isPresenceIntent, isPureGreeting } from './ai-intent-detector.util';
import { shouldSendFullGreeting } from './ai-behavior.util';
import { MessageDirection } from '../../message/entities/message.entity';

describe('product-not-found-fallback.util', () => {
  it('MacBook query produces fallback text', () => {
    const reply = buildProductNotFoundFallbackReply('macbook', 'Uko na macbook');
    expect(reply.length).toBeGreaterThan(20);
    expect(reply.toLowerCase()).toContain('macbook');
  });

  it('Chaji asks charger type', () => {
    expect(isBroadChargerQuery('Chaji')).toBe(true);
    const reply = buildProductNotFoundFallbackReply('chaji', 'Chaji');
    expect(reply).toMatch(/iPhone|Type-C|laptop/i);
  });

  it('looksLikeProductQuery accepts product intents', () => {
    expect(looksLikeProductQuery('Uko na macbook')).toBe(true);
    expect(isMacBookQuery('macbook')).toBe(true);
    expect(looksLikeProductQuery('Hi')).toBe(false);
    expect(looksLikeProductQuery('Niaje')).toBe(false);
    expect(looksLikeProductQuery('Asante')).toBe(false);
    expect(looksLikeProductQuery('Nataka')).toBe(false);
    expect(looksLikeProductQuery('Bei gani')).toBe(false);
  });
});

describe('presence intent (Mchele fix)', () => {
  it('Upo online now is presence not greeting', () => {
    expect(isPresenceIntent('Upo online now')).toBe(true);
    expect(isPureGreeting('Upo online now')).toBe(false);
  });
});

describe('greeting repeat protection', () => {
  it('skips full greeting when customer already asked about product', () => {
    const sendFull = shouldSendFullGreeting({
      incomingText: 'Hi',
      isPureGreeting: true,
      messages: [
        {
          direction: MessageDirection.INCOMING,
          body: 'Nataka macbook',
          createdAt: new Date(),
        },
      ],
      greetingCooldownMinutes: 240,
    });
    expect(sendFull).toBe(false);
  });
});
