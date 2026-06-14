import {
  AiHumanTimingService,
  AI_ACTIVE_CHAT_WINDOW_MS,
  buildBurstCombinedText,
  computeBurstWaitMs,
  computeTypingDurationMs,
  computeWaitBeforeProcessingMs,
  detectBaseConversationState,
  detectConversationActivity,
  filterMessagesBeforeBurst,
  humanTimingConfigFromAiConfig,
  humanTimingPresetForStyle,
  INSTANT_BURST_DEBOUNCE_MS,
} from './ai-human-timing.service';
import { MessageDirection } from '../../message/entities/message.entity';
import type { AiConfig } from '../entities/ai-config.entity';
import {
  GREETING_ONLY_REPLY,
  GREETING_REPEAT_REPLY,
  PRESENCE_ACTIVE_REPLY,
  pickPresenceReply,
  pickRepeatedGreetingReply,
  shouldSendFullGreeting,
} from '../utils/ai-behavior.util';
import { isPureGreeting } from '../utils/ai-intent-detector.util';

const balancedPreset = humanTimingPresetForStyle('balanced');

const baseConfig = humanTimingConfigFromAiConfig({
  humanTimingEnabled: true,
  humanReplyStyle: 'balanced',
  ...balancedPreset,
  burstPauseMinMs: balancedPreset.coldBurstPauseMinMs,
  burstPauseMaxMs: balancedPreset.coldBurstPauseMaxMs,
} as AiConfig);

function msg(
  body: string,
  direction: MessageDirection,
  ageMs: number,
  id = '1',
) {
  const now = Date.now();
  return {
    id,
    body,
    direction,
    type: 'text',
    timestamp: Math.floor((now - ageMs) / 1000),
    createdAt: new Date(now - ageMs),
    status: 'sent' as const,
  };
}

