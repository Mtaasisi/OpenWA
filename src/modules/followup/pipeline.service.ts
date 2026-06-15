import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { CrmSaleAttribution } from './entities/crm-sale-attribution.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import {
  ConversationStage,
  ConversationPriority,
  PipelineBucket,
  FollowUpStatus,
} from './followup.enums';
import { AuthService } from '../auth/auth.service';
import { FollowupConversationService } from './followup-conversation.service';
import {
  resolveCustomerName,
  resolveCustomerPhone,
} from '../../common/utils/inbox-display.util';

export interface PipelineCardView {
  id: string;
  sessionId: string;
  chatId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerHandle: string | null;
  source: string;
  channel: string | null;
  stage: string;
  productInterest: string | null;
  priority: string;
  budget: number | null;
  closedAt: string | null;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  nextFollowupAt: string | null;
  nextAction: string | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  isManual: boolean;
  linkedSaleId: string | null;
  responseTimeSeconds: number | null;
  customerId: string | null;
  inauzwaCustomerId: string | null;
  crmResolved: boolean;
  crmInternalNote: string | null;
  crmFollowUpAt: string | null;
  linkedThreadCount: number;
}

export interface CustomerProfileView {
  profileKey: string;
  displayName: string | null;
  displayPhone: string | null;
  inauzwaCustomerId: string | null;
  linkedThreadCount: number;
  primaryConversationId: string;
  conversations: PipelineCardView[];
  stats: {
    openLeads: number;
    wonLeads: number;
    lostLeads: number;
    latestActivityAt: string | null;
  };
}

export interface PipelineDashboardStats {
  totalLeadsToday: number;
  leadsBySource: Record<string, number>;
  leadsByStaff: Record<string, number>;
  leadsByStage: Record<string, number>;
  wonLeads: number;
  lostLeads: number;
  lostReasonBreakdown: Record<string, number>;
  conversionRate: number;
  averageResponseTimeSeconds: number;
  overdueFollowups: number;
  paymentPending: number;
  hotLeadsIgnored: number;
  salesLinked: number;
}

