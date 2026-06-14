import { DEFAULT_FEATURE_LIMITS } from './ai-cost.types';

describe('ai-cost feature limits', () => {
  it('defines safe auto-reply token cap', () => {
    expect(DEFAULT_FEATURE_LIMITS.whatsapp_auto_reply).toBeLessThanOrEqual(250);
  });

  it('admin assistant cap is higher than auto-reply', () => {
    expect(DEFAULT_FEATURE_LIMITS.admin_assistant).toBeGreaterThan(
      DEFAULT_FEATURE_LIMITS.whatsapp_auto_reply ?? 0,
    );
  });
});