describe('ai-human-timing.service', () => {
  const service = new AiHumanTimingService();

  it('1. cold first message waits 7000–12000ms', () => {
    expect(detectConversationActivity([], { firstMessageAt: Date.now(), lastMessageAt: Date.now(), messageCount: 1 })).toBe(
      'cold_conversation',
    );
    const wait = computeWaitBeforeProcessingMs('cold_conversation', baseConfig);
    expect(wait).toBeGreaterThanOrEqual(7000);
    expect(wait).toBeLessThanOrEqual(12000);
  });

  it('2. active follow-up waits 800–2500ms after recent AI reply', () => {
    const messages = [
      msg('Ndiyo Boss ipo 😊', MessageDirection.OUTGOING, 30_000),
      msg('Bei gani?', MessageDirection.INCOMING, 5_000),
    ];
    const burst = { firstMessageAt: Date.now(), lastMessageAt: Date.now(), messageCount: 1 };
    expect(detectConversationActivity(messages, burst)).toBe('active_conversation');
    const wait = computeWaitBeforeProcessingMs('active_conversation', baseConfig);
    expect(wait).toBeGreaterThanOrEqual(800);
    expect(wait).toBeLessThanOrEqual(2500);
  });

  it('3. presence in active chat uses fast active wait and reply text', () => {
    const now = Date.now();
    const messages = [
      msg('Ndiyo Boss ipo 😊', MessageDirection.OUTGOING, 60_000),
    ];
    const decision = service.decideProcessingWait({
      config: baseConfig,
      messages,
      burst: { firstMessageAt: now, lastMessageAt: now, messageCount: 1 },
      incomingText: 'Upo online now',
    });
    expect(decision.reason).toBe('presence_active_fast');
    expect(decision.waitBeforeProcessingMs).toBeGreaterThanOrEqual(800);
    expect(decision.waitBeforeProcessingMs).toBeLessThanOrEqual(2500);
    const reply = pickPresenceReply({ incomingText: 'Upo online now', messages });
    expect(reply).toBe(PRESENCE_ACTIVE_REPLY);
    expect(reply).not.toContain('Karibu Inauzwa');
  });

  it('4. greeting in active chat uses short reply not full welcome', () => {
    const messages = [
      msg(GREETING_ONLY_REPLY, MessageDirection.OUTGOING, 120_000),
      msg('Ndiyo Boss ipo', MessageDirection.OUTGOING, 60_000),
    ];
    expect(
      shouldSendFullGreeting({
        incomingText: 'Hello',
        isPureGreeting: isPureGreeting('Hello'),
        messages,
        greetingCooldownMinutes: 240,
      }),
    ).toBe(false);
    expect(pickRepeatedGreetingReply(messages)).toBe(GREETING_REPEAT_REPLY);
  });

  it('5. burst active waits active burst pause after last message', () => {
    const messages = [msg('Ndiyo Boss ipo', MessageDirection.OUTGOING, 45_000)];
    const burst = {
      firstMessageAt: Date.now() - 2000,
      lastMessageAt: Date.now(),
      messageCount: 3,
    };
    expect(detectConversationActivity(messages, burst)).toBe('burst_messages');
    const wait = computeBurstWaitMs(burst, baseConfig, 'active_conversation', false);
    expect(wait).toBeGreaterThanOrEqual(3500);
    expect(wait).toBeLessThanOrEqual(7000);
    const combined = buildBurstCombinedText(['Uko na iPhone?', 'Bei gani?', 'Warranty?']);
    expect(combined).toContain('3. Warranty?');
  });

  it('6. burst cold waits cold burst pause after last message', () => {
    const burst = {
      firstMessageAt: Date.now() - 3000,
      lastMessageAt: Date.now(),
      messageCount: 3,
    };
    const wait = computeBurstWaitMs(burst, baseConfig, 'cold_conversation', false);
    expect(wait).toBeGreaterThanOrEqual(6000);
    expect(wait).toBeLessThanOrEqual(9000);
  });

  it('7. typing duration scales with reply length and respects bounds', () => {
    const short = computeTypingDurationMs('Nipo Boss 😊', baseConfig);
    const medium = computeTypingDurationMs(
      'Hii ni jibu la kati lenye maelezo kidogo kuhusu bei na warranty ya iPhone 15 Pro Max na variant zake zote.',
      baseConfig,
    );
    const long = computeTypingDurationMs(
      'Hii ni jibu refu sana lenye maelezo mengi kuhusu MacBook Air na bei zake pamoja na variant zote zinazopatikana kwenye duka letu la Dar na Arusha kwa sasa na warranty details pamoja na delivery options na payment methods na trade-in policy na student discount na corporate sales na bulk pricing na extended warranty na screen protector bundle na original adapter na charging cable na laptop bag offer.',
      baseConfig,
    );
    expect(short).toBeGreaterThanOrEqual(1200);
    expect(short).toBeLessThanOrEqual(2200);
    expect(medium).toBeGreaterThanOrEqual(2500);
    expect(medium).toBeLessThanOrEqual(5000);
    expect(long).toBeGreaterThanOrEqual(5000);
    expect(long).toBeLessThanOrEqual(14000);
  });

  it('excludes current burst from activity detection (first message is cold not active)', () => {
    const now = Date.now();
    const messages = [msg('Uko na iPhone 15?', MessageDirection.INCOMING, 0)];
    const burst = { firstMessageAt: now, lastMessageAt: now, messageCount: 1 };
    const prior = filterMessagesBeforeBurst(messages, burst);
    expect(prior).toHaveLength(0);
    expect(detectBaseConversationState(prior)).toBe('cold_conversation');
  });

  it('warm conversation uses 2500–6000ms wait', () => {
    const wait = computeWaitBeforeProcessingMs('warm_conversation', baseConfig);
    expect(wait).toBeGreaterThanOrEqual(2500);
    expect(wait).toBeLessThanOrEqual(6000);
  });

  it('burst caps wait at maxBurstWaitMs elapsed', () => {
    const burst = {
      firstMessageAt: Date.now() - 29_500,
      lastMessageAt: Date.now(),
      messageCount: 4,
    };
    const wait = computeBurstWaitMs(burst, baseConfig, 'cold_conversation', false);
    expect(wait).toBeLessThanOrEqual(500);
  });

  it('fast preset uses shorter cold first-message range', () => {
    const fast = humanTimingPresetForStyle('fast');
    expect(fast.coldChatWaitMinMs).toBe(5000);
    expect(fast.activeChatWaitMaxMs).toBe(1500);
  });

  it('instant mode uses 0ms wait for a single message', () => {
    const instantConfig = humanTimingConfigFromAiConfig({
      humanTimingEnabled: false,
      humanReplyStyle: 'fast',
    } as AiConfig);
    const decision = service.decideProcessingWait({
      config: instantConfig,
      messages: [],
      burst: { firstMessageAt: Date.now(), lastMessageAt: Date.now(), messageCount: 1 },
      incomingText: 'Bei gani?',
    });
    expect(decision.waitBeforeProcessingMs).toBe(0);
    expect(decision.reason).toBe('instant');
  });

  it('instant mode uses burst debounce for rapid multi-message bursts', () => {
    const instantConfig = humanTimingConfigFromAiConfig({
      humanTimingEnabled: false,
      humanReplyStyle: 'fast',
    } as AiConfig);
    const decision = service.decideProcessingWait({
      config: instantConfig,
      messages: [],
      burst: { firstMessageAt: Date.now(), lastMessageAt: Date.now(), messageCount: 3 },
      incomingText: 'Hello',
    });
    expect(decision.waitBeforeProcessingMs).toBe(INSTANT_BURST_DEBOUNCE_MS);
    expect(decision.reason).toBe('instant_burst_debounce');
  });

  it('instant mode skips typing simulation', () => {
    const instantConfig = humanTimingConfigFromAiConfig({
      humanTimingEnabled: false,
      humanReplyStyle: 'fast',
    } as AiConfig);
    const typing = service.decideTyping({
      config: instantConfig,
      replyText: 'Ndiyo Boss ipo 😊',
    });
    expect(typing.typingDurationMs).toBe(0);
    expect(typing.shouldShowTyping).toBe(false);
  });
});
