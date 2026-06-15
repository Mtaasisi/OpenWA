import {
  maskPrivateData,
  containsRawPaymentNumber,
  parseCustomInstruction,
  sectionExists,
  buildStructuredRuleSection,
} from './utils/ai-training-sanitize.util';

describe('ai-training-sanitize.util', () => {
  it('masks phone numbers in text', () => {
    expect(maskPrivateData('Call me 255712345678')).toContain('[PHONE]');
  });

  it('detects raw payment numbers in answers', () => {
    expect(containsRawPaymentNumber('Paybill 123456 lipa hapa')).toBe(true);
  });

  it('parses custom instruction into structured rule', () => {
    const parsed = parseCustomInstruction(
      'Akisema anataka namba ya customer care, AI itume namba ya branch yake.',
      'Naomba namba ya customer care',
    );
    expect(parsed.triggerPhrases.length).toBeGreaterThan(0);
    expect(parsed.intent).toBeTruthy();
  });

  it('builds structured rule section with AI_RULE_ID', () => {
    const section = buildStructuredRuleSection({
      ruleId: 'customer_care_number_request',
      title: 'Customer care number',
      source: 'Inbox training',
      approvedBy: 'admin',
      body: 'Ask branch first',
    });
    expect(section).toContain('AI_RULE_ID: customer_care_number_request');
    expect(sectionExists(section, 'customer_care_number_request')).toBe(true);
  });
});
