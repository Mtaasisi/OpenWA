import { detectOptOutKeyword } from './opt-out-keywords.util';

describe('opt-out-keywords', () => {
  it('detects Swahili opt-out keywords', () => {
    expect(detectOptOutKeyword('sitaki')).toBe(true);
    expect(detectOptOutKeyword('usinitumie tena')).toBe(true);
    expect(detectOptOutKeyword('usiendelee')).toBe(true);
  });

  it('uses custom keywords from settings', () => {
    expect(detectOptOutKeyword('acha kabisa', ['acha kabisa'])).toBe(true);
  });
});
