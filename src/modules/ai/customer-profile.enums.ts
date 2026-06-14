export enum ProfileLearningEventStatus {
  AUTO_SAVED = 'auto_saved',
  NEEDS_REVIEW = 'needs_review',
  REJECTED = 'rejected',
  CORRECTED = 'corrected',
}

export enum ProfileQuestionKind {
  NAME = 'name',
  DELIVERY = 'delivery',
  LOCATION = 'location',
  BUDGET = 'budget',
  USE_CASE = 'use_case',
  NOTIFY_PERMISSION = 'notify_permission',
}

export enum LostDemandReason {
  PRODUCT_UNAVAILABLE = 'product_unavailable',
  VARIANT_UNAVAILABLE = 'variant_unavailable',
  CUSTOMER_REJECTED_ALTERNATIVE = 'customer_rejected_alternative',
}

export enum LostDemandStatus {
  OPEN = 'open',
  NOTIFIED = 'notified',
  CONVERTED = 'converted',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum LostDemandPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export enum ProfileConversationFlow {
  IDLE = 'idle',
  AWAITING_NOTIFY_PERMISSION = 'awaiting_notify_permission',
  AWAITING_NAME_FOR_NOTIFY = 'awaiting_name_for_notify',
  AWAITING_NAME_CONFIRMATION = 'awaiting_name_confirmation',
}
