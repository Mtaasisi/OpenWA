import { Injectable } from '@nestjs/common';
import type { AiConfig } from '../entities/ai-config.entity';
import type { ChatMessageForAi } from '../../message/message.service';
import { MessageDirection } from '../../message/entities/message.entity';
import { isPresenceIntent } from '../utils/ai-intent-detector.util';

export const AI_RULES_VERSION = '2026-06-customer-reply-safety-v1';

/** Short debounce when human timing is off so rapid bursts still coalesce. */
export const INSTANT_BURST_DEBOUNCE_MS = 200;

export const AI_ACTIVE_CHAT_WINDOW_MS = 5 * 60 * 1000;
export const AI_WARM_CHAT_WINDOW_MS = 30 * 60 * 1000;

export type ConversationActivityState =
  | 'active_conversation'
  | 'warm_conversation'
  | 'cold_conversation'
  | 'burst_messages';

export type HumanReplyStyle = 'fast' | 'balanced' | 'careful';

export interface HumanTimingConfig {
  humanTimingEnabled: boolean;
  activeChatWaitMinMs: number;
  activeChatWaitMaxMs: number;
  warmChatWaitMinMs: number;
  warmChatWaitMaxMs: number;
  coldChatWaitMinMs: number;
  coldChatWaitMaxMs: number;
  activeBurstPauseMinMs: number;
  activeBurstPauseMaxMs: number;
  coldBurstPauseMinMs: number;
  coldBurstPauseMaxMs: number;
  maxBurstWaitMs: number;
  typingMinMs: number;
  typingMaxMs: number;
  typingCharsPerSecondMin: number;
  typingCharsPerSecondMax: number;
  typingComplexityExtraMs: number;
  noTypingDuringDebounce: boolean;
  humanReplyStyle: HumanReplyStyle;
}

export interface HumanTimingDecision {
  waitBeforeProcessingMs: number;
  burstPauseMs: number;
  typingDurationMs: number;
  shouldShowTyping: boolean;
  reason: string;
  conversationState: ConversationActivityState;
}

export interface BurstState {
  firstMessageAt: number;
  lastMessageAt: number;
  messageCount: number;
}

export interface HumanTimingPresetValues {
  activeChatWaitMinMs: number;
  activeChatWaitMaxMs: number;
  warmChatWaitMinMs: number;
  warmChatWaitMaxMs: number;
  coldChatWaitMinMs: number;
  coldChatWaitMaxMs: number;
  activeBurstPauseMinMs: number;
  activeBurstPauseMaxMs: number;
  coldBurstPauseMinMs: number;
  coldBurstPauseMaxMs: number;
}

