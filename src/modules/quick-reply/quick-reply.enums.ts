export enum QuickReplyCategory {
  GREETING = 'greeting',
  ASK_BUDGET = 'ask_budget',
  ASK_USAGE = 'ask_usage',
  SEND_PRICE = 'send_price',
  PRODUCT_AVAILABLE = 'product_available',
  OUT_OF_STOCK = 'out_of_stock',
  SUGGEST_ALTERNATIVE = 'suggest_alternative',
  PAYMENT_INSTRUCTIONS = 'payment_instructions',
  DELIVERY_INFO = 'delivery_info',
  WARRANTY = 'warranty',
  REPAIR_STATUS = 'repair_status',
  FOLLOW_UP = 'follow_up',
  CLOSING_SALE = 'closing_sale',
  THANK_YOU = 'thank_you',
}

export enum QuickReplyPermission {
  VIEW_QUICK_REPLIES = 'view_quick_replies',
  SEND_QUICK_REPLIES = 'send_quick_replies',
  MANAGE_QUICK_REPLIES = 'manage_quick_replies',
}
