import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupStaffKpi } from './entities/followup-staff-kpi.entity';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowUpStatus, ConversationStage } from './followup.enums';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { In, LessThanOrEqual } from 'typeorm';

export interface KpiReportRow {
  staffId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  followupsDue: number;
  followupsCompletedOnTime: number;
  followupsCompletedLate: number;
  followupsMissed: number;
  overdueFollowups: number;
  conversionsAfterFollowup: number;
  lostLeadsWithoutFollowup: number;
  averageResponseTimeMs: number;
}

@Injectable()
export class FollowupKpiService {
  constructor(
    @InjectRepository(FollowupStaffKpi, 'data')
    private readonly kpiRepo: Repository<FollowupStaffKpi>,
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(FollowupConversation, 'data')
    private readonly convRepo: Repository<FollowupConversation>,
  ) {}

  async refreshDailyMetrics(): Promise<void> {
    const now = new Date();
    const periodStart = now.toISOString().slice(0, 10);
    const periodEnd = periodStart;

    const staffIds = await this.queueRepo
      .createQueryBuilder('q')
      .select('DISTINCT q.assignedStaffId', 'staffId')
      .where('q.assignedStaffId IS NOT NULL')
      .getRawMany<{ staffId: string }>();

    for (const { staffId } of staffIds) {
      if (!staffId) continue;
      await this.computeStaffKpi(staffId, periodStart, periodEnd);
    }
  }

  async computeStaffKpi(staffId: string, periodStart: string, periodEnd: string): Promise<FollowupStaffKpi> {
    const start = new Date(`${periodStart}T00:00:00`);
    const end = new Date(`${periodEnd}T23:59:59`);

    const items = await this.queueRepo.find({
      where: { assignedStaffId: staffId },
    });

    const dueToday = items.filter(i => i.dueAt >= start && i.dueAt <= end);
    const completed = items.filter(i => i.status === FollowUpStatus.COMPLETED);
    const missed = items.filter(i => i.status === FollowUpStatus.MISSED || i.kpiPenaltyFlag);
    const overdue = items.filter(
      i =>
        i.dueAt < new Date() &&
        [FollowUpStatus.PENDING, FollowUpStatus.DUE, FollowUpStatus.ESCALATED].includes(i.status),
    );

    const onTime = completed.filter(c => c.updatedAt <= c.dueAt);
    const late = completed.filter(c => c.updatedAt > c.dueAt);

    const convs = await this.convRepo.find({
      where: { assignedStaffId: staffId, stage: ConversationStage.WON },
    });
    const conversions = convs.filter(c => c.followupCompletedBeforeClose).length;

    const lostWithout = await this.convRepo.count({
      where: {
        assignedStaffId: staffId,
        stage: ConversationStage.LOST,
        followupCompletedBeforeClose: false,
      },
    });

    const withResponse = await this.convRepo
      .createQueryBuilder('c')
      .where('c.assignedStaffId = :staffId', { staffId })
      .andWhere('c.responseTimeSeconds IS NOT NULL')
      .getMany();
    const avgResponseMs =
      withResponse.length > 0
        ? Math.round(
            withResponse.reduce((sum, c) => sum + (c.responseTimeSeconds ?? 0), 0) /
              withResponse.length,
          ) * 1000
        : 0;

    let row = await this.kpiRepo.findOne({ where: { staffId, periodStart } });
    if (!row) {
      row = this.kpiRepo.create({ staffId, periodStart, periodEnd });
    }

    row.followupsDue = dueToday.length;
    row.followupsCompletedOnTime = onTime.length;
    row.followupsCompletedLate = late.length;
    row.followupsMissed = missed.length;
    row.overdueFollowups = overdue.length;
    row.conversionsAfterFollowup = conversions;
    row.lostLeadsWithoutFollowup = lostWithout;
    row.averageResponseTimeMs = avgResponseMs;

    return this.kpiRepo.save(row);
  }

  async getReports(branchId?: string, periodStart?: string): Promise<KpiReportRow[]> {
    const qb = this.kpiRepo.createQueryBuilder('k').orderBy('k.periodStart', 'DESC');
    if (branchId) qb.andWhere('k.branchId = :branchId', { branchId });
    if (periodStart) qb.andWhere('k.periodStart = :periodStart', { periodStart });

    const rows = await qb.take(100).getMany();
    return rows.map(r => ({
      staffId: r.staffId,
      branchId: r.branchId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      followupsDue: r.followupsDue,
      followupsCompletedOnTime: r.followupsCompletedOnTime,
      followupsCompletedLate: r.followupsCompletedLate,
      followupsMissed: r.followupsMissed,
      overdueFollowups: r.overdueFollowups,
      conversionsAfterFollowup: r.conversionsAfterFollowup,
      lostLeadsWithoutFollowup: r.lostLeadsWithoutFollowup,
      averageResponseTimeMs: r.averageResponseTimeMs,
    }));
  }
}
