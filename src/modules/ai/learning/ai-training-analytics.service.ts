import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { AiLearnedIntent } from '../entities/ai-learned-intent.entity';
import { AiUnknownMessage } from '../entities/ai-unknown-message.entity';
import { AiUsageFeature } from '../cost/ai-cost.types';

export interface TrainingAnalyticsKpi {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
}

export interface TrainingAnalyticsResponse {
  kpis: TrainingAnalyticsKpi[];
  cacheHitSeries: Array<{ date: string; rate: number }>;
  intentsByStatus: Array<{ status: string; count: number }>;
  costSavedSeries: Array<{ date: string; amount: number }>;
  topIntentsByUsage: Array<{ intent: string; usage: number }>;
  unknownTrend: Array<{ date: string; count: number }>;
  topSavingPhrases: Array<{ phrase: string; savedCalls: number }>;
  repeatedUnknown: Array<{ message: string; count: number }>;
  lowConfidenceIntents: AiLearnedIntent[];
}

@Injectable()
export class AiTrainingAnalyticsService {
  constructor(
    @InjectRepository(AiUsageLog, 'data')
    private readonly usageRepo: Repository<AiUsageLog>,
    @InjectRepository(AiLearnedIntent, 'data')
    private readonly intentRepo: Repository<AiLearnedIntent>,
    @InjectRepository(AiUnknownMessage, 'data')
    private readonly unknownRepo: Repository<AiUnknownMessage>,
  ) {}