export interface LeadSourceReport {
  leadsBySource: Record<string, number>;
  salesBySource: Record<string, number>;
  revenueBySource: Record<string, number>;
  grossProfitBySource: Record<string, number>;
  conversionBySource: Record<string, { total: number; won: number; lost: number; rate: number }>;
  leadsByStaffAndSource: Record<string, Record<string, number>>;
  lostLeadsBySource: Record<string, number>;
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  totalGrossProfit: number;
}

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(FollowupConversation, 'data')
    private readonly convRepo: Repository<FollowupConversation>,
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(CrmSaleAttribution, 'data')
    private readonly saleAttrRepo: Repository<CrmSaleAttribution>,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    private readonly authService: AuthService,
    private readonly conversationService: FollowupConversationService,
  ) {}

  async listBucket(
    bucket: PipelineBucket,
    branchId?: string,
    staffId?: string,
    source?: string,
  ): Promise<PipelineCardView[]> {
    const qb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(qb, branchId, staffId, source);
    this.applyPrivateCustomerFilter(qb);
    this.applyBucketFilter(qb, bucket);

    qb.orderBy('c.updatedAt', 'DESC').take(200);
    const rows = await qb.getMany();
    return this.enrichCards(rows);
  }

  async getBucketCounts(
    branchId?: string,
    staffId?: string,
    source?: string,
  ): Promise<Record<PipelineBucket, number>> {
    const counts = {} as Record<PipelineBucket, number>;
    for (const bucket of Object.values(PipelineBucket)) {
      const qb = this.convRepo.createQueryBuilder('c');
      this.applyBaseFilters(qb, branchId, staffId, source);
      this.applyPrivateCustomerFilter(qb);
      this.applyBucketFilter(qb, bucket);
      counts[bucket] = await qb.getCount();
    }
    return counts;
  }

  async searchLeads(
    query: string,
    branchId?: string,
    staffId?: string,
    source?: string,
    limit = 50,
  ): Promise<PipelineCardView[]> {
    const q = query.trim();
    if (!q) return [];

    const qb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(qb, branchId, staffId, source);
    this.applyPrivateCustomerFilter(qb);
    const like = `%${q}%`;
    qb.andWhere(
      '(c.customerName LIKE :like OR c.customerPhone LIKE :like OR c.customerHandle LIKE :like OR c.productInterest LIKE :like OR c.chatId LIKE :like)',
      { like },
    );
    qb.orderBy('c.updatedAt', 'DESC').take(Math.min(limit, 100));
    return this.enrichCards(await qb.getMany());
  }

  async listCustomers(options: {
    q?: string;
    stage?: string;
    branchId?: string;
    staffId?: string;
    source?: string;
    unidentifiedOnly?: boolean;
    resolvedOnly?: boolean;
    followUpDueOnly?: boolean;
    multiThreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: PipelineCardView[];
    total: number;
    stats: { total: number; unidentified: number; activeThisWeek: number };
  }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const q = options.q?.trim();

    const qb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(qb, options.branchId, options.staffId, options.source);
    this.applyPrivateCustomerFilter(qb);

    const needsCrmJoin = options.resolvedOnly || options.followUpDueOnly;
    if (needsCrmJoin) {
      qb.leftJoin(
        InboxThreadCrm,
        'threadCrm',
        'threadCrm.sessionId = c.sessionId AND threadCrm.chatId = c.chatId',
      );
    }

    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        '(c.customerName LIKE :like OR c.customerPhone LIKE :like OR c.customerHandle LIKE :like OR c.productInterest LIKE :like OR c.chatId LIKE :like)',
        { like },
      );
    }

    if (options.stage) {
      qb.andWhere('c.stage = :stage', { stage: options.stage });
    }

    if (options.unidentifiedOnly) {
      qb.andWhere("(c.customerName IS NULL OR c.customerName = '')");
    }

    if (options.resolvedOnly) {
      qb.andWhere('threadCrm.resolved = :resolved', { resolved: true });
    }

    if (options.followUpDueOnly) {
      const now = new Date();
      qb.andWhere(
        '(threadCrm.followUpAt IS NOT NULL AND threadCrm.followUpAt <= :now) OR (c.nextFollowupAt IS NOT NULL AND c.nextFollowupAt <= :now)',
        { now },
      );
    }

    if (options.multiThreadOnly) {
      const tails = await this.phoneTailsWithMultipleThreads(options.branchId);
      if (tails.length === 0) {
        const stats = await this.getCustomerPageStats(options.branchId);
        return { data: [], total: 0, stats };
      }
      qb.andWhere(
        tails
          .map((_tail, i) => `c.customerPhone LIKE :mt${i}`)
          .join(' OR '),
        Object.fromEntries(tails.map((tail, i) => [`mt${i}`, `%${tail}%`])),
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('c.updatedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const stats = await this.getCustomerPageStats(options.branchId);

    const data = await this.attachLinkedThreadCounts(await this.enrichCards(rows));

    return {
      data,
      total,
      stats,
    };
  }

  async getCustomerProfile(conversationId: string): Promise<CustomerProfileView | null> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) return null;

    const [primaryEnriched] = await this.enrichCards([conv]);
    const phoneKey = this.phoneProfileKey(primaryEnriched.customerPhone);
    let conversations: PipelineCardView[];

    if (phoneKey) {
      const tail = phoneKey;
      const rows = await this.convRepo
        .createQueryBuilder('c')
        .where('c.customerPhone IS NOT NULL')
        .andWhere("c.customerPhone != ''")
        .andWhere('c.customerPhone LIKE :like', { like: `%${tail}%` })
        .orderBy('c.updatedAt', 'DESC')
        .take(50)
        .getMany();
      conversations = await this.attachLinkedThreadCounts(await this.enrichCards(rows));
    } else {
      conversations = await this.attachLinkedThreadCounts(await this.enrichCards([conv]));
    }

    const closedStages = new Set<string>([
      ConversationStage.WON,
      ConversationStage.LOST,
      ConversationStage.DEAD_NO_RESPONSE,
    ]);
    let latestActivity = 0;
    for (const c of conversations) {
      const customer = c.lastCustomerMessageAt ? new Date(c.lastCustomerMessageAt).getTime() : 0;
      const staff = c.lastStaffMessageAt ? new Date(c.lastStaffMessageAt).getTime() : 0;
      latestActivity = Math.max(latestActivity, customer, staff);
    }

    const wonLeads = conversations.filter((c) => c.stage === ConversationStage.WON).length;
    const lostLeads = conversations.filter(
      (c) =>
        c.stage === ConversationStage.LOST || c.stage === ConversationStage.DEAD_NO_RESPONSE,
    ).length;
    const openLeads = conversations.filter((c) => !closedStages.has(c.stage)).length;

    const primaryCard = conversations.find((c) => c.id === conv.id) ?? conversations[0] ?? primaryEnriched;
    const displayName =
      primaryCard.customerName ||
      conversations.find((c) => c.customerName)?.customerName ||
      conv.customerHandle ||
      null;
    const inauzwaCustomerId =
      conv.customerId ??
      conversations.find((c) => c.inauzwaCustomerId)?.inauzwaCustomerId ??
      null;

    return {
      profileKey: phoneKey ?? inauzwaCustomerId ?? conv.id,
      displayName,
      displayPhone: primaryCard.customerPhone,
      inauzwaCustomerId,
      linkedThreadCount: conversations.length,
      primaryConversationId: conversations[0]?.id ?? conv.id,
      conversations,
      stats: {
        openLeads,
        wonLeads,
        lostLeads,
        latestActivityAt: latestActivity ? new Date(latestActivity).toISOString() : null,
      },
    };
  }

  private async getCustomerPageStats(branchId?: string): Promise<{
    total: number;
    unidentified: number;
    activeThisWeek: number;
  }> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const totalQb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(totalQb, branchId);
    this.applyPrivateCustomerFilter(totalQb);
    const total = await totalQb.getCount();

    const unidentQb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(unidentQb, branchId);
    this.applyPrivateCustomerFilter(unidentQb);
    unidentQb.andWhere("(c.customerName IS NULL OR c.customerName = '')");
    const unidentified = await unidentQb.getCount();

    const activeQb = this.convRepo.createQueryBuilder('c');
    this.applyBaseFilters(activeQb, branchId);
    this.applyPrivateCustomerFilter(activeQb);
    activeQb.andWhere('c.updatedAt >= :weekAgo', { weekAgo });
    const activeThisWeek = await activeQb.getCount();

    return { total, unidentified, activeThisWeek };
  }

  async listRelatedByPhone(conversationId: string, limit = 8): Promise<PipelineCardView[]> {
    const profile = await this.getCustomerProfile(conversationId);
    if (!profile || profile.linkedThreadCount <= 1) return [];
    return profile.conversations
      .filter((c) => c.id !== conversationId)
      .slice(0, Math.min(limit, 20));
  }

  private phoneProfileKey(phone: string | null | undefined): string | null {
    if (!phone?.trim()) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) return null;
    return digits.slice(-9);
  }

  private async phoneTailsWithMultipleThreads(branchId?: string): Promise<string[]> {
    const qb = this.convRepo.createQueryBuilder('c').select(['c.customerPhone']);
    this.applyBaseFilters(qb, branchId);
    qb.andWhere('c.customerPhone IS NOT NULL').andWhere("c.customerPhone != ''");
    const rows = await qb.getMany();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = this.phoneProfileKey(row.customerPhone);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  }

  private async attachLinkedThreadCounts(cards: PipelineCardView[]): Promise<PipelineCardView[]> {
    if (cards.length === 0) return cards;

    const tails = [
      ...new Set(
        cards.map((c) => this.phoneProfileKey(c.customerPhone)).filter((k): k is string => !!k),
      ),
    ];
    if (tails.length === 0) {
      return cards.map((c) => ({ ...c, linkedThreadCount: 1 }));
    }

    const countQb = this.convRepo.createQueryBuilder('c').select(['c.customerPhone']);
    countQb.where('c.customerPhone IS NOT NULL').andWhere("c.customerPhone != ''");
    countQb.andWhere(
      tails.map((_tail, i) => `c.customerPhone LIKE :tail${i}`).join(' OR '),
      Object.fromEntries(tails.map((tail, i) => [`tail${i}`, `%${tail}%`])),
    );
    const phoneRows = await countQb.getMany();

    const counts = new Map<string, number>();
    for (const row of phoneRows) {
      const key = this.phoneProfileKey(row.customerPhone);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return cards.map((c) => {
      const key = this.phoneProfileKey(c.customerPhone);
      return { ...c, linkedThreadCount: key ? (counts.get(key) ?? 1) : 1 };
    });
  }

  async listRecentSales(limit = 15, branchId?: string) {
    const qb = this.saleAttrRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(limit, 50));
    if (branchId) {
      qb.andWhere('a.branchId = :branchId', { branchId });
    }
    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      saleId: r.saleId,
      leadSource: r.leadSource,
      amount: r.amount,
      grossProfit: r.grossProfit,
      conversationId: r.conversationId,
      quoteId: r.quoteId,
      branchId: r.branchId,
      createdAt: r.createdAt,
    }));
  }

  /** Lead/customer views = private chats + manual leads (exclude WhatsApp group threads). */
  private applyPrivateCustomerFilter(
    qb: ReturnType<Repository<FollowupConversation>['createQueryBuilder']>,
  ): void {
    qb.andWhere("(c.chatId NOT LIKE '%@g.us' OR c.isManual = :isManual)", { isManual: true });
  }

  private applyBaseFilters(
    qb: ReturnType<Repository<FollowupConversation>['createQueryBuilder']>,
    branchId?: string,
    staffId?: string,
    source?: string,
  ): void {
    if (branchId) {
      qb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    }
    if (staffId) {
      qb.andWhere('c.assignedStaffId = :staffId', { staffId });
    }
    if (source) {
      qb.andWhere('c.source = :source', { source });
    }
  }

  private applyBucketFilter(
    qb: ReturnType<Repository<FollowupConversation>['createQueryBuilder']>,
    bucket: PipelineBucket,
  ): void {
    switch (bucket) {
      case PipelineBucket.NEW_LEADS:
        qb.andWhere('c.stage IN (:...stages)', {
          stages: [ConversationStage.NEW_LEAD],
        });
        break;
      case PipelineBucket.WAITING_REPLY:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.WAITING_CUSTOMER_REPLY });
        break;
      case PipelineBucket.FOLLOWUP_NEEDED:
        qb.andWhere(
          '(c.stage = :fn OR c.followupRequired = :fr OR c.nextFollowupAt IS NOT NULL)',
          { fn: ConversationStage.FOLLOWUP_NEEDED, fr: true },
        );
        break;
      case PipelineBucket.PAYMENT_PENDING:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.PAYMENT_PENDING });
        break;
      case PipelineBucket.HOT_LEADS:
        qb.andWhere('(c.priority = :hot OR c.stage IN (:...hotStages))', {
          hot: ConversationPriority.HOT,
          hotStages: [
            ConversationStage.NEGOTIATING,
            ConversationStage.PRICE_SENT,
            ConversationStage.PAYMENT_PENDING,
          ],
        });
        break;
      case PipelineBucket.LOST_LEADS:
        qb.andWhere('c.stage IN (:...stages)', {
          stages: [ConversationStage.LOST, ConversationStage.DEAD_NO_RESPONSE],
        });
        break;
      case PipelineBucket.WON_LEADS:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.WON });
        break;
    }
  }

  async getDashboardStats(branchId?: string): Promise<PipelineDashboardStats> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const qb = this.convRepo.createQueryBuilder('c');
    if (branchId) qb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    const all = await qb.getMany();

    const today = all.filter(c => c.createdAt >= startOfDay);

    const leadsBySource: Record<string, number> = {};
    const leadsByStaff: Record<string, number> = {};
    const leadsByStage: Record<string, number> = {};
    const lostReasonBreakdown: Record<string, number> = {};

    let totalResponse = 0;
    let responseCount = 0;

    for (const c of all) {
      leadsBySource[c.source] = (leadsBySource[c.source] ?? 0) + 1;
      if (c.assignedStaffId) {
        leadsByStaff[c.assignedStaffId] = (leadsByStaff[c.assignedStaffId] ?? 0) + 1;
      }
      leadsByStage[c.stage] = (leadsByStage[c.stage] ?? 0) + 1;
      if (c.lostReason) {
        lostReasonBreakdown[c.lostReason] = (lostReasonBreakdown[c.lostReason] ?? 0) + 1;
      }
      if (c.responseTimeSeconds != null) {
        totalResponse += c.responseTimeSeconds;
        responseCount++;
      }
    }

    const won = all.filter(c => c.stage === ConversationStage.WON).length;
    const lost = all.filter(c => c.stage === ConversationStage.LOST).length;
    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

    const now = new Date();
    const overdueFollowups = await this.queueRepo.count({
      where: {
        status: In([FollowUpStatus.PENDING, FollowUpStatus.DUE, FollowUpStatus.ESCALATED]),
        dueAt: LessThanOrEqual(now),
      },
    });

    const paymentPending = all.filter(c => c.stage === ConversationStage.PAYMENT_PENDING).length;

    const hotLeadsIgnored = all.filter(
      c =>
        (c.priority === ConversationPriority.HOT ||
          c.stage === ConversationStage.NEGOTIATING) &&
        c.lastStaffMessageAt &&
        c.lastCustomerMessageAt &&
        c.lastCustomerMessageAt > c.lastStaffMessageAt,
    ).length;

    const salesLinked = all.filter(c => c.linkedSaleId).length;

    const staffNames = await this.staffNameMap();
    const leadsByStaffNamed: Record<string, number> = {};
    for (const [id, count] of Object.entries(leadsByStaff)) {
      leadsByStaffNamed[staffNames.get(id) ?? id] = count;
    }

    return {
      totalLeadsToday: today.length,
      leadsBySource,
      leadsByStaff: leadsByStaffNamed,
      leadsByStage,
      wonLeads: won,
      lostLeads: lost,
      lostReasonBreakdown,
      conversionRate,
      averageResponseTimeSeconds:
        responseCount > 0 ? Math.round(totalResponse / responseCount) : 0,
      overdueFollowups,
      paymentPending,
      hotLeadsIgnored,
      salesLinked,
    };
  }

  async getConversionReport(branchId?: string, from?: string, to?: string) {
    const qb = this.convRepo.createQueryBuilder('c');
    if (branchId) qb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    if (from) qb.andWhere('c.createdAt >= :from', { from: new Date(from) });
    if (to) qb.andWhere('c.createdAt <= :to', { to: new Date(to) });

    const rows = await qb.getMany();
    const bySource: Record<string, { total: number; won: number; lost: number }> = {};
    const byStaff: Record<string, { total: number; won: number; lost: number }> = {};

    for (const c of rows) {
      if (!bySource[c.source]) bySource[c.source] = { total: 0, won: 0, lost: 0 };
      bySource[c.source].total++;
      if (c.stage === ConversationStage.WON) bySource[c.source].won++;
      if (c.stage === ConversationStage.LOST) bySource[c.source].lost++;

      const staff = c.assignedStaffId ?? 'unassigned';
      if (!byStaff[staff]) byStaff[staff] = { total: 0, won: 0, lost: 0 };
      byStaff[staff].total++;
      if (c.stage === ConversationStage.WON) byStaff[staff].won++;
      if (c.stage === ConversationStage.LOST) byStaff[staff].lost++;
    }

    const staffMap = await this.staffNameMap();
    const byStaffNamed: Record<string, { total: number; won: number; lost: number }> = {};
    for (const [id, stats] of Object.entries(byStaff)) {
      const label = id === 'unassigned' ? 'unassigned' : (staffMap.get(id) ?? id);
      byStaffNamed[label] = stats;
    }

    return { bySource, byStaff: byStaffNamed, total: rows.length };
  }

  async getLeadSourceReport(
    branchId?: string,
    from?: string,
    to?: string,
  ): Promise<LeadSourceReport> {
    const convQb = this.convRepo.createQueryBuilder('c');
    if (branchId) convQb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    if (from) convQb.andWhere('c.createdAt >= :from', { from: new Date(from) });
    if (to) convQb.andWhere('c.createdAt <= :to', { to: new Date(to) });
    const conversations = await convQb.getMany();

    const attrQb = this.saleAttrRepo.createQueryBuilder('a');
    if (branchId) attrQb.andWhere('(a.branchId = :branchId OR a.branchId IS NULL)', { branchId });
    if (from) attrQb.andWhere('a.createdAt >= :from', { from: new Date(from) });
    if (to) attrQb.andWhere('a.createdAt <= :to', { to: new Date(to) });
    const attributions = await attrQb.getMany();

    const leadsBySource: Record<string, number> = {};
    const conversionBySource: Record<string, { total: number; won: number; lost: number; rate: number }> = {};
    const leadsByStaffAndSource: Record<string, Record<string, number>> = {};
    const lostLeadsBySource: Record<string, number> = {};

    for (const c of conversations) {
      const src = c.source ?? 'other';
      leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;

      if (!conversionBySource[src]) {
        conversionBySource[src] = { total: 0, won: 0, lost: 0, rate: 0 };
      }
      conversionBySource[src].total++;
      if (c.stage === ConversationStage.WON) conversionBySource[src].won++;
      if (c.stage === ConversationStage.LOST || c.stage === ConversationStage.DEAD_NO_RESPONSE) {
        conversionBySource[src].lost++;
        lostLeadsBySource[src] = (lostLeadsBySource[src] ?? 0) + 1;
      }

      const staffKey = c.assignedStaffId ?? 'unassigned';
      if (!leadsByStaffAndSource[staffKey]) leadsByStaffAndSource[staffKey] = {};
      leadsByStaffAndSource[staffKey][src] = (leadsByStaffAndSource[staffKey][src] ?? 0) + 1;
    }

    for (const stats of Object.values(conversionBySource)) {
      const closed = stats.won + stats.lost;
      stats.rate = closed > 0 ? Math.round((stats.won / closed) * 1000) / 10 : 0;
    }

    const salesBySource: Record<string, number> = {};
    const revenueBySource: Record<string, number> = {};
    const grossProfitBySource: Record<string, number> = {};
    let totalRevenue = 0;
    let totalGrossProfit = 0;

    for (const a of attributions) {
      const src = a.leadSource ?? 'other';
      salesBySource[src] = (salesBySource[src] ?? 0) + 1;
      if (a.amount != null) {
        revenueBySource[src] = (revenueBySource[src] ?? 0) + a.amount;
        totalRevenue += a.amount;
      }
      if (a.grossProfit != null) {
        grossProfitBySource[src] = (grossProfitBySource[src] ?? 0) + a.grossProfit;
        totalGrossProfit += a.grossProfit;
      }
    }

    const staffMap = await this.staffNameMap();
    const leadsByStaffAndSourceNamed: Record<string, Record<string, number>> = {};
    for (const [staffId, bySrc] of Object.entries(leadsByStaffAndSource)) {
      const label = staffId === 'unassigned' ? 'unassigned' : (staffMap.get(staffId) ?? staffId);
      leadsByStaffAndSourceNamed[label] = bySrc;
    }

    const totalSales = attributions.length;

    return {
      leadsBySource,
      salesBySource,
      revenueBySource,
      grossProfitBySource,
      conversionBySource,
      leadsByStaffAndSource: leadsByStaffAndSourceNamed,
      lostLeadsBySource,
      totalLeads: conversations.length,
      totalSales,
      totalRevenue: Math.round(totalRevenue),
      totalGrossProfit: Math.round(totalGrossProfit),
    };
  }

  async getAbandonedReport(branchId?: string) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const qb = this.convRepo
      .createQueryBuilder('c')
      .where('c.stage NOT IN (:...closed)', {
        closed: [ConversationStage.WON, ConversationStage.LOST, ConversationStage.DEAD_NO_RESPONSE],
      })
      .andWhere('c.lastCustomerMessageAt IS NOT NULL')
      .andWhere('c.lastCustomerMessageAt < :cutoff', { cutoff: threeDaysAgo })
      .andWhere(
        '(c.lastStaffMessageAt IS NULL OR c.lastStaffMessageAt < c.lastCustomerMessageAt)',
      );
    if (branchId) qb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    const rows = await qb.orderBy('c.lastCustomerMessageAt', 'ASC').take(100).getMany();
    return this.enrichCards(rows);
  }

  private async enrichCards(rows: FollowupConversation[]): Promise<PipelineCardView[]> {
    const staffMap = await this.staffNameMap();
    const crmMap = await this.loadCrmByThreads(rows);
    const titleMap = rows.length > 0 ? await this.conversationService.chatTitlesForThreads(rows) : new Map();

    return rows.map((c) => {
      const crmKey = `${c.sessionId}:${c.chatId}`;
      const crm = c.sessionId !== 'manual' ? crmMap.get(crmKey) : undefined;
      const crmFollowUpAt = crm?.followUpAt ?? c.nextFollowupAt ?? null;
      const inauzwaCustomerId = c.customerId ?? crm?.linkedExternalId ?? null;

      const customerPhone = resolveCustomerPhone(
        c.chatId,
        c.customerPhone,
        crm?.customerPhone,
      );
      const chatTitle = titleMap.get(`${c.sessionId}:${c.chatId}`);
      const chatTitleName =
        chatTitle && !c.chatId.endsWith('@g.us')
          ? resolveCustomerName(c.chatId, chatTitle)
          : null;
      const customerName =
        resolveCustomerName(c.chatId, chatTitle, c.customerName, crm?.customerName) || chatTitleName || null;

      return {
        id: c.id,
        sessionId: c.sessionId,
        chatId: c.chatId,
        customerName,
        customerPhone,
        customerHandle: c.customerHandle,
        source: c.source,
        channel: c.channel,
        stage: c.stage,
        productInterest: c.productInterest,
        priority: c.priority,
        budget: c.budget,
        closedAt: c.closedAt?.toISOString() ?? null,
        lastCustomerMessageAt: c.lastCustomerMessageAt?.toISOString() ?? null,
        lastStaffMessageAt: c.lastStaffMessageAt?.toISOString() ?? null,
        nextFollowupAt: c.nextFollowupAt?.toISOString() ?? null,
        nextAction: c.nextAction,
        assignedStaffId: c.assignedStaffId,
        assignedStaffName: c.assignedStaffId ? (staffMap.get(c.assignedStaffId) ?? null) : null,
        isManual: c.isManual,
        linkedSaleId: c.linkedSaleId,
        responseTimeSeconds: c.responseTimeSeconds,
        customerId: c.customerId,
        inauzwaCustomerId,
        crmResolved: crm?.resolved ?? false,
        crmInternalNote: crm?.internalNote ?? c.internalNote ?? null,
        crmFollowUpAt: crmFollowUpAt?.toISOString() ?? null,
        linkedThreadCount: 1,
      };
    });
  }

  private async loadCrmByThreads(
    rows: FollowupConversation[],
  ): Promise<Map<string, InboxThreadCrm>> {
    const map = new Map<string, InboxThreadCrm>();
    const pairs = rows.filter((r) => r.sessionId && r.sessionId !== 'manual');
    if (pairs.length === 0) return map;

    const qb = this.crmRepo.createQueryBuilder('crm');
    pairs.forEach((p, i) => {
      const clause = `(crm.sessionId = :sid${i} AND crm.chatId = :cid${i})`;
      const params = { [`sid${i}`]: p.sessionId, [`cid${i}`]: p.chatId };
      if (i === 0) qb.where(clause, params);
      else qb.orWhere(clause, params);
    });

    const crmRows = await qb.getMany();
    for (const crm of crmRows) {
      map.set(`${crm.sessionId}:${crm.chatId}`, crm);
    }
    return map;
  }

  private async staffNameMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const keys = await this.authService.findAll();
      for (const k of keys) map.set(k.id, k.name);
    } catch {
      /* optional */
    }
    return map;
  }
}
