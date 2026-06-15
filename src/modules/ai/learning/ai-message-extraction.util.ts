/**
 * Deterministic business-field extraction from customer messages (no LLM).
 */

export interface ExtractedMessageFields {
  intent: string | null;
  productType: string | null;
  productName: string | null;
  budget: number | null;
  useCase: string | null;
  specs: string[];
  location: string | null;
  deliveryNeed: boolean;
  installmentInterest: boolean;
  repairIssue: string | null;
  urgency: string | null;
  confidence: number;
}

const BUDGET_RE =
  /(?:budget|bei\s*yangu|bajeti|kiasi|nina)\s*(?:ya|ni|cha)?\s*([\d.,]+)\s*(m|mil|million|b|bn|k|elfu)?/i;

const PRODUCT_TYPES: Array<{ re: RegExp; type: string }> = [
  { re: /\b(laptop|macbook|notebook|kompyuta)\b/i, type: 'laptop' },
  { re: /\b(iphone|simu|phone|samsung|ipad|tablet)\b/i, type: 'phone' },
  { re: /\b(charger|chaja|chaji|cable|adapter)\b/i, type: 'accessory' },
  { re: /\b(monitor|screen|tv|televisheni)\b/i, type: 'display' },
];

const USE_CASE_RE =
  /\b(graphics?\s*design|gaming|chuo|university|office|biashara|video\s*editing|programming|coding)\b/i;

const SPEC_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\b(\d+)\s*gb\s*ram\b/i, label: 'RAM' },
  { re: /\bssd\s*(\d+)\s*gb\b/i, label: 'SSD' },
  { re: /\b(\d+)\s*gb\s*ssd\b/i, label: 'SSD' },
  { re: /\bbattery\s*nzuri\b/i, label: 'good battery' },
  { re: /\bnyepesi\b/i, label: 'lightweight' },
];

const LOCATION_RE = /\b(dar|arusha|mwanza|dodoma|zanzibar|morogoro)\b/i;

function parseBudgetAmount(raw: string, suffix?: string): number | null {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = (suffix ?? '').toLowerCase();
  if (s === 'm' || s === 'mil' || s === 'million') return Math.round(n * 1_000_000);
  if (s === 'b' || s === 'bn') return Math.round(n * 1_000_000_000);
  if (s === 'k' || s === 'elfu') return Math.round(n * 1_000);
  if (n < 1000 && !suffix) return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function extractMessageBusinessFields(text: string): ExtractedMessageFields {
  const t = text.trim();
  const result: ExtractedMessageFields = {
    intent: null,
    productType: null,
    productName: null,
    budget: null,
    useCase: null,
    specs: [],
    location: null,
    deliveryNeed: /\b(deliver|delivery|nitume|peleka|usafirish)\b/i.test(t),
    installmentInterest: /\b(installment|kidogo\s*kidogo|malipo\s*ya\s*awali)\b/i.test(t),
    repairIssue: /\b(repair|karabati|imeharibika|broken)\b/i.test(t) ? t.slice(0, 120) : null,
    urgency: /\b(urgent|haraka|leo|sasa|now)\b/i.test(t) ? 'high' : null,
    confidence: 0,
  };

  if (!t) return result;

  let score = 0;

  const budgetMatch = t.match(BUDGET_RE);
  if (budgetMatch) {
    result.budget = parseBudgetAmount(budgetMatch[1], budgetMatch[2]);
    if (result.budget) score += 25;
  }

  for (const { re, type } of PRODUCT_TYPES) {
    if (re.test(t)) {
      result.productType = type;
      score += 20;
      break;
    }
  }

  const useCaseMatch = t.match(USE_CASE_RE);
  if (useCaseMatch) {
    result.useCase = useCaseMatch[1].toLowerCase();
    score += 15;
  }

  for (const { re, label } of SPEC_RES) {
    const m = t.match(re);
    if (m) {
      result.specs.push(m[0].trim());
      score += 5;
    }
  }

  const locMatch = t.match(LOCATION_RE);
  if (locMatch) {
    result.location = locMatch[1];
    score += 10;
  }

  if (result.productType && result.budget) result.intent = 'product_recommendation';
  else if (result.productType) result.intent = 'product_question';
  else if (result.deliveryNeed) result.intent = 'delivery_question';
  else if (result.installmentInterest) result.intent = 'installment_question';

  result.confidence = Math.min(100, score);
  return result;
}

export function shouldExtractStructuredFields(text: string): boolean {
  return text.trim().length >= 80 || text.split(/\n/).filter(Boolean).length >= 2;
}
