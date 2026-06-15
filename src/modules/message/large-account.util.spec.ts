import { ConfigService } from '@nestjs/config';
import { resolveThreadStorageTier, readLargeAccountDefaults } from './large-account.util';

describe('large-account.util', () => {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'engine.wa.largeAccountHotTierDays') return 30;
      if (key === 'engine.wa.largeAccountColdResolvedDays') return 180;
      if (key === 'engine.wa.defaultActiveSinceDays') return 90;
      if (key === 'engine.wa.largeAccountHotTierSize') return 500;
      return fallback;
    }),
  } as unknown as ConfigService;

  it('marks recent threads as hot', () => {
    expect(
      resolveThreadStorageTier(
        {
          lastMessageAt: new Date(),
          messageCount: 40,
          resolved: false,
        },
        config,
      ),
    ).toBe('hot');
  });

  it('marks stale resolved threads as cold', () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    expect(
      resolveThreadStorageTier(
        {
          lastMessageAt: old,
          messageCount: 10,
          resolved: true,
        },
        config,
      ),
    ).toBe('cold');
  });

  it('marks sparse-history threads as warm', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(
      resolveThreadStorageTier(
        {
          lastMessageAt: old,
          messageCount: 1,
          resolved: false,
        },
        config,
      ),
    ).toBe('warm');
  });

  it('reads large account defaults from config', () => {
    expect(readLargeAccountDefaults(config)).toEqual({
      activeSinceDays: 90,
      coldResolvedDays: 180,
      hotTierDays: 30,
      hotTierSize: 500,
    });
  });
});
