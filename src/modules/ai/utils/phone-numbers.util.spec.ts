import { normalizePhoneNumbers } from './phone-numbers.util';

describe('normalizePhoneNumbers', () => {
  it('returns arrays as trimmed strings', () => {
    expect(normalizePhoneNumbers([' 0712 ', '0769'])).toEqual(['0712', '0769']);
  });

  it('parses JSON array strings', () => {
    expect(normalizePhoneNumbers('["0712378850","0769601663"]')).toEqual([
      '0712378850',
      '0769601663',
    ]);
  });

  it('splits plain and newline-separated strings', () => {
    expect(normalizePhoneNumbers('0712378850')).toEqual(['0712378850']);
    expect(normalizePhoneNumbers('0712\n0769')).toEqual(['0712', '0769']);
  });

  it('returns null for nullish input', () => {
    expect(normalizePhoneNumbers(null)).toBeNull();
    expect(normalizePhoneNumbers(undefined)).toBeNull();
  });
});
