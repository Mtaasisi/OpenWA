import type { ConfigService } from '@nestjs/config';
import type { InboxThreadSummaryService } from './inbox-thread-summary.service';

export function readLargeAccountThreshold(config: ConfigService): number {
  return config.get<number>('engine.wa.largeAccountThreshold', 2000);
}

export function readLargeAccountSyncMaxChats(config: ConfigService): number {
  return config.get<number>('engine.wa.largeAccountSyncMaxChats', 200);
}

export function readLargeAccountHotTierDays(config: ConfigService): number {
  return config.get<number>('engine.wa.largeAccountHotTierDays', 30);
}

export function readLargeAccountHotTierSize(config: ConfigService): number {
  return config.get<number>('engine.wa.largeAccountHotTierSize', 500);
}

export function readLargeAccountColdResolvedDays(config: ConfigService): number {
  return config.get<number>('engine.wa.largeAccountColdResolvedDays', 180);
}

export type ThreadStorageTier = 'hot' | 'warm' | 'cold';

export interface LargeAccountDefaults {
  activeSinceDays: number;
  coldResolvedDays: number;
  hotTierDays: number;
  hotTierSize: number;
}

export function readLargeAccountDefaults(config: ConfigService): LargeAccountDefaults {
  return {
    activeSinceDays: config.get<number>('engine.wa.defaultActiveSinceDays', 90),
    coldResolvedDays: readLargeAccountColdResolvedDays(config),
    hotTierDays: readLargeAccountHotTierDays(config),
    hotTierSize: readLargeAccountHotTierSize(config),
  };
}

export function resolveThreadStorageTier(
  input: {
    lastMessageAt: Date | string;
    messageCount: number;
    resolved: boolean;
  },
  config: ConfigService,
): ThreadStorageTier {
  const hotDays = readLargeAccountHotTierDays(config);
  const coldDays = readLargeAccountColdResolvedDays(config);
  const at = new Date(input.lastMessageAt).getTime();
  const now = Date.now();
  if (Number.isFinite(at)) {
    if (input.resolved && at < now - coldDays * 24 * 60 * 60 * 1000) {
      return 'cold';
    }
    if (at >= now - hotDays * 24 * 60 * 60 * 1000) {
      return 'hot';
    }
  }
  if (input.messageCount < 5) {
    return 'warm';
  }
  return 'warm';
}

export async function resolveLargeAccountScale(
  inboxThreadSummaryService: InboxThreadSummaryService,
  config: ConfigService,
  sessionIds: string[],
): Promise<{ largeAccountMode: boolean; threadTotal: number; threshold: number }> {
  const threadTotal = await inboxThreadSummaryService.countThreads(sessionIds);
  const threshold = readLargeAccountThreshold(config);
  return {
    largeAccountMode: threadTotal > threshold,
    threadTotal,
    threshold,
  };
}
