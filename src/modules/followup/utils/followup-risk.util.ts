import { detectOptOutKeyword } from '../../whatsapp-safety/utils/opt-out-keywords.util';
import {
  ConversationStage,
  FollowUpDetectedReason,
  FollowUpRiskLevel,
  FollowUpTriggerEvent,
} from '../followup.enums';

const HIGH_RISK_KEYWORDS = [
  'refund',
  'warranty',
  'complaint',
  'angry',
  'lawyer',
  'legal',
  'sue',
  'scam',
  'fraud',
  'police',
  'report you',
];

const ABUSIVE_KEYWORDS = ['stupid', 'idiot', 'useless', 'fuck', 'shit'];

const OPT_OUT_PHRASES = [
  'stop',
  'sitaki',
  'acha',
  'usiendelee',
  'usinitumie',
  'do not contact',
  'unsubscribe',
];

export function isGroupChatId(chatId: string): boolean {
  return chatId.endsWith('@g.us');
}

export function isOptOutMessage(text: string, extraKeywords?: string[]): boolean {
  return detectOptOutKeyword(text, extraKeywords);
}

export function detectRiskFromText(text: string): FollowUpRiskLevel {
  const lower = text.toLowerCase();
  if (ABUSIVE_KEYWORDS.some(k => lower.includes(k))) return FollowUpRiskLevel.HIGH;
  if (HIGH_RISK_KEYWORDS.some(k => lower.includes(k))) return FollowUpRiskLevel.HIGH;
  if (lower.includes('discount') || lower.includes('punguza')) return FollowUpRiskLevel.MEDIUM;
  if (lower.includes('installment') || lower.includes('mdogo mdogo')) return FollowUpRiskLevel.MEDIUM;
  if (lower.includes('confused') || lower.includes('sielewi')) return FollowUpRiskLevel.MEDIUM;
  return FollowUpRiskLevel.LOW;
}

export function mapStageToReason(stage: ConversationStage): FollowUpDetectedReason {
  switch (stage) {
    case ConversationStage.PRICE_SENT:
      return FollowUpDetectedReason.ASKED_PRICE;
    case ConversationStage.PAYMENT_PENDING:
      return FollowUpDetectedReason.WAITING_PAYMENT;
    case ConversationStage.WAITING_CUSTOMER_REPLY:
      return FollowUpDetectedReason.NO_RESPONSE;
    case ConversationStage.PRODUCT_SUGGESTED:
      return FollowUpDetectedReason.WAITING_STOCK;
    case ConversationStage.NEGOTIATING:
      return FollowUpDetectedReason.ASKED_DISCOUNT;
    default:
      return FollowUpDetectedReason.UNKNOWN;
  }
}

export function mapTriggerToReason(trigger: FollowUpTriggerEvent): FollowUpDetectedReason {
  switch (trigger) {
    case FollowUpTriggerEvent.NO_CUSTOMER_REPLY:
      return FollowUpDetectedReason.NO_RESPONSE;
    case FollowUpTriggerEvent.NO_PAYMENT:
      return FollowUpDetectedReason.WAITING_PAYMENT;
    case FollowUpTriggerEvent.OUT_OF_STOCK:
      return FollowUpDetectedReason.WAITING_STOCK;
    case FollowUpTriggerEvent.VISIT_SCHEDULED:
      return FollowUpDetectedReason.LOCATION_REQUEST;
    case FollowUpTriggerEvent.STALE_CONVERSATION:
      return FollowUpDetectedReason.NO_RESPONSE;
    default:
      return FollowUpDetectedReason.UNKNOWN;
  }
}

export function reasonToRiskLevel(reason: FollowUpDetectedReason): FollowUpRiskLevel {
  switch (reason) {
    case FollowUpDetectedReason.LOCATION_REQUEST:
    case FollowUpDetectedReason.PRODUCT_AVAILABLE:
    case FollowUpDetectedReason.ASKED_PRICE:
    case FollowUpDetectedReason.QUOTE_SENT:
    case FollowUpDetectedReason.WAITING_PAYMENT:
    case FollowUpDetectedReason.REPAIR_PICKUP:
    case FollowUpDetectedReason.DELIVERY_UPDATE:
      return FollowUpRiskLevel.LOW;
    case FollowUpDetectedReason.ASKED_DISCOUNT:
    case FollowUpDetectedReason.ASKED_INSTALLMENT:
    case FollowUpDetectedReason.NO_RESPONSE:
    case FollowUpDetectedReason.WAITING_STOCK:
      return FollowUpRiskLevel.MEDIUM;
    case FollowUpDetectedReason.COMPLAINT:
    case FollowUpDetectedReason.WARRANTY_QUESTION:
    case FollowUpDetectedReason.CUSTOMER_NOT_INTERESTED:
      return FollowUpRiskLevel.HIGH;
    default:
      return FollowUpRiskLevel.MEDIUM;
  }
}

export function isSafeMessage(text: string): boolean {
  const lower = text.toLowerCase();
  if (!text.trim()) return false;
  if (HIGH_RISK_KEYWORDS.some(k => lower.includes(k))) return false;
  if (ABUSIVE_KEYWORDS.some(k => lower.includes(k))) return false;
  return true;
}
