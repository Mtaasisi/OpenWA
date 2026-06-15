import { WhatsAppMessageType } from '../enums/whatsapp-safety.enums';
import { isPresenceIntent } from '../../ai/utils/ai-intent-detector.util';
import { randomDelayMs } from './send-delay.util';

export type AiReplyDelayCategory =
  | 'greeting'
  | 'simple_product'
  | 'long_answer'
  | 'payment_location'
  | 'follow_up'
  | 'campaign'
  | 'default';

const DELAY_RANGES: Record<AiReplyDelayCategory, { min: number; max: number }> = {
  greeting: { min: 15_000, max: 30_000 },
  simple_product: { min: 30_000, max: 60_000 },
  long_answer: { min: 45_000, max: 90_000 },
  payment_location: { min: 20_000, max: 45_000 },
  follow_up: { min: 60_000, max: 120_000 },
  campaign: { min: 120_000, max: 180_000 },
  default: { min: 15_000, max: 45_000 },
};

export function classifyAiReplyDelay(params: {
  messageType?: WhatsAppMessageType;
  body?: string;
  detectedIntent?: string | null;
}): AiReplyDelayCategory {
  if (params.messageType === WhatsAppMessageType.FOLLOW_UP) return 'follow_up';
  if (params.messageType === WhatsAppMessageType.CAMPAIGN) return 'campaign';

  const text = (params.body ?? '').toLowerCase();
  const intent = (params.detectedIntent ?? '').toLowerCase();

  if (isPresenceIntent(text.trim()) || intent === 'presence') {
    return 'default';
  }
  if (intent === 'greeting' || /^(hi|hello|habari|mambo|vipi)\s*[!.?]*$/i.test(text.trim())) {
    return 'greeting';
  }
  if (/payment|lipa|mpesa|tigo pesa|airtel money|location|mahali|wapi|address/.test(text + intent)) {
    return 'payment_location';
  }
  if (/product|bei|price|stock|available|iphone|samsung|laptop/.test(text + intent)) {
    return 'simple_product';
  }
  if (text.length > 280) return 'long_answer';
  return 'default';
}

export function computeAiReplyDelayMs(
  category: AiReplyDelayCategory,
  settingsMin?: number,
  settingsMax?: number,
): number {
  const range = DELAY_RANGES[category] ?? DELAY_RANGES.default;
  const min = settingsMin != null && settingsMin > 0 ? settingsMin : range.min;
  const max = settingsMax != null && settingsMax >= min ? settingsMax : range.max;
  return randomDelayMs(min, max);
}
