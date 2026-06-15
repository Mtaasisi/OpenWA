import { renderTemplate, isWithin24HourWindow, canAutoSendTemplate } from './template.util';

describe('template.util', () => {
  it('renders placeholders', () => {
    const body = renderTemplate('Hi {customer_name}, price for {product_name} is {price}', {
      customer_name: 'Jane',
      product_name: 'Phone',
      price: '500',
    });
    expect(body).toBe('Hi Jane, price for Phone is 500');
  });

  it('detects 24h window', () => {
    const recent = new Date(Date.now() - 60_000);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isWithin24HourWindow(recent)).toBe(true);
    expect(isWithin24HourWindow(old)).toBe(false);
    expect(isWithin24HourWindow(null)).toBe(false);
  });

  it('blocks auto-send outside window without approval', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(canAutoSendTemplate(false, 'not_required', old)).toBe(false);
    expect(canAutoSendTemplate(true, 'approved', old)).toBe(true);
    expect(canAutoSendTemplate(true, 'pending', old)).toBe(false);
  });
});
