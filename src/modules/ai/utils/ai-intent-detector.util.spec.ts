import {
  detectCustomerIntent,
  isPresenceIntent,
  isPureGreeting,
} from './ai-intent-detector.util';
import { AiCustomerIntent } from '../ai-signal.enums';

describe('ai-intent-detector.util', () => {
  it('detects presence intent for online/availability messages', () => {
    expect(isPresenceIntent('Upo online now')).toBe(true);
    expect(isPresenceIntent('Uko hapo?')).toBe(true);
    expect(isPresenceIntent('Hello?')).toBe(true);
    expect(isPresenceIntent('Unajibu')).toBe(true);
    expect(isPresenceIntent('Unanijibu?')).toBe(true);
    expect(detectCustomerIntent('Upo online now')).toBe(AiCustomerIntent.PRESENCE);
  });

  it('does not treat presence as greeting', () => {
    expect(isPureGreeting('Upo online now')).toBe(false);
    expect(isPureGreeting('Hello?')).toBe(false);
  });

  it('still detects pure greetings', () => {
    expect(isPureGreeting('Mambo')).toBe(true);
    expect(isPureGreeting('Habari')).toBe(true);
    expect(isPureGreeting('Hi')).toBe(true);
    expect(isPureGreeting('Hello')).toBe(true);
    expect(isPureGreeting('Niaje')).toBe(true);
    expect(isPureGreeting('Niaje boss')).toBe(true);
    expect(detectCustomerIntent('Hi')).toBe(AiCustomerIntent.GREETING);
    expect(detectCustomerIntent('Niaje')).toBe(AiCustomerIntent.GREETING);
  });

  it('presence intent outranks greeting detection', () => {
    expect(detectCustomerIntent('Upo online now')).not.toBe(AiCustomerIntent.GREETING);
    expect(detectCustomerIntent('Hello?')).toBe(AiCustomerIntent.PRESENCE);
  });
});
