import type { Quote } from '../entities/quote.entity';
import type { QuoteItem } from '../entities/quote-item.entity';

function formatMoney(amount: number, currency: string | null): string {
  const cur = currency?.trim() || 'TZS';
  const rounded = Math.round(amount);
  return `${cur} ${rounded.toLocaleString('en-US')}`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export interface QuoteMessageOptions {
  businessName?: string | null;
  paymentInstructions?: string | null;
  branchPickupInfo?: string | null;
}

export function formatQuoteWhatsAppMessage(
  quote: Quote & { items: QuoteItem[] },
  options: QuoteMessageOptions = {},
): string {
  const business = options.businessName?.trim() || 'Our store';
  const customer = quote.customerName?.trim() || 'Customer';
  const lines: string[] = [];

  lines.push(`📋 *${business} — Quotation*`);
  lines.push('');
  lines.push(`Hello ${customer},`);
  lines.push('');
  lines.push(`Quote: *${quote.quoteNumber}*`);
  if (quote.validUntil) {
    lines.push(`Valid until: ${formatDate(quote.validUntil)}`);
  }
  lines.push('');
  lines.push('*Items:*');

  const sorted = [...(quote.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sorted) {
    const qty = item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2);
    const lineTotal = formatMoney(item.totalPrice, quote.currency);
    let row = `• ${item.itemName}`;
    if (item.description?.trim()) row += ` — ${item.description.trim()}`;
    row += `\n  ${qty} × ${formatMoney(item.unitPrice, quote.currency)}`;
    if (item.discountAmount > 0) {
      row += ` (−${formatMoney(item.discountAmount, quote.currency)})`;
    }
    row += ` = *${lineTotal}*`;
    if (item.warranty?.trim()) row += `\n  Warranty: ${item.warranty.trim()}`;
    if (item.stockStatus === 'out_of_stock') row += '\n  ⚠️ Currently out of stock';
    else if (item.stockStatus === 'low_stock') row += '\n  ⚡ Limited stock';
    lines.push(row);
  }

  lines.push('');
  if (quote.discountAmount > 0) {
    lines.push(`Subtotal: ${formatMoney(quote.subtotal, quote.currency)}`);
    lines.push(`Discount: −${formatMoney(quote.discountAmount, quote.currency)}`);
  }
  if (quote.deliveryFee > 0) {
    lines.push(`Delivery: ${formatMoney(quote.deliveryFee, quote.currency)}`);
  }
  if (quote.taxAmount > 0) {
    lines.push(`Tax: ${formatMoney(quote.taxAmount, quote.currency)}`);
  }
  lines.push(`*Total: ${formatMoney(quote.totalAmount, quote.currency)}*`);

  const payment = options.paymentInstructions?.trim() || quote.paymentInstructions?.trim();
  if (payment) {
    lines.push('');
    lines.push('*Payment:*');
    lines.push(payment);
  }

  const pickup = options.branchPickupInfo?.trim() || quote.branchPickupInfo?.trim();
  if (pickup) {
    lines.push('');
    lines.push('*Pickup / branch:*');
    lines.push(pickup);
  }

  if (quote.notes?.trim()) {
    lines.push('');
    lines.push(quote.notes.trim());
  }

  lines.push('');
  lines.push('Reply to confirm or ask any questions. Thank you!');

  return lines.join('\n');
}
