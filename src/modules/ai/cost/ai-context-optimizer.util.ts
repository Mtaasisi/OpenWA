import { AiCustomerIntent } from '../ai-signal.enums';

export interface AiContextNeeds {
  includeCrm: boolean;
  includeCatalog: boolean;
  includeKnowledge: boolean;
  includeMemory: boolean;
  includeLearningSamples: boolean;
  suggestedMaxTokens: number;
  suggestedTier: 'cheap_fast' | 'balanced' | 'premium';
}

const PRODUCT_INTENTS = new Set<AiCustomerIntent>([
  AiCustomerIntent.PRODUCT_SEARCH,
  AiCustomerIntent.STOCK_REQUEST,
  AiCustomerIntent.PRICE_REQUEST,
  AiCustomerIntent.VARIANT_REQUEST,
  AiCustomerIntent.DISCOUNT_REQUEST,
  AiCustomerIntent.INSTALLMENT_REQUEST,
  AiCustomerIntent.QUOTE_REQUEST,
  AiCustomerIntent.PRODUCT_COMPATIBILITY,
  AiCustomerIntent.DELIVERY_REQUEST,
]);

const KNOWLEDGE_INTENTS = new Set<AiCustomerIntent>([
  AiCustomerIntent.WARRANTY_REQUEST,
  AiCustomerIntent.COMPLAINT,
  AiCustomerIntent.REPAIR_REQUEST,
  AiCustomerIntent.DELIVERY_REQUEST,
]);

const CRM_INTENTS = new Set<AiCustomerIntent>([
  AiCustomerIntent.PAYMENT_REQUEST,
  AiCustomerIntent.LOCATION_REQUEST,
  AiCustomerIntent.DELIVERY_REQUEST,
]);

const COMPLEX_HISTORY_INTENTS = new Set<AiCustomerIntent>([
  AiCustomerIntent.PRODUCT_SEARCH,
  AiCustomerIntent.STOCK_REQUEST,
  AiCustomerIntent.PRICE_REQUEST,
  AiCustomerIntent.VARIANT_REQUEST,
  AiCustomerIntent.DISCOUNT_REQUEST,
  AiCustomerIntent.INSTALLMENT_REQUEST,
  AiCustomerIntent.QUOTE_REQUEST,
  AiCustomerIntent.PRODUCT_COMPATIBILITY,
  AiCustomerIntent.DELIVERY_REQUEST,
  AiCustomerIntent.COMPLAINT,
  AiCustomerIntent.REPAIR_REQUEST,
  AiCustomerIntent.UNKNOWN,
]);

export function resolveHistoryLimit(intent: AiCustomerIntent): number {
  return COMPLEX_HISTORY_INTENTS.has(intent) ? 5 : 3;
}

const NAME_CORRECTION_RE =
  /(si\s+\w+|mimi\s+ni\s+\w+|jina\s+langu|my\s+name\s+is|call\s+me)/i;

export function resolveContextNeeds(
  intent: AiCustomerIntent,
  incomingText: string,
  config: {
    includeCrmWhenNeeded?: boolean;
    includeKnowledgeWhenNeeded?: boolean;
    includeCatalogWhenNeeded?: boolean;
    includeMemoryWhenNeeded?: boolean;
  },
): AiContextNeeds {
  const greeting =
    intent === AiCustomerIntent.GREETING || intent === AiCustomerIntent.PRESENCE;
  const nameCorrection = NAME_CORRECTION_RE.test(incomingText);
  const simpleMessage = incomingText.length < 80 && greeting;

  if (greeting || nameCorrection || simpleMessage) {
    return {
      includeCrm: nameCorrection && config.includeCrmWhenNeeded !== false,
      includeCatalog: false,
      includeKnowledge: false,
      includeMemory: false,
      includeLearningSamples: false,
      suggestedMaxTokens: greeting ? 120 : nameCorrection ? 60 : 120,
      suggestedTier: 'cheap_fast',
    };
  }

  const includeCatalog =
    config.includeCatalogWhenNeeded !== false && PRODUCT_INTENTS.has(intent);
  const includeKnowledge =
    config.includeKnowledgeWhenNeeded !== false &&
    (KNOWLEDGE_INTENTS.has(intent) || PRODUCT_INTENTS.has(intent));
  const includeMemory =
    config.includeMemoryWhenNeeded !== false &&
    (CRM_INTENTS.has(intent) || intent === AiCustomerIntent.UNKNOWN);
  const includeCrm =
    config.includeCrmWhenNeeded !== false &&
    (CRM_INTENTS.has(intent) || PRODUCT_INTENTS.has(intent) || nameCorrection);

  const needsBalanced =
    PRODUCT_INTENTS.has(intent) ||
    intent === AiCustomerIntent.COMPLAINT ||
    intent === AiCustomerIntent.REPAIR_REQUEST;

  return {
    includeCrm,
    includeCatalog,
    includeKnowledge,
    includeMemory,
    includeLearningSamples: PRODUCT_INTENTS.has(intent) || intent === AiCustomerIntent.UNKNOWN,
    suggestedMaxTokens: includeCatalog ? 250 : 220,
    suggestedTier: needsBalanced ? 'balanced' : 'cheap_fast',
  };
}
