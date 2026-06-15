import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isLinkedSessionRecoverable,
  isLinkedSessionRecovering,
  recoverLinkedSessionInBackground,
  shouldUseLinkingMode,
} from './linked-session-recovery';
import { sessionApi } from '../services/api';

vi.mock('../services/api', () => ({
  sessionApi: {
    start: vi.fn(),
    restart: vi.fn(),
  },
}));

describe('linked-session-recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects recoverable linked sessions', () => {
    expect(isLinkedSessionRecoverable({ phone: '+255700', requiresRelink: false })).toBe(true);
    expect(isLinkedSessionRecoverable({ phone: '+255700', requiresRelink: true })).toBe(false);
    expect(isLinkedSessionRecoverable({ phone: null, requiresRelink: false })).toBe(false);
  });

  it('uses linking mode only for first link or relink', () => {
    expect(shouldUseLinkingMode({ phone: '+255700', requiresRelink: false })).toBe(false);
    expect(shouldUseLinkingMode({ phone: '+255700', requiresRelink: true })).toBe(true);
    expect(shouldUseLinkingMode({ phone: null, requiresRelink: false })).toBe(true);
  });

  it('treats disconnected linked sessions as auto-recovering', () => {
    expect(
      isLinkedSessionRecovering({
        phone: '+255700',
        requiresRelink: false,
        status: 'disconnected',
      }),
    ).toBe(true);
    expect(
      isLinkedSessionRecovering({
        phone: '+255700',
        requiresRelink: false,
        status: 'failed',
      }),
    ).toBe(false);
  });

  it('recovers failed linked sessions via restart', async () => {
    await recoverLinkedSessionInBackground({
      id: 's1',
      status: 'failed',
      phone: '+255700',
      requiresRelink: false,
    });
    expect(sessionApi.restart).toHaveBeenCalledWith('s1');
    expect(sessionApi.start).not.toHaveBeenCalled();
  });

  it('recovers disconnected linked sessions without linking mode', async () => {
    await recoverLinkedSessionInBackground({
      id: 's1',
      status: 'disconnected',
      phone: '+255700',
      requiresRelink: false,
    });
    expect(sessionApi.start).toHaveBeenCalledWith('s1', { linkingMode: false });
  });
});
