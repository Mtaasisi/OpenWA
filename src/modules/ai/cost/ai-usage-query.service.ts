import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { AiUsageFeature } from './ai-cost.types';

export interface UsageSummary {
  todayCostUsd: number;
  monthCostUsd: number;
  last7DaysCostUsd: number;
  autoReplyTodayCostUsd: number;
  adminTodayCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalAiCalls: number;
  averageCostPerReply: number;
  mostExpensiveModel: string | null;
  mostExpensiveFeature: string | null;
  cacheHitCount: number;
  cacheHitRate: number;
  moneySavedByCacheUsd: number;
  budgetBlockedCount: number;
  duplicateSkippedCount: number;
  promptBudgetWarningCount: number;
  averagePromptTokens: number;
  averageCompletionTokens: number;
}

@Injectable()
export class AiUsageQueryService {
  constructor(
    @InjectRepository(AiUsageLog, 'data')
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getSummary(): Promise<UsageSummary> {
    const dayStart = this.startOfDay();
    const monthStart = this.startOfMonth();
    const weekStart = this.daysAgo(7);

    const todayLogs = await this.usageRepo.find({
      where: { createdAt: Between(dayStart, new Date()) },
    });
    const monthLogs = await this.usageRepo.find({
      where: { createdAt: Between(monthStart, new Date()) },
    });
    const weekLogs = await this.usageRepo.find({
      where: { createdAt: Between(weekStart, new Date()) },
    });

    const sumCost = (logs: AiUsageLog[]) =>
      logs.reduce((s, l) => s + Number(l.actualCostUsd ?? 0), 0);

    const todayCostUsd = sumCost(todayLogs);
    const monthCostUsd = sumCost(monthLogs);
    const last7DaysCostUsd = sumCost(weekLogs);

    const autoReplyTodayCostUsd = sumCost(
      todayLogs.filter(l => l.feature === AiUsageFeature.WHATSAPP_AUTO_REPLY),
    );
    const adminTodayCostUsd = sumCost(
      todayLogs.filter(
        l =>
          l.feature === AiUsageFeature.ADMIN_ASSISTANT ||
          l.source === 'admin_manual',
      ),
    );

    const totalInputTokens = monthLogs.reduce((s, l) => s + l.inputTokens, 0);
    const totalOutputTokens = monthLogs.reduce((s, l) => s + l.outputTokens, 0);
    const totalAiCalls = monthLogs.reduce((s, l) => s + l.aiCallsCount, 0);

    const replyLogs = monthLogs.filter(
      l => l.feature === AiUsageFeature.WHATSAPP_AUTO_REPLY && l.status === 'success',
    );
    const averageCostPerReply =
      replyLogs.length > 0
        ? replyLogs.reduce((s, l) => s + Number(l.actualCostUsd), 0) / replyLogs.length
        : 0;

    const modelCosts = this.groupByCost(monthLogs, 'model');
    const featureCosts = this.groupByCost(monthLogs, 'feature');

    const cacheHits = todayLogs.filter(l => l.status === 'cache_hit');
    const aiCallsToday = todayLogs.filter(
      l => l.status === 'success' || l.status === 'failed',
    );
    const cacheHitRate =
      aiCallsToday.length + cacheHits.length > 0
        ? (cacheHits.length / (aiCallsToday.length + cacheHits.length)) * 100
        : 0;
    const avgReplyCost = averageCostPerReply || 0.002;
    const moneySavedByCacheUsd = cacheHits.length * avgReplyCost;

    const budgetBlockedCount = todayLogs.filter(l => l.status === 'budget_blocked').length;
    const duplicateSkippedCount = todayLogs.filter(l => l.status === 'duplicate_skipped').length;
    const promptBudgetWarningCount = todayLogs.filter(
      l => (l.metadata as Record<string, unknown> | null)?.budgetWarning != null,
    ).length;

    const successWithTokens = todayLogs.filter(l => l.inputTokens > 0 || l.outputTokens > 0);
    const averagePromptTokens =
      successWithTokens.length > 0
        ? successWithTokens.reduce((s, l) => s + l.inputTokens, 0) / successWithTokens.length
        : 0;
    const averageCompletionTokens =
      successWithTokens.length > 0
        ? successWithTokens.reduce((s, l) => s + l.outputTokens, 0) / successWithTokens.length
        : 0;

    return {
      todayCostUsd,
      monthCostUsd,
      last7DaysCostUsd,
      autoReplyTodayCostUsd,
      adminTodayCostUsd,
      totalInputTokens,
      totalOutputTokens,
      totalAiCalls,
      averageCostPerReply,
      mostExpensiveModel: modelCosts[0]?.key ?? null,
      mostExpensiveFeature: featureCosts[0]?.key ?? null,
      cacheHitCount: cacheHits.length,
      cacheHitRate,
      moneySavedByCacheUsd,
      budgetBlockedCount,
      duplicateSkippedCount,
      promptBudgetWarningCount,
      averagePromptTokens,
      averageCompletionTokens,
    };
  }

  private groupByCost(logs: AiUsageLog[], field: 'model' | 'feature') {
    const map = new Map<string, number>();
    for (const l of logs) {
      const k = l[field];
      map.set(k, (map.get(k) ?? 0) + Number(l.actualCostUsd));
    }
    return [...map.entries()]
      .map(([key, cost]) => ({ key, cost }))
      .sort((a, b) => b.cost - a.cost);
  }

  async getDailyCosts(days = 30): Promise<Array<{ date: string; costUsd: number }>> {
    const start = this.daysAgo(days);
    const logs = await this.usageRepo.find({
      where: { createdAt: Between(start, new Date()) },
      order: { createdAt: 'ASC' },
    });
    const map = new Map<string, number>();
    for (const l of logs) {
      const date = l.createdAt.toISOString().slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + Number(l.actualCostUsd));
    }
    return [...map.entries()].map(([date, costUsd]) => ({ date, costUsd }));
  }