  async getAnalytics(
    range = '7',
    branchId?: string | null,
  ): Promise<TrainingAnalyticsResponse> {
    const { start, prevStart, end, dayKeys } = this.resolveRange(range);
    const prevEnd = new Date(start.getTime() - 1);

    const usageLogs = await this.usageRepo.find({
      where: { createdAt: Between(prevStart, end) },
      order: { createdAt: 'ASC' },
    });

    const periodLogs = usageLogs.filter(l => l.createdAt >= start);
    const prevLogs = usageLogs.filter(l => l.createdAt >= prevStart && l.createdAt < start);

    const autoReply = (logs: AiUsageLog[]) =>
      logs.filter(l => l.feature === AiUsageFeature.WHATSAPP_AUTO_REPLY);

    const periodAuto = autoReply(periodLogs);
    const prevAuto = autoReply(prevLogs);

    const cacheHits = periodAuto.filter(l => l.status === 'cache_hit');
    const prevCacheHits = prevAuto.filter(l => l.status === 'cache_hit');
    const aiCalls = periodAuto.filter(l => l.status === 'success' || l.status === 'failed');
    const cacheHitRate =
      cacheHits.length + aiCalls.length > 0
        ? (cacheHits.length / (cacheHits.length + aiCalls.length)) * 100
        : 0;

    const successReplies = periodAuto.filter(l => l.status === 'success');
    const avgReplyCost =
      successReplies.length > 0
        ? successReplies.reduce((s, l) => s + Number(l.actualCostUsd ?? 0), 0) / successReplies.length
        : 0.002;

    const avgReplyTokens =
      successReplies.length > 0
        ? successReplies.reduce((s, l) => s + l.totalTokens, 0) / successReplies.length
        : 0;

    const moneySaved = cacheHits.length * avgReplyCost;
    const tokensSaved = Math.round(cacheHits.length * avgReplyTokens);

    const intents = await this.intentRepo.find({
      order: { usageCount: 'DESC' },
      take: 500,
    });
    const intentsInPeriod = intents.filter(i => i.createdAt >= start);
    const intentsPrevPeriod = intents.filter(
      i => i.createdAt >= prevStart && i.createdAt < start,
    );

    const unknownAll = await this.unknownRepo.find({ order: { frequencyCount: 'DESC' }, take: 500 });
    const unknownInPeriod = unknownAll.filter(u => u.createdAt >= start);

    const cacheHitByDay = this.countByDay(cacheHits, dayKeys);
    const aiCallsByDay = this.countByDay(aiCalls, dayKeys);
    const cacheHitSeries = dayKeys.map(date => {
      const hits = cacheHitByDay.get(date) ?? 0;
      const calls = aiCallsByDay.get(date) ?? 0;
      const total = hits + calls;
      return {
        date: this.formatChartDate(date),
        rate: total > 0 ? Math.round((hits / total) * 1000) / 10 : 0,
      };
    });

    const savedByDay = new Map<string, number>();
    for (const log of cacheHits) {
      const date = log.createdAt.toISOString().slice(0, 10);
      savedByDay.set(date, (savedByDay.get(date) ?? 0) + avgReplyCost);
    }
    const costSavedSeries = dayKeys.map(date => ({
      date: this.formatChartDate(date),
      amount: Math.round((savedByDay.get(date) ?? 0) * 100) / 100,
    }));

    const unknownByDay = this.countByDay(unknownInPeriod, dayKeys);
    const unknownTrend = dayKeys.map(date => ({
      date: this.formatChartDate(date),
      count: unknownByDay.get(date) ?? 0,
    }));

    const statusCounts = new Map<string, number>();
    for (const row of intents) {
      const label = this.formatStatusLabel(row.status);
      statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
    }

    const intentUsageMap = new Map<string, number>();
    for (const row of intents) {
      intentUsageMap.set(row.intent, (intentUsageMap.get(row.intent) ?? 0) + (row.usageCount ?? 0));
    }
    const topIntentsByUsage = [...intentUsageMap.entries()]
      .map(([intent, usage]) => ({ intent, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    const topSavingPhrases = intents
      .filter(i => (i.usageCount ?? 0) > 0)
      .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
      .slice(0, 8)
      .map(i => ({ phrase: i.phrase, savedCalls: i.usageCount ?? 0 }));

    const repeatedUnknown = unknownAll
      .filter(u => u.frequencyCount > 1)
      .slice(0, 8)
      .map(u => ({ message: u.rawText, count: u.frequencyCount }));

    const lowConfidenceIntents = intents
      .filter(i => Number(i.confidence ?? 0) < 60)
      .sort((a, b) => Number(a.confidence) - Number(b.confidence))
      .slice(0, 10);

    const prevCacheHitRate = this.cacheHitRate(prevAuto);
    const prevMoneySaved = prevCacheHits.length * avgReplyCost;

    return {
      kpis: [
        {
          label: 'Cache Hit Rate',
          value: `${cacheHitRate.toFixed(1)}%`,
          change: this.formatDelta(cacheHitRate, prevCacheHitRate, '%'),
          changePositive: cacheHitRate >= prevCacheHitRate,
        },
        {
          label: 'AI Calls Saved',
          value: String(cacheHits.length),
          change: this.formatCountDelta(cacheHits.length, prevCacheHits.length),
          changePositive: cacheHits.length >= prevCacheHits.length,
        },
        {
          label: 'Tokens Saved',
          value: this.formatCompact(tokensSaved),
          change: this.formatCountDelta(
            tokensSaved,
            Math.round(prevCacheHits.length * avgReplyTokens),
          ),
          changePositive: tokensSaved >= prevCacheHits.length * avgReplyTokens,
        },
        {
          label: 'Money Saved',
          value: `$${moneySaved.toFixed(2)}`,
          change: this.formatMoneyDelta(moneySaved, prevMoneySaved),
          changePositive: moneySaved >= prevMoneySaved,
        },
        {
          label: 'New Intents Learned',
          value: String(intentsInPeriod.length),
          change: this.formatCountDelta(intentsInPeriod.length, intentsPrevPeriod.length),
          changePositive: intentsInPeriod.length >= intentsPrevPeriod.length,
        },
      ],
      cacheHitSeries,
      intentsByStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
      costSavedSeries,
      topIntentsByUsage,
      unknownTrend,
      topSavingPhrases,
      repeatedUnknown,
      lowConfidenceIntents,
    };
  }

  private resolveRange(range: string): {
    start: Date;
    prevStart: Date;
    end: Date;
    dayKeys: string[];
  } {
    const end = new Date();
    let start: Date;
    let periodDays: number;

    if (range === 'mtd') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      periodDays =
        Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    } else {
      periodDays = range === '30' ? 30 : 7;
      start = new Date(end);
      start.setDate(start.getDate() - periodDays);
      start.setHours(0, 0, 0, 0);
    }

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);

    const dayKeys: string[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }

    return { start, prevStart, end, dayKeys };
  }

  private countByDay(rows: Array<{ createdAt: Date }>, dayKeys: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const key of dayKeys) map.set(key, 0);
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private cacheHitRate(autoLogs: AiUsageLog[]): number {
    const hits = autoLogs.filter(l => l.status === 'cache_hit').length;
    const calls = autoLogs.filter(l => l.status === 'success' || l.status === 'failed').length;
    return hits + calls > 0 ? (hits / (hits + calls)) * 100 : 0;
  }

  private formatChartDate(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatStatusLabel(status: string): string {
    const s = status.toLowerCase();
    if (s === 'active') return 'Active';
    if (s === 'pending_review' || s === 'pending') return 'Pending';
    if (s === 'disabled') return 'Disabled';
    if (s === 'rejected') return 'Rejected';
    return status;
  }

  private formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  private formatDelta(current: number, previous: number, suffix = ''): string {
    const diff = current - previous;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}${suffix}`;
  }

  private formatCountDelta(current: number, previous: number): string {
    const diff = current - previous;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff}`;
  }

  private formatMoneyDelta(current: number, previous: number): string {
    const diff = current - previous;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}$${diff.toFixed(2)}`;
  }
}
