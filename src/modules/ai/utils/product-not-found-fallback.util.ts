import { AiCustomerIntent } from '../ai-signal.enums';
import {
  detectCustomerIntent,
  isCasualChatMessage,
  isPresenceIntent,
  isPureGreeting,
} from './ai-intent-detector.util';
import {
  extractExplicitProductSearchQuery,
  hasExplicitProductPurchaseIntent,
  isSocialOrObservationalMessage,
} from './customer-product-intent.util';

const CHARGER_BROAD_RE = /\b(chaji|chaja|charger)\b/i;
const MACBOOK_RE = /\bmac\s*book\b/i;

export function normalizeProductQuery(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isBroadChargerQuery(text: string): boolean {
  const t = text.trim();
  if (!CHARGER_BROAD_RE.test(t)) return false;
  return !/\b(iphone|android|type\s*c|usb|laptop|macbook|hp|dell)\b/i.test(t);
}

export function isMacBookQuery(text: string): boolean {
  return MACBOOK_RE.test(text);
}

/** Inventory fast path — only when customer clearly asked for a product. */
export function looksLikeProductQuery(text: string): boolean {
  return hasExplicitProductPurchaseIntent(text);
}

export function extractProductSearchQuery(text: string): string | null {
  return extractExplicitProductSearchQuery(text);
}

export function buildProductNotFoundFallbackReply(
  query: string,
  incomingText: string,
  alternatives: string[] = [],
): string {
  const q = query.trim();
  if (isBroadChargerQuery(incomingText) || isBroadChargerQuery(q)) {
    return 'Unamaanisha charger ya iPhone, Android Type-C, au laptop Boss? Nikijua aina nitakuangalizia vizuri.';
  }
  if (isMacBookQuery(q) || isMacBookQuery(incomingText)) {
    return 'Kwa sasa sijapata MacBook kwenye catalog yangu Boss, lakini naweza kukuangalizia options zilizopo au nikutaarifu ikipatikana. Unahitaji MacBook ya budget gani?';
  }
  if (alternatives.length > 0) {
    const list = alternatives.slice(0, 3).join(', ');
    return `Kwa sasa sijapata "${q}" moja kwa moja Boss, lakini tuna: ${list}. Nikuangalizie moja ya hizi?`;
  }
  return `Kwa sasa sijapata hiyo bidhaa kwenye catalog yangu Boss. Nikikupatia nikujulishe? Au nikuangalizie product inayofanana?`;
}

export { hasExplicitProductPurchaseIntent, isSocialOrObservationalMessage };
