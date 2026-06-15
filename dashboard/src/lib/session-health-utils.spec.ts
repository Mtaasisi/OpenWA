import { describe, expect, it } from 'vitest';
import { detectSessionHealthIssue } from './session-health-utils';
import type { SessionHealthOverview } from '../services/api';

const base: SessionHealthOverview = {
  sessionId: 's1',
  name: 'demo',
  dbStatus: 'disconnected',
  liveStatus: 'disconnected',
  enginePresent: false,
  pendingReconnect: false,
  manuallyStopped: false,
  linkingMode: false,
  backgroundSyncing: false,
  requiresRelink: false,
};

describe('detectSessionHealthIssue', () => {
  it('returns engine_relink_required when auth missing for active engine', () => {
    expect(
      detectSessionHealthIssue({
        ...base,
        requiresRelink: true,
      }),
    ).toBe('engine_relink_required');
  });

  it('returns null during linking mode even if requiresRelink', () => {
    expect(
      detectSessionHealthIssue({
        ...base,
        linkingMode: true,
        requiresRelink: true,
      }),
    ).toBeNull();
  });
});
