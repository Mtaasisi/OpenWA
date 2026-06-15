import {
  extractMessageBusinessFields,
  shouldExtractStructuredFields,
} from './ai-message-extraction.util';

describe('ai-message-extraction.util', () => {
  it('extracts budget, product type, and use case from long messages', () => {
    const fields = extractMessageBusinessFields(
      'Nahitaji laptop kwa graphics design, budget ni 1.5m na nataka 16gb ram na SSD nzuri',
    );
    expect(fields.budget).toBe(1_500_000);
    expect(fields.productType).toBe('laptop');
    expect(fields.useCase).toBe('graphics design');
    expect(fields.specs.length).toBeGreaterThan(0);
    expect(fields.confidence).toBeGreaterThanOrEqual(40);
    expect(fields.intent).toBe('product_recommendation');
  });

  it('detects delivery and installment interest', () => {
    const delivery = extractMessageBusinessFields('Naweza kupata delivery Dar es Salaam leo?');
    expect(delivery.deliveryNeed).toBe(true);
    expect(delivery.intent).toBe('delivery_question');

    const installment = extractMessageBusinessFields('Kuna malipo ya awali kidogo kidogo?');
    expect(installment.installmentInterest).toBe(true);
    expect(installment.intent).toBe('installment_question');
  });

  it('only runs structured extraction for long or multi-line text', () => {
    expect(shouldExtractStructuredFields('mambo')).toBe(false);
    expect(shouldExtractStructuredFields('a'.repeat(80))).toBe(true);
    expect(shouldExtractStructuredFields('line one\nline two')).toBe(true);
  });
});
