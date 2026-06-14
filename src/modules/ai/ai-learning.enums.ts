export enum AiLearningItemStatus {
  PENDING_REVIEW = 'pending_review',
  SUGGESTED = 'suggested',
  APPROVED = 'approved',
  APPLIED = 'applied',
  REJECTED = 'rejected',
  IGNORED = 'ignored',
  MERGED = 'merged',
  NEEDS_MORE_INFO = 'needs_more_info',
}

export enum AiLearningItemSource {
  AUTO_UNKNOWN = 'auto_unknown',
  STAFF_CORRECTION = 'staff_correction',
  MANUAL = 'manual',
  IMPORT = 'import',
}

export enum AiLearningKnowledgeStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  OUTDATED = 'outdated',
  NEEDS_REVIEW = 'needs_review',
}

export enum AiLearningOutcome {
  CUSTOMER_REPLIED_POSITIVELY = 'customer_replied_positively',
  CUSTOMER_BOUGHT = 'customer_bought',
  CUSTOMER_IGNORED = 'customer_ignored',
  STAFF_CORRECTED_LATER = 'staff_corrected_later',
  NEEDS_REVIEW = 'needs_review',
  POOR_PERFORMANCE = 'poor_performance',
}

export enum AiLearningTone {
  BOSS_FRIENDLY_MTAANI = 'boss_friendly_mtaani',
  PROFESSIONAL = 'professional',
  SHORT_SALES = 'short_sales_reply',
  POLICY_EXPLANATION = 'policy_explanation',
  TECHNICAL_EXPLANATION = 'technical_explanation',
}

export const DEFAULT_UNKNOWN_REPLY =
  'Nipe muda kidogo Boss, nikuthibitishie vizuri nitakurudia 😊';

export const DEFAULT_KNOWLEDGE_FILES = [
  'SHOP.md',
  'FAQ_KNOWLEDGE.md',
  'FAQ.md',
  'PRODUCT_QA.md',
  'WARRANTY_RULES.md',
  'DELIVERY_RULES.md',
  'PAYMENT_RULES.md',
  'INSTALLMENT_RULES.md',
  'AI_REPLY_EXAMPLES.md',
];

export const DEFAULT_RISKY_CATEGORIES = [
  'refund',
  'warranty_dispute',
  'payment_dispute',
  'angry_customer',
  'legal_issue',
  'large_order_discount',
  'damaged_product_complaint',
  'low_confidence_answer',
];
