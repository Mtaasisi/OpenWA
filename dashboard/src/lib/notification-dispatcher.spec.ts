import { describe, expect, it } from 'vitest';
import { shouldNotify } from './notification-dispatcher';
import { DEFAULT_NOTIFICATION_PREFS } from './notification-catalog';

describe('notification-dispatcher shouldNotify', () => {
  it('returns false when master switch is off', () => {
    expect(
      shouldNotify({ ...DEFAULT_NOTIFICATION_PREFS, enabled: false }, 'message.direct'),
    ).toBe(false);
  });

  it('returns false when kind is disabled', () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds, 'message.group': false },
    };
    expect(shouldNotify(prefs, 'message.group')).toBe(false);
  });

  it('blocks admin-only kinds for non-admin users', () => {
    expect(shouldNotify(DEFAULT_NOTIFICATION_PREFS, 'learning.pending', { isAdmin: false })).toBe(
      false,
    );
    expect(shouldNotify(DEFAULT_NOTIFICATION_PREFS, 'learning.pending', { isAdmin: true })).toBe(
      false,
    );
  });

  it('allows direct messages for non-admin when enabled', () => {
    expect(shouldNotify(DEFAULT_NOTIFICATION_PREFS, 'message.direct', { isAdmin: false })).toBe(
      true,
    );
  });

  it('allows admin SMS kinds for admins when enabled in prefs', () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds, 'sms.failed': true },
    };
    expect(shouldNotify(prefs, 'sms.failed', { isAdmin: true })).toBe(true);
    expect(shouldNotify(prefs, 'sms.failed', { isAdmin: false })).toBe(false);
  });
});
