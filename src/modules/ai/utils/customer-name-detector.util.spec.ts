import {
  extractNameSafely,
  aiAskedForName,
  capitalizeName,
  formatNameSaveReply,
  formatNameConfirmationQuestion,
  isAffirmative,
  isSuspiciousName,
  customerRejectedAlternative,
  NAME_BLOCKLIST,
} from './customer-name-detector.util';

describe('customer-name-detector.util', () => {
  it('detects intro phrase names with high confidence', () => {
    const result = extractNameSafely('Naitwa Asha', null);
    expect(result).toMatchObject({
      name: 'Asha',
      confidence: 0.95,
      source: 'intro_phrase',
      suspicious: false,
    });
  });

  it('extracts name after AI asked for name', () => {
    const prev = 'Nikutambue kwa jina gani Boss?';
    expect(aiAskedForName(prev)).toBe(true);
    const result = extractNameSafely('John', prev);
    expect(result?.name).toBe('John');
    expect(result?.source).toBe('after_name_question');
  });

  it('rejects blocklisted product tokens', () => {
    expect(NAME_BLOCKLIST.has('iphone')).toBe(true);
    const result = extractNameSafely('iPhone 15', 'Nikutambue kwa jina gani?');
    expect(result).toBeNull();
  });

  it('capitalizes names', () => {
    expect(capitalizeName('john doe')).toBe('John Doe');
  });

  it('formats name save reply template', () => {
    expect(formatNameSaveReply('Sawa {name}!', 'Asha')).toBe('Sawa Asha!');
  });

  it('detects affirmative and rejection signals', () => {
    expect(isAffirmative('ndiyo')).toBe(true);
    expect(customerRejectedAlternative('hapana sitaki hiyo')).toBe(true);
  });

  it('flags suspicious names like mchele for confirmation', () => {
    expect(isSuspiciousName('mchele')).toBe(true);
    const result = extractNameSafely('Jina langu ni mchele', null);
    expect(result?.name).toBe('Mchele');
    expect(result?.suspicious).toBe(true);
    expect(result?.confidence).toBeLessThan(0.7);
    expect(formatNameConfirmationQuestion('Mchele')).toBe('Nikutambue kama Mchele Boss?');
  });

  it('allows normal names with high confidence', () => {
    const result = extractNameSafely('Naitwa Asha', null);
    expect(result?.suspicious).toBeFalsy();
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
