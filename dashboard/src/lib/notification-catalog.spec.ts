import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  migrateLegacyNotificationPrefs,
  isKindEnabled,
  setSectionKindsEnabled,
} from './notification-catalog';

describe('notification-catalog', () => {
  it('defaults direct messages on and groups off', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.kinds['message.direct']).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFS.kinds['message.group']).toBe(false);
  });

  it('migrates legacy desktop prefs into kinds map', () => {
    const prefs = migrateLegacyNotificationPrefs({
      desktopNotifications: {
        enabled: true,
        messages: true,
        followups: false,
        ai: true,
        learning: false,
        system: true,
        includeGroups: true,
      },
    });
    expect(prefs.enabled).toBe(true);
    expect(prefs.kinds['message.direct']).toBe(true);
    expect(prefs.kinds['message.group']).toBe(true);
    expect(prefs.kinds['followup.due']).toBe(false);
    expect(prefs.kinds['learning.pending']).toBe(false);
  });

  it('migrates browser-only toggle to message and follow-up kinds', () => {
    const prefs = migrateLegacyNotificationPrefs({
      inboxBrowserNotifications: true,
    });
    expect(prefs.enabled).toBe(true);
    expect(prefs.kinds['message.direct']).toBe(true);
    expect(prefs.kinds['followup.due']).toBe(true);
  });

  it('respects master enabled switch', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, enabled: false };
    expect(isKindEnabled(prefs, 'message.direct')).toBe(false);
  });

  it('toggles all kinds in a section', () => {
    const off = setSectionKindsEnabled(DEFAULT_NOTIFICATION_PREFS, 'followups', false);
    expect(off.kinds['followup.due']).toBe(false);
    expect(off.kinds['followup.escalated']).toBe(false);
    expect(off.kinds['message.direct']).toBe(true);
  });
});
