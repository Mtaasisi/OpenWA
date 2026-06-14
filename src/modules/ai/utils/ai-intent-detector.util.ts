import { AiCustomerIntent, AiSignalType } from '../ai-signal.enums';
import {
  hasExplicitProductPurchaseIntent,
  isSelfIntroduction,
  isSocialOrObservationalMessage,
} from './customer-product-intent.util';

const GREETING_RE =
  /^(mambo|habari|hi|hello|hey|vipi|salama|shikamoo|niaje|sasa|poa|namna\s*gani|hujambo|shwari|shwarri|good\s*(morning|afternoon|evening)|jambo)(\s+boss|\s+sis)?\s*[!.?]*$/i;

/** Thanks, acks, and small talk — not product queries. */
const CASUAL_CHAT_RE =
  /^(asante|thanks|thank\s*you|sawa|ok|cool|nice|good|great|safi|fresh|ndio|ehee|karibu|nimeona)(\s+boss|\s+sis)?\s*[!.?]*$/i;

/** Presence / availability checks — higher priority than greeting. */
const PRESENCE_RE =
  /^(?:upo\s+online(?:\s+now)?|uko\s+online(?:\s+now)?|uko\s+hapo\??|upo\s+hapo\??|upo\?|uko\?|uko\s+available|uko\s+tayari|unanijibu\??|unajibu\??|uko\s+live\??|hello\?|hi\?|are\s+you\s+online|are\s+you\s+there|available\?|you\s+there\?|umesikia\??)\s*[!.?]*$/i;

const DISCOUNT_RE =
  /(punguz|discount|bei\s*chache|bei\s*ndogo|nipe\s*offer|bei\s*ya\s*mwisho|bei\s*bora|bei\s*ya\s*chini)/i;

const INSTALLMENT_RE =
  /(installment|kidogo\s*kidogo|malipo\s*ya\s*awali|advance|deposit|lipa\s*baadae|kulipa\s*kidogo)/i;

const PAYMENT_RE =
  /(nitumie\s*number|nataka\s*kulipa|naweza\s*kulipa|malipo|payment|mpesa|tigo\s*pesa|lipa\s*sasa|nichukua|nachukua)/i;

const LOCATION_RE =
  /(location|wapi\s*mnalo|mnapatikana|mnatoka\s*wapi|address|dar\s*au\s*arusha|uko\s*wapi|duka\s*lipo)/i;

const COMPLAINT_RE =
  /(complaint|malalamiko|refund|rudisha\s*pesa|sijaridhika|angry|hasira)/i;

const WARRANTY_RE = /\b(warranty|waranti)\b/i;

const REPAIR_RE = /\b(repair|kukarabati|karabati|service\s*center|imeharibika)\b/i;

const DELIVERY_RE =
  /\b(deliver|delivery|usafirish|nitume|nitumie|peleka|nitoa\s*wapi|nije\s*na|pickup|kuchukua\s*duka)\b/i;

const QUOTE_RE = /\b(quote|quotation|proforma|bei\s*ya\s*jumla)\b/i;

const VARIANT_RE =
  /\b(\d+\s*gb|\d+\s*g\b|ram\s*\d|storage|colour|color|variant|model\s*gani)\b/i;

const PRICE_RE = /\b(bei\s*gani|price|how\s+much|cost)\b/i;

const STOCK_ONLY_RE = /\b(ipo\??|zipo|available|stock|kuna\??|hazipo|hakuna)\b/i;

const COMPATIBILITY_HINT_RE =
  /\b(charger|chaja|compatible|inafaa|iphone\s*au\s*android|simu\s*yako\s*ni)\b/i;

export function isPresenceIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return PRESENCE_RE.test(t);
}

export function isCasualChatMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isPresenceIntent(t)) return true;
  if (GREETING_RE.test(t) && t.split(/\s+/).length <= 3) return true;
  return CASUAL_CHAT_RE.test(t);
}

export function detectCustomerIntent(text: string): AiCustomerIntent {
  const t = text.trim();
  if (!t) return AiCustomerIntent.UNKNOWN;
  if (
    /\bhapana\b/i.test(t) &&
    !/\b(nataka|uko\s+na|una|unauza)\s+\S+/i.test(t) &&
    !/\b(charger|chaji|chaja|iphone|macbook|laptop|simu|samsung)\b/i.test(t)
  ) {
    return AiCustomerIntent.UNKNOWN;
  }
  if (isPresenceIntent(t)) return AiCustomerIntent.PRESENCE;
  if (GREETING_RE.test(t) && t.split(/\s+/).length <= 3) return AiCustomerIntent.GREETING;
  if (COMPLAINT_RE.test(t)) return AiCustomerIntent.COMPLAINT;
  if (WARRANTY_RE.test(t)) return AiCustomerIntent.WARRANTY_REQUEST;
  if (REPAIR_RE.test(t)) return AiCustomerIntent.REPAIR_REQUEST;
  if (DISCOUNT_RE.test(t)) return AiCustomerIntent.DISCOUNT_REQUEST;
  if (INSTALLMENT_RE.test(t)) return AiCustomerIntent.INSTALLMENT_REQUEST;
  if (PAYMENT_RE.test(t)) return AiCustomerIntent.PAYMENT_REQUEST;
  if (LOCATION_RE.test(t)) return AiCustomerIntent.LOCATION_REQUEST;
  if (DELIVERY_RE.test(t)) return AiCustomerIntent.DELIVERY_REQUEST;
  if (QUOTE_RE.test(t)) return AiCustomerIntent.QUOTE_REQUEST;
  if (COMPATIBILITY_HINT_RE.test(t)) return AiCustomerIntent.PRODUCT_COMPATIBILITY;
  if (VARIANT_RE.test(t)) return AiCustomerIntent.VARIANT_REQUEST;
  if (PRICE_RE.test(t)) return AiCustomerIntent.PRICE_REQUEST;
  if (STOCK_ONLY_RE.test(t)) return AiCustomerIntent.STOCK_REQUEST;
  if (isSocialOrObservationalMessage(t) || isSelfIntroduction(t)) {
    return AiCustomerIntent.UNKNOWN;
  }
  if (hasExplicitProductPurchaseIntent(t)) return AiCustomerIntent.PRODUCT_SEARCH;
  if (/\d/.test(t) && /\b(iphone|macbook|samsung|simu|laptop|charger|chaji)\b/i.test(t)) {
    return AiCustomerIntent.PRODUCT_SEARCH;
  }
  return AiCustomerIntent.UNKNOWN;
}

export function intentToSignal(intent: AiCustomerIntent): AiSignalType | null {
  switch (intent) {
    case AiCustomerIntent.DISCOUNT_REQUEST:
      return AiSignalType.DISCOUNT_REQUEST;
    case AiCustomerIntent.INSTALLMENT_REQUEST:
      return AiSignalType.INSTALLMENT_REQUEST;
    case AiCustomerIntent.PAYMENT_REQUEST:
      return AiSignalType.PAYMENT_CONFIRMATION;
    default:
      return null;
  }
}

export function isPureGreeting(text: string): boolean {
  const t = text.trim();
  if (!t || isPresenceIntent(t)) return false;
  if (GREETING_RE.test(t) && t.split(/\s+/).length <= 3) return true;
  return false;
}

export function detectCityFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bdar\b|dar\s*es\s*salaam|dsm/.test(lower)) return 'Dar';
  if (/\barusha\b/.test(lower)) return 'Arusha';
  return null;
}
