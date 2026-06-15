export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CONVERTED_TO_SALE = 'converted_to_sale',
}

export enum QuotePermission {
  VIEW_QUOTES = 'view_quotes',
  CREATE_CHAT_QUOTE = 'create_chat_quote',
  SEND_CHAT_QUOTE = 'send_chat_quote',
  APPROVE_QUOTE_DISCOUNT = 'approve_quote_discount',
  CONVERT_QUOTE_TO_SALE = 'convert_quote_to_sale',
}
