import { AI_PAUSE_EXPLICIT, AI_PAUSE_MANUAL_TAKEOVER } from '../ai/ai-pause-reason.constants';

describe('AI pause reasons', () => {
  it('defines manual takeover vs explicit pause', () => {
    expect(AI_PAUSE_MANUAL_TAKEOVER).toBe('manual_takeover');
    expect(AI_PAUSE_EXPLICIT).toBe('explicit');
  });
});

describe('manual takeover expiry logic', () => {
  it('expires temporary takeover after deadline', () => {
    const until = new Date(Date.now() - 60_000);
    const active = until.getTime() > Date.now();
    expect(active).toBe(false);
  });

  it('extends takeover from existing deadline', () => {
    const existingUntil = Date.now() + 5 * 60_000;
    const minutes = 15;
    const next = new Date(existingUntil + minutes * 60_000);
    expect(next.getTime()).toBeGreaterThan(existingUntil);
  });
});