function randomBetween(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function messageTimestampMs(m: ChatMessageForAi): number {
  if (m.timestamp != null) return m.timestamp * 1000;
  return m.createdAt.getTime();
}

export function humanTimingPresetForStyle(style: HumanReplyStyle): HumanTimingPresetValues {
  switch (style) {
    case 'fast':
      return {
        activeChatWaitMinMs: 500,
        activeChatWaitMaxMs: 1500,
        warmChatWaitMinMs: 1500,
        warmChatWaitMaxMs: 4000,
        coldChatWaitMinMs: 5000,
        coldChatWaitMaxMs: 9000,
        activeBurstPauseMinMs: 2500,
        activeBurstPauseMaxMs: 5000,
        coldBurstPauseMinMs: 4500,
        coldBurstPauseMaxMs: 7500,
      };
    case 'careful':
      return {
        activeChatWaitMinMs: 1500,
        activeChatWaitMaxMs: 4000,
        warmChatWaitMinMs: 5000,
        warmChatWaitMaxMs: 9000,
        coldChatWaitMinMs: 10000,
        coldChatWaitMaxMs: 18000,
        activeBurstPauseMinMs: 5000,
        activeBurstPauseMaxMs: 9000,
        coldBurstPauseMinMs: 8000,
        coldBurstPauseMaxMs: 12000,
      };
    default:
      return {
        activeChatWaitMinMs: 800,
        activeChatWaitMaxMs: 2500,
        warmChatWaitMinMs: 2500,
        warmChatWaitMaxMs: 6000,
        coldChatWaitMinMs: 7000,
        coldChatWaitMaxMs: 12000,
        activeBurstPauseMinMs: 3500,
        activeBurstPauseMaxMs: 7000,
        coldBurstPauseMinMs: 6000,
        coldBurstPauseMaxMs: 9000,
      };
  }
}

export function humanTimingConfigFromAiConfig(config: AiConfig): HumanTimingConfig {
  const style = (config.humanReplyStyle as HumanReplyStyle) ?? 'fast';
  const preset = humanTimingPresetForStyle(style);
  return {
    humanTimingEnabled: config.humanTimingEnabled === true,
    activeChatWaitMinMs: config.activeChatWaitMinMs ?? preset.activeChatWaitMinMs,
    activeChatWaitMaxMs: config.activeChatWaitMaxMs ?? preset.activeChatWaitMaxMs,
    warmChatWaitMinMs: config.warmChatWaitMinMs ?? preset.warmChatWaitMinMs,
    warmChatWaitMaxMs: config.warmChatWaitMaxMs ?? preset.warmChatWaitMaxMs,
    coldChatWaitMinMs: config.coldChatWaitMinMs ?? preset.coldChatWaitMinMs,
    coldChatWaitMaxMs: config.coldChatWaitMaxMs ?? preset.coldChatWaitMaxMs,
    activeBurstPauseMinMs:
      (config as AiConfig & { activeBurstPauseMinMs?: number }).activeBurstPauseMinMs ??
      preset.activeBurstPauseMinMs,
    activeBurstPauseMaxMs:
      (config as AiConfig & { activeBurstPauseMaxMs?: number }).activeBurstPauseMaxMs ??
      preset.activeBurstPauseMaxMs,
    coldBurstPauseMinMs: config.burstPauseMinMs ?? preset.coldBurstPauseMinMs,
    coldBurstPauseMaxMs: config.burstPauseMaxMs ?? preset.coldBurstPauseMaxMs,
    maxBurstWaitMs: config.maxBurstWaitMs ?? 30000,
    typingMinMs: config.typingMinMs ?? 1200,
    typingMaxMs: config.typingMaxMs ?? 14000,
    typingCharsPerSecondMin: config.typingCharsPerSecondMin ?? 18,
    typingCharsPerSecondMax: config.typingCharsPerSecondMax ?? 35,
    typingComplexityExtraMs: config.typingComplexityExtraMs ?? 2500,
    noTypingDuringDebounce: config.noTypingDuringDebounce !== false,
    humanReplyStyle: style,
  };
}

/** Messages saved before the current inbound burst (excludes burst window). */
export function filterMessagesBeforeBurst(
  messages: ChatMessageForAi[],
  burst?: BurstState | null,
): ChatMessageForAi[] {
  if (!burst) return messages;
  return messages.filter(m => {
    const t = messageTimestampMs(m);
    if (
      m.direction === MessageDirection.INCOMING &&
      t >= burst.firstMessageAt - 2000 &&
      t <= burst.lastMessageAt + 2000
    ) {
      return false;
    }
    return true;
  });
}

export function detectBaseConversationState(
  priorMessages: ChatMessageForAi[],
): Exclude<ConversationActivityState, 'burst_messages'> {
  const now = Date.now();
  const withBody = priorMessages.filter(m => m.body?.trim());

  if (withBody.length === 0) return 'cold_conversation';

  const outboundTimes = withBody
    .filter(m => m.direction === MessageDirection.OUTGOING)
    .map(messageTimestampMs);
  const hasOutbound = outboundTimes.length > 0;

  if (!hasOutbound) return 'cold_conversation';

  const lastOutboundAt = Math.max(...outboundTimes);
  const lastAnyAt = Math.max(...withBody.map(messageTimestampMs));
  const outboundAgeMs = now - lastOutboundAt;
  const lastActivityAgeMs = now - lastAnyAt;

  if (
    outboundAgeMs <= AI_ACTIVE_CHAT_WINDOW_MS ||
    lastActivityAgeMs <= AI_ACTIVE_CHAT_WINDOW_MS
  ) {
    return 'active_conversation';
  }
  if (lastActivityAgeMs <= AI_WARM_CHAT_WINDOW_MS) return 'warm_conversation';
  return 'cold_conversation';
}

export function detectConversationActivity(
  messages: ChatMessageForAi[],
  burst?: BurstState | null,
): ConversationActivityState {
  const prior = filterMessagesBeforeBurst(messages, burst);
  const base = detectBaseConversationState(prior);

  if (burst && burst.messageCount > 1) return 'burst_messages';
  return base;
}

export function computeBurstWaitMs(
  burst: BurstState,
  config: HumanTimingConfig,
  baseState: Exclude<ConversationActivityState, 'burst_messages'>,
  presenceFastPath: boolean,
): number {
  const elapsed = Date.now() - burst.firstMessageAt;
  if (elapsed >= config.maxBurstWaitMs) return 0;

  const isActiveBase = baseState === 'active_conversation';
  const minMs = isActiveBase ? config.activeBurstPauseMinMs : config.coldBurstPauseMinMs;
  const maxMs = isActiveBase ? config.activeBurstPauseMaxMs : config.coldBurstPauseMaxMs;

  if (presenceFastPath && isActiveBase) {
    return randomBetween(config.activeChatWaitMinMs, config.activeChatWaitMaxMs);
  }

  const pauseWait = randomBetween(minMs, maxMs);
  const capped = Math.min(pauseWait, config.maxBurstWaitMs - elapsed);
  return Math.max(0, capped);
}

export function computeWaitBeforeProcessingMs(
  state: Exclude<ConversationActivityState, 'burst_messages'>,
  config: HumanTimingConfig,
  options?: { presenceFastPath?: boolean },
): number {
  if (options?.presenceFastPath && state === 'active_conversation') {
    return randomBetween(config.activeChatWaitMinMs, config.activeChatWaitMaxMs);
  }

  switch (state) {
    case 'active_conversation':
      return randomBetween(config.activeChatWaitMinMs, config.activeChatWaitMaxMs);
    case 'warm_conversation':
      return randomBetween(config.warmChatWaitMinMs, config.warmChatWaitMaxMs);
    default:
      return randomBetween(config.coldChatWaitMinMs, config.coldChatWaitMaxMs);
  }
}

export function computeTypingDurationMs(
  replyText: string,
  config: HumanTimingConfig,
  options?: { hasComplexLookup?: boolean },
): number {
  const len = replyText.trim().length;
  let base: number;

  if (len < 60) {
    base = randomBetween(1200, 2200);
  } else if (len <= 180) {
    base = randomBetween(2500, 5000);
  } else if (len <= 400) {
    base = randomBetween(5000, 9000);
  } else {
    const cps = randomBetween(config.typingCharsPerSecondMin, config.typingCharsPerSecondMax);
    base = Math.round((len / cps) * 1000);
  }

  if (options?.hasComplexLookup) {
    base += randomBetween(1500, config.typingComplexityExtraMs + 1000);
  }

  return Math.min(config.typingMaxMs, Math.max(config.typingMinMs, base));
}

export function buildBurstCombinedText(texts: string[]): string {
  if (texts.length <= 1) return texts[0] ?? '';
  const lines = texts.map((t, i) => `${i + 1}. ${t.trim()}`);
  return `Customer sent multiple messages:\n${lines.join('\n')}`;
}

export function buildBurstPromptInstruction(): string {
  return [
    'The customer may have sent multiple messages quickly.',
    'Treat the current burst as one request.',
    'Read all burst messages together and send one complete reply.',
    'Do not answer only the last message unless earlier messages were corrected or unrelated.',
    'Ask only one final next question.',
  ].join(' ');
}

@Injectable()
export class AiHumanTimingService {
  decideProcessingWait(params: {
    config: HumanTimingConfig;
    messages: ChatMessageForAi[];
    burst?: BurstState | null;
    incomingText: string;
  }): Pick<HumanTimingDecision, 'waitBeforeProcessingMs' | 'burstPauseMs' | 'conversationState' | 'reason'> {
    const presenceFast = isPresenceIntent(params.incomingText);
    const prior = filterMessagesBeforeBurst(params.messages, params.burst);
    const baseState = detectBaseConversationState(prior);
    const state = detectConversationActivity(params.messages, params.burst);

    if (!params.config.humanTimingEnabled) {
      const burstDebounce =
        params.burst && params.burst.messageCount > 1 ? INSTANT_BURST_DEBOUNCE_MS : 0;
      return {
        waitBeforeProcessingMs: burstDebounce,
        burstPauseMs: burstDebounce,
        conversationState: state,
        reason: burstDebounce > 0 ? 'instant_burst_debounce' : 'instant',
      };
    }

    if (params.burst && params.burst.messageCount > 1) {
      const presenceFastPath = presenceFast && baseState === 'active_conversation';
      const wait = computeBurstWaitMs(params.burst, params.config, baseState, presenceFastPath);
      return {
        waitBeforeProcessingMs: wait,
        burstPauseMs: wait,
        conversationState: 'burst_messages',
        reason: presenceFastPath ? 'burst_presence_active_fast' : `burst_pause_${baseState}`,
      };
    }

    const presenceFastPath = presenceFast && baseState === 'active_conversation';

    return {
      waitBeforeProcessingMs: computeWaitBeforeProcessingMs(baseState, params.config, {
        presenceFastPath,
      }),
      burstPauseMs: 0,
      conversationState: state,
      reason: presenceFastPath ? 'presence_active_fast' : baseState,
    };
  }

  decideTyping(params: {
    config: HumanTimingConfig;
    replyText: string;
    hasComplexLookup?: boolean;
  }): Pick<HumanTimingDecision, 'typingDurationMs' | 'shouldShowTyping'> {
    if (!params.config.humanTimingEnabled) {
      return { typingDurationMs: 0, shouldShowTyping: false };
    }
    return {
      typingDurationMs: computeTypingDurationMs(params.replyText, params.config, {
        hasComplexLookup: params.hasComplexLookup,
      }),
      shouldShowTyping: true,
    };
  }
}
