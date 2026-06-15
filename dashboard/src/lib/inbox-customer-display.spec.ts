import { describe, expect, it } from 'vitest';
import { formatCustomerLabel, resolveCustomerName } from './inbox-customer-display';

describe('inbox-customer-display', () => {
  it('resolveCustomerName skips generic WhatsApp labels like Business', () => {
    expect(resolveCustomerName('255743996097@c.us', 'Business', 'Agay Mapambo')).toBe('Agay Mapambo');
    expect(resolveCustomerName('255743996097@c.us', 'Business')).toBeNull();
  });

  it('formatCustomerLabel falls back to phone when only generic name is stored', () => {
    const label = formatCustomerLabel({
      chatId: '255743996097@c.us',
      customerName: 'Business',
      customerPhone: '+255743996097',
    });
    expect(label).toContain('+255');
    expect(label.toLowerCase()).not.toBe('business');
  });
});
