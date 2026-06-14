export enum AiSignalType {
  DISCOUNT_REQUEST = 'discount_request',
  INSTALLMENT_REQUEST = 'installment_request',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  OUT_OF_STOCK_INSTALLMENT = 'out_of_stock_installment',
  AI_ESCALATED = 'ai_escalated',
  STOCKING_NEEDED = 'stocking_needed',
}

export enum AiEscalationStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum AiEscalationReason {
  REPEATED_DISCOUNT = 'repeated_discount',
  COMPLAINT = 'complaint',
  WARRANTY_REFUND = 'warranty_refund',
  PAYMENT_DISPUTE = 'payment_dispute',
  ANGRY_CUSTOMER = 'angry_customer',
  LARGE_ORDER = 'large_order',
  CONFUSING_CONVERSATION = 'confusing_conversation',
  INSTALLMENT_APPROVAL = 'installment_approval',
  CUSTOMER_REQUESTED_HUMAN = 'customer_requested_human',
  GROUP_LEAD = 'group_lead',
  OTHER = 'other',
}

export enum PaymentMethodType {
  MOBILE_MONEY = 'mobile_money',
  BANK = 'bank',
  CASH = 'cash',
  OTHER = 'other',
}

export enum StockingReminderStatus {
  OPEN = 'open',
  ORDERED = 'ordered',
  STOCKED = 'stocked',
  CANCELLED = 'cancelled',
}

export enum StockingReminderReason {
  INSTALLMENT_OUT_OF_STOCK = 'installment_out_of_stock',
  INSTALLMENT_NEAR_COMPLETION = 'installment_near_completion',
  DEMAND_DETECTED = 'demand_detected',
}

export enum AiCustomerIntent {
  PRESENCE = 'presence',
  GREETING = 'greeting',
  PRICE_REQUEST = 'price_request',
  STOCK_REQUEST = 'stock_request',
  PRODUCT_SEARCH = 'product_search',
  PAYMENT_REQUEST = 'payment_request',
  LOCATION_REQUEST = 'location_request',
  INSTALLMENT_REQUEST = 'installment_request',
  DISCOUNT_REQUEST = 'discount_request',
  COMPLAINT = 'complaint',
  DELIVERY_REQUEST = 'delivery_request',
  WARRANTY_REQUEST = 'warranty_request',
  REPAIR_REQUEST = 'repair_request',
  QUOTE_REQUEST = 'quote_request',
  VARIANT_REQUEST = 'variant_request',
  PRODUCT_COMPATIBILITY = 'product_compatibility',
  UNKNOWN = 'unknown',
}