  async getByModel(since?: Date): Promise<Array<{ model: string; provider: string; costUsd: number; calls: number }>> {
    const where = since ? { createdAt: Between(since, new Date()) } : {};
    const logs = await this.usageRepo.find({ where });
    const map = new Map<string, { provider: string; costUsd: number; calls: number }>();
    for (const l of logs) {
      const key = `${l.provider}:${l.model}`;
      const cur = map.get(key) ?? { provider: l.provider, costUsd: 0, calls: 0 };
      cur.costUsd += Number(l.actualCostUsd);
      cur.calls += l.aiCallsCount;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({
        model: key.split(':').slice(1).join(':'),
        provider: v.provider,
        costUsd: v.costUsd,
        calls: v.calls,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  async getByFeature(since?: Date): Promise<Array<{ feature: string; costUsd: number; calls: number }>> {
    const where = since ? { createdAt: Between(since, new Date()) } : {};
    const logs = await this.usageRepo.find({ where });
    const map = new Map<string, { costUsd: number; calls: number }>();
    for (const l of logs) {
      const cur = map.get(l.feature) ?? { costUsd: 0, calls: 0 };
      cur.costUsd += Number(l.actualCostUsd);
      cur.calls += l.aiCallsCount;
      map.set(l.feature, cur);
    }
    return [...map.entries()]
      .map(([feature, v]) => ({ feature, costUsd: v.costUsd, calls: v.calls }))
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  async getRecent(filters: {
    limit?: number;
    offset?: number;
    feature?: string;
    provider?: string;
    model?: string;
    status?: string;
    branchId?: string;
    conversationId?: string;
    batchId?: string;
    since?: Date;
    until?: Date;
  }): Promise<{ items: AiUsageLog[]; total: number }> {
    const qb = this.usageRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (filters.feature) qb.andWhere('log.feature = :feature', { feature: filters.feature });
    if (filters.provider) qb.andWhere('log.provider = :provider', { provider: filters.provider });
    if (filters.model) qb.andWhere('log.model = :model', { model: filters.model });
    if (filters.status) qb.andWhere('log.status = :status', { status: filters.status });
    if (filters.branchId) qb.andWhere('log.branchId = :branchId', { branchId: filters.branchId });
    if (filters.conversationId) {
      qb.andWhere('log.conversationId = :conversationId', {
        conversationId: filters.conversationId,
      });
    }
    if (filters.batchId) qb.andWhere('log.batchId = :batchId', { batchId: filters.batchId });
    if (filters.since) qb.andWhere('log.createdAt >= :since', { since: filters.since });
    if (filters.until) qb.andWhere('log.createdAt < :until', { until: filters.until });

    const total = await qb.getCount();
    const items = await qb
      .skip(filters.offset ?? 0)
      .take(filters.limit ?? 50)
      .getMany();

    return { items, total };
  }

  async exportCsv(since?: Date): Promise<string> {
    const where = since ? { createdAt: Between(since, new Date()) } : {};
    const logs = await this.usageRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 10000,
    });
    const header =
      'time,feature,provider,model,input_tokens,output_tokens,cost_usd,status,tool_calls,conversation_id,message_id';
    const rows = logs.map(l =>
      [
        l.createdAt.toISOString(),
        l.feature,
        l.provider,
        l.model,
        l.inputTokens,
        l.outputTokens,
        Number(l.actualCostUsd).toFixed(6),
        l.status,
        l.toolCallsCount,
        l.conversationId ?? '',
        l.messageId ?? '',
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async getPromptContributors(since?: Date): Promise<{
    sampleCount: number;
    rulesTokens: number;
    knowledgeTokens: number;
    historyTokens: number;
    toolsTokens: number;
    customerMessageTokens: number;
    crmTokens: number;
    catalogTokens: number;
    memoryTokens: number;
    topOffender: string | null;
  }> {
    const start = since ?? this.daysAgo(7);
    const logs = await this.usageRepo.find({
      where: {
        createdAt: Between(start, new Date()),
        feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
      },
      take: 500,
      order: { createdAt: 'DESC' },
    });

    const totals = {
      rules_tokens: 0,
      knowledge_tokens: 0,
      history_tokens: 0,
      tool_tokens: 0,
      customer_message_tokens: 0,
      crm_tokens: 0,
      catalog_tokens: 0,
      memory_tokens: 0,
    };
    let sampleCount = 0;

    for (const log of logs) {
      const breakdown = (log.metadata as Record<string, unknown> | null)?.promptBreakdown as
        | Record<string, number>
        | undefined;
      if (!breakdown) continue;
      sampleCount += 1;
      totals.rules_tokens += breakdown.rules_tokens ?? 0;
      totals.knowledge_tokens += breakdown.knowledge_tokens ?? 0;
      totals.history_tokens += breakdown.history_tokens ?? 0;
      totals.tool_tokens += breakdown.tool_tokens ?? 0;
      totals.customer_message_tokens += breakdown.customer_message_tokens ?? 0;
      totals.crm_tokens += breakdown.crm_tokens ?? 0;
      totals.catalog_tokens += breakdown.catalog_tokens ?? 0;
      totals.memory_tokens += breakdown.memory_tokens ?? 0;
    }

    const offenderEntries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return {
      sampleCount,
      rulesTokens: totals.rules_tokens,
      knowledgeTokens: totals.knowledge_tokens,
      historyTokens: totals.history_tokens,
      toolsTokens: totals.tool_tokens,
      customerMessageTokens: totals.customer_message_tokens,
      crmTokens: totals.crm_tokens,
      catalogTokens: totals.catalog_tokens,
      memoryTokens: totals.memory_tokens,
      topOffender: offenderEntries[0]?.[1] ? offenderEntries[0][0] : null,
    };
  }
}
