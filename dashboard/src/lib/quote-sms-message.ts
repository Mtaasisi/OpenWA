import type { Quote } from '../services/api';

/** Mirrors backend quote.service notifyBySms message template. */
export function buildQuoteSmsNotification(quote: Quote): string {
  const customerName = quote.customerName ?? 'Mteja';
  const amount = `${quote.currency ?? 'TSh'} ${quote.totalAmount.toLocaleString()}`;
  return `Habari ${customerName}, quote yako iko tayari. Jumla: ${amount}. Tafadhali angalia WhatsApp au wasiliana nasi.`;
}
