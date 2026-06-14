export enum ProductDemandIntent {
  PRICE_REQUEST = 'price_request',
  AVAILABILITY_REQUEST = 'availability_request',
  VARIANT_REQUEST = 'variant_request',
  INSTALLMENT_REQUEST = 'installment_request',
  DISCOUNT_REQUEST = 'discount_request',
  PAYMENT_READY = 'payment_ready',
  OUT_OF_STOCK_DEMAND = 'out_of_stock_demand',
  REPAIR_REQUEST = 'repair_request',
  ACCESSORY_REQUEST = 'accessory_request',
  GENERAL = 'general',
}

export enum MissingProductStatus {
  UNMATCHED = 'unmatched',
  NEEDS_MAPPING = 'needs_mapping',
  MAPPED = 'mapped',
  IGNORED = 'ignored',
  ADDED_TO_CATALOG = 'added_to_catalog',
}

export enum ProductDemandTrend {
  RISING = 'rising',
  STABLE = 'stable',
  FALLING = 'falling',
}

export enum ProductDemandRecommendationStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
  DONE = 'done',
}

export enum ProductDemandRecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ProductCatalogRequestStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum ProductDemandCampaignChannel {
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export enum ProductDemandCampaignStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  SENT = 'sent',
  CANCELLED = 'cancelled',
}
