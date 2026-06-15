import { describe, expect, it, vi, beforeEach } from 'vitest';
import { verifySessionLink } from './session-link-verify';

vi.mock('../services/api', () => ({
  sessionApi: {
    list: vi.fn(),
  },
  whatsAppSafetyApi: {
    getSessionHealth: vi.fn(),
  },
}));

import { sessionApi, whatsAppSafetyApi } from '../services/api';

describe('verifySessionLink', () => {
  beforeEach(() => {
    vi.mocked(sessionApi.list).mockReset();
    vi.mocked(whatsAppSafetyApi.getSessionHealth).mockReset();
  });

  it('returns ok when session is ready with phone and no relink', async () => {
    vi.mocked(sessionApi.list).mockResolvedValue([
      {
        id: 's1',
        name: 'hello',
        status: 'ready',
        phone: '255746605561',
        requiresRelink: false,
      } as never,
    ]);
    vi.mocked(whatsAppSafetyApi.getSessionHealth).mockResolvedValue({
      warmup: { status: 'active' },
      startupSafeMode: true,
    } as never);

    const result = await verifySessionLink('s1');
    expect(result.ok).toBe(true);
    expect(result.warmupActive).toBe(true);
    expect(result.startupSafeMode).toBe(true);
  });

  it('returns not ok when requiresRelink is true', async () => {
    vi.mocked(sessionApi.list).mockResolvedValue([
      {
        id: 's1',
        name: 'hello',
        status: 'ready',
        phone: '255746605561',
        requiresRelink: true,
      } as never,
    ]);
    vi.mocked(whatsAppSafetyApi.getSessionHealth).mockRejectedValue(new Error('skip'));

    const result = await verifySessionLink('s1');
    expect(result.ok).toBe(false);
    expect(result.requiresRelink).toBe(true);
  });
});
