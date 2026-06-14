import { ProductDemandIntent } from '../product-demand.enums';
import { detectCustomerIntent } from './ai-intent-detector.util';
import { AiCustomerIntent } from '../ai-signal.enums';

const PRICE_RE = /\b(bei|price|gharama|cost|how much|ngapi)\b/i;
const INSTALLMENT_RE = /\b(installment|malipo kidogo|polepole|mdogo mdogo|lipa kidogo)\b/i;
const DISCOUNT_RE = /\b(discount|punguza|bei kidogo|offer|deal)\b/i;
const PAYMENT_READY_RE = /\b(nataka kununua|nataka kuchukua|ready to pay|nataka kulipa|nitumie namba)\b/i;
const STOCK_RE = /\b(stock|available|ipo|kuna|out of stock|hakuna|imeisha)\b/i;

export function intentToProductDemand(intent: AiCustomerIntent, text: string): ProductDemandIntent {
  if (INSTALLMENT_RE.test(text) || intent === AiCustomerIntent.INSTALLMENT_REQUEST) {
    return ProductDemandIntent.INSTALLMENT_REQUEST;
  }
  if (DISCOUNT_RE.test(text) || intent === AiCustomerIntent.DISCOUNT_REQUEST) {
    return ProductDemandIntent.DISCOUNT_REQUEST;
  }
  if (PAYMENT_READY_RE.test(text) || intent === AiCustomerIntent.PAYMENT_REQUEST) {
    return ProductDemandIntent.PAYMENT_READY;
  }
  if (PRICE_RE.test(text) || intent === AiCustomerIntent.PRICE_REQUEST) {
    return ProductDemandIntent.PRICE_REQUEST;
  }
  if (STOCK_RE.test(text) || intent === AiCustomerIntent.STOCK_REQUEST) {
    return ProductDemandIntent.AVAILABILITY_REQUEST;
  }
  if (intent === AiCustomerIntent.PRODUCT_SEARCH) {
    return ProductDemandIntent.GENERAL;
  }
  return ProductDemandIntent.GENERAL;
}

export function extractProductMention(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;
  const detected = detectCustomerIntent(trimmed);
  if (
    detected === AiCustomerIntent.PRODUCT_SEARCH ||
    detected === AiCustomerIntent.PRICE_REQUEST ||
    detected === AiCustomerIntent.STOCK_REQUEST
  ) {
    const cleaned = trimmed
      .replace(PRICE_RE, '')
      .replace(INSTALLMENT_RE, '')
      .replace(DISCOUNT_RE, '')
      .replace(STOCK_RE, '')
      .trim();
    if (cleaned.length >= 3) return cleaned.slice(0, 200);
  }
  const productLike = trimmed.match(
    /\b(iphone|macbook|samsung|hp|dell|lenovo|charger|laptop|phone|tablet|airpods|watch)\b[^.?!]{0,80}/i,
  );
  return productLike ? productLike[0].trim().slice(0, 200) : null;
}

export function extractPriceMention(text: string): number | null {
  const m = text.match(/(?:tzs|tsh|ksh|usd|\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:k|m)?/i);
  if (!m) return null;
  const raw = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(raw)) return null;
  if (/k\b/i.test(m[0]) && raw < 1000) return raw * 1000;
  return raw;
}
