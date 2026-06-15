import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { FollowUpAttemptMode, FollowUpStatus } from './followup.enums';

export interface AutopilotReportFilters {
  staffId?: string;
  sessionId?: string;
  channel?: string;
  reason?: string;
  riskLevel?: string;
  from?: string;
  to?: string;
}

export interface AutopilotReport {
  suggestionsCreated: number;
  autoSent: number;
  needsApproval: number;
  stopped: number;
  failed: number;
  repliesReceived: number;
  convertedSales: number;
  smsFallbackUsed: number;
  whatsappFailed: number;
  bestTemplates: { templateId: string; count: number }[];
  worstTemplates: { templateId: string; failedCount: number }[];
  filters: AutopilotReportFilters;
}

@Injectable()
export class FollowupAutopilotReportService {
  constructor(
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(FollowupAttempt, 'data')
    private readonly attemptRepo: Repository<FollowupAttempt>,
  ) {}

  async getReport(filters: AutopilotReportFilters = {}): Promise<AutopilotReport> {
    const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = filters.to ? new Date(filters.to) : new Date();

    const qb = this.queueRepo
      .createQueryBuilder('q')
      .where('q.isAutopilot = :ap', { ap: true })
      .andWhere('q.createdAt BETWEEN :from AND :to', { from, to });

    if (filters.staffId) qb.andWhere('q.assignedStaffId = :staffId', { staffId: filters.staffId });
    if (filters.reason) qb.andWhere('q.detectedReason = :reason', { reason: filters.reason });
    if (filters.riskLevel) qb.andWhere('q.riskLevel = :risk', { risk: filters.riskLevel });

    const items = await qb.getMany();

    const suggestionsCreated = items.filter(i =>
      [FollowUpStatus.AI_SUGGESTED, FollowUpStatus.NEEDS_APPROVAL].includes(i.status as FollowUpStatus),
    ).length;
    const autoSent = items.filter(i => i.status === FollowUpStatus.AUTO_SENT).length;
    const needsApproval = items.filter(i => i.status === FollowUpStatus.NEEDS_APPROVAL).length;
    const stopped = items.filter(i => i.status === FollowUpStatus.STOPPED).length;
    const failed = items.filter(i => i.status === FollowUpStatus.FAILED).length;
    const smsFallbackUsed = items.filter(i => i.channelUsed?.includes('sms')).length;
    const whatsappFailed = items.filter(i => i.failureReason === 'whatsapp_failed').length;

    const templateCounts = new Map<string, number>();
    const templateFails = new Map<string, number>();
    for (const item of items) {
      if (!item.templateId) continue;
      if (item.status === FollowUpStatus.AUTO_SENT || item.status === FollowUpStatus.SENT) {
        templateCounts.set(item.templateId, (templateCounts.get(item.templateId) ?? 0) + 1);
      }
      if (item.status === FollowUpStatus.FAILED) {
        templateFails.set(item.templateId, (templateFails.get(item.templateId) ?? 0) + 1);
      }
    }

    const bestTemplates = [...templateCounts.entries()]
      .map(([templateId, count]) => ({ templateId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const worstTemplates = [...templateFails.entries()]
      .map(([templateId, failedCount]) => ({ templateId, failedCount }))
      .sort((a, b) => b.failedCount - a.failedCount)
      .slice(0, 5);

    const repliesReceived = await this.attemptRepo.count({
      where: {
        mode: FollowUpAttemptMode.AUTO_SEND,
        customerReplied: true,
        sentAt: Between(from, to),
      },
    });

    const convertedSales = items.filter(i => i.status === FollowUpStatus.CONVERTED).length;

    return {
      suggestionsCreated,
      autoSent,
      needsApproval,
      stopped,
      failed,
      repliesReceived,
      convertedSales,
      smsFallbackUsed,
      whatsappFailed,
      bestTemplates,
      worstTemplates,
      filters,
    };
  }

  async getDashboardSummary(): Promise<{
    autoSentToday: number;
    needsApproval: number;
    failed: number;
    pausedAccounts: string[];
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const autoSentToday = await this.queueRepo.count({
      where: { status: FollowUpStatus.AUTO_SENT, isAutopilot: true },
    });

    const needsApproval = await this.queueRepo.count({
      where: { status: FollowUpStatus.NEEDS_APPROVAL, isAutopilot: true },
    });

    const failed = await this.queueRepo.count({
      where: { status: FollowUpStatus.FAILED, isAutopilot: true },
    });

    return { autoSentToday, needsApproval, failed, pausedAccounts: [] };
  }
}
