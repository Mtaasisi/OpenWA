import { detectNameCorrection } from './customer-name-correction.util';

describe('customer-name-correction.util', () => {
  it('detects sio X ni Y pattern', () => {
    const result = detectNameCorrection('Sio John, ni Jonathan', 'John');
    expect(result).toEqual({
      correctedName: 'Jonathan',
      previousName: 'John',
    });
  });

  it('detects jina ni pattern', () => {
    const result = detectNameCorrection('Jina langu ni Asha', 'Mary');
    expect(result?.correctedName).toBe('Asha');
    expect(result?.previousName).toBe('Mary');
  });

  it('returns null when no correction found', () => {
    expect(detectNameCorrection('Nataka iPhone 15', 'John')).toBeNull();
  });
});
