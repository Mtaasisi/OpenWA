import {
  GREETING_ONLY_REPLY,
  PRESENCE_ACTIVE_REPLY,
  GREETING_REPEAT_REPLY,
  CONTEXT_CLARIFICATION_REPLY,
  isShortContextMessage,
  isTopicChangeMessage,
  isCompatibilityModelAnswer,
  isCompatibilityQuestion,
  isInternalReasoningLeak,
  redactStockForCustomer,
  sanitizeCustomerAiReply,
  mapCityToBranchId,
  pickBurstQuotedMessageId,
  pickPresenceReply,
  shouldSendFullGreeting,
  pickRepeatedGreetingReply,
  buildCompatibilityAckReply,
  buildOosAlternativesReply,
  buildSoftCityLocationReply,
} from './ai-behavior.util';
import { isPureGreeting } from './ai-intent-detector.util';
import { MessageDirection } from '../../message/entities/message.entity';

describe('ai-behavior.util', () => {
  it('pure greeting does not include product question', () => {
    expect(isPureGreeting('Mambo')).toBe(true);
    expect(GREETING_ONLY_REPLY).not.toMatch(/Unatafuta/i);
  });

  it('redacts stock counts from product tool payload', () => {
    const row = redactStockForCustomer({
      name: 'MacBook',
      quantity: 5,
      totalStock: 5,
      inStock: true,
      variants: [{ name: '128GB', quantity: 2, inStock: true }],
    });
    expect(row).not.toHaveProperty('quantity');
    expect(row).not.toHaveProperty('totalStock');
    expect(row).not.toHaveProperty('inStock');
    expect((row.variants as Array<Record<string, unknown>>)[0]).not.toHaveProperty('quantity');
    expect((row.variants as Array<Record<string, unknown>>)[0]).not.toHaveProperty('inStock');
  });

  it('sanitizes stock phrases from customer replies', () => {
    const raw =
      'MacBook — 2 in stock — TSh 1,200,000\nAnker Charger — out of stock | TSh 38,000';
    const clean = sanitizeCustomerAiReply(raw);
    expect(clean).not.toMatch(/in stock/i);
    expect(clean).not.toMatch(/out of stock/i);
  });

  it('strips hard OOS phrases like haipo from customer replies', () => {
    const clean = sanitizeCustomerAiReply('Haipo Boss, ila tuna LG charger.');
    expect(clean.toLowerCase()).not.toMatch(/\bhaipo\b/);
  });

  it('builds compatibility ack for accessory interest', () => {
    expect(buildCompatibilityAckReply('iPhone 14', 'USB-C charger')).toMatch(/inafaa/i);
  });

  it('builds OOS alternatives without saying haipo', () => {
    const reply = buildOosAlternativesReply('MacBook Air', [
      { name: 'MacBook Pro', sellingPrice: 1200000, currency: 'TSh' },
    ]);
    expect(reply).toMatch(/options/i);
    expect(reply.toLowerCase()).not.toMatch(/\bhaipo\b/);
  });

  it('soft city location reply re-confirms saved city', () => {
    expect(buildSoftCityLocationReply('Dar', 'Tuko Mwenge Plaza')).toMatch(/Si uko Dar Boss/i);
  });

  it('detects internal reasoning leaks', () => {
    expect(isInternalReasoningLeak('Let me wait for the customer')).toBe(true);
    expect(isInternalReasoningLeak('Kwa sasa haipo Boss, ila tuna LG')).toBe(false);
  });

  it('short ipo without context is detected', () => {
    expect(isShortContextMessage('ipo?')).toBe(true);
    expect(CONTEXT_CLARIFICATION_REPLY).toMatch(/nikumbushe/i);
  });

  it('hapana triggers topic change', () => {
    expect(isTopicChangeMessage('Hapana leo nataka charger')).toBe(true);
  });

  it('iPhone 14 after charger question is model answer', () => {
    expect(isCompatibilityQuestion('Simu yako ni iPhone au Android?')).toBe(true);
    expect(isCompatibilityModelAnswer('iPhone 14')).toBe(true);
  });

  it('maps Dar city to branch profile', () => {
    const id = mapCityToBranchId('Dar', [
      { branchId: 'dar-1', branchName: 'Dar es Salaam' },
      { branchId: 'aru-1', branchName: 'Arusha' },
    ]);
    expect(id).toBe('dar-1');
  });

  it('presence reply is not the welcome greeting', () => {
    const reply = pickPresenceReply({ incomingText: 'Upo online now', messages: [] });
    expect(reply).toBe(PRESENCE_ACTIVE_REPLY);
    expect(reply).not.toContain('Karibu Inauzwa');
  });

  it('hello in active chat uses short nipo reply not full greeting', () => {
    const now = Date.now();
    const messages = [
      {
        id: '1',
        body: GREETING_ONLY_REPLY,
        direction: MessageDirection.OUTGOING,
        type: 'text',
        timestamp: Math.floor((now - 120_000) / 1000),
        createdAt: new Date(now - 120_000),
        status: 'sent' as const,
      },
      {
        id: '2',
        body: 'Bei gani?',
        direction: MessageDirection.INCOMING,
        type: 'text',
        timestamp: Math.floor((now - 30_000) / 1000),
        createdAt: new Date(now - 30_000),
        status: 'sent' as const,
      },
    ];
    expect(pickPresenceReply({ incomingText: 'Hello', messages })).toBe(GREETING_REPEAT_REPLY);
  });

  it('picks latest or first burst message for quoted reply', () => {
    const messages = [{ id: 'wa-1' }, { id: 'wa-2' }, { id: 'wa-3' }];
    expect(pickBurstQuotedMessageId(messages, true)).toBe('wa-3');
    expect(pickBurstQuotedMessageId(messages, false)).toBe('wa-1');
  });

  it('does not repeat full greeting within cooldown', () => {
    const now = Date.now();
    const messages = [
      {
        id: '1',
        body: GREETING_ONLY_REPLY,
        direction: MessageDirection.OUTGOING,
        type: 'text',
        timestamp: Math.floor((now - 60_000) / 1000),
        createdAt: new Date(now - 60_000),
        status: 'sent' as const,
      },
    ];
    expect(
      shouldSendFullGreeting({
        incomingText: 'Hello',
        isPureGreeting: true,
        messages,
        greetingCooldownMinutes: 240,
      }),
    ).toBe(false);
    expect(pickRepeatedGreetingReply(messages)).toMatch(/Nipo Boss/i);
  });
});
