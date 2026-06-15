import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppSendAudit } from '../entities/whatsapp-send-audit.entity';
import { WhatsAppSendQueue } from '../entities/whatsapp-send-queue.entity';
import {
  WhatsAppMessageType,
  WhatsAppQueueStatus,
  WhatsAppRiskLevel,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';
import type { GuardDecision } from './whatsapp-policy-guard.service';
import { hashMessageBody } from '../utils/message-body-hash.util';

@Injectable()
export class WhatsAppSendAuditService {
  constructor(
    @InjectRepository(WhatsAppSendAudit, 'data')
    private readonly repo: Repository<WhatsAppSendAudit>,
    @InjectRepository(WhatsAppSendQueue, 'data')
    private readonly queueRepo: Repository<WhatsAppSendQueue>,
  ) {}

  async log(params: {
    sessionId: string;
    phone?: string | null;
    chatId?: string | null;
    customerId?: string | null;
    source: WhatsAppSendSource;
    messageType: WhatsAppMessageType;
    decision: WhatsAppSendAuditDecision;
    reason: string;
    riskLevel?: WhatsAppRiskLevel;
    guardChecks?: Record<string, unknown> | null;
    queueItemId?: string | null;
    guardDecision?: GuardDecision;
    body?: string | null;
  }): Promise<WhatsAppSendAudit> {
    const bodyHash = params.body ? hashMessageBody(params.body) : null;
    const row = this.repo.create({
      sessionId: params.sessionId,
      phone: params.phone ?? null,
      chatId: params.chatId ?? null,
      customerId: params.customerId ?? null,
      source: params.source,
      messageType: params.messageType,
      decision: params.decision,
      reason: params.reason,
      riskLevel: params.riskLevel ?? params.guardDecision?.riskLevel ?? WhatsAppRiskLevel.LOW,
      guardChecks: params.guardChecks ?? params.guardDecision?.guardChecks ?? null,
      queueItemId: params.queueItemId ?? null,
      bodyHash,
    });
    return this.repo.save(row);
  }

  async countBlockedToday(sessionId?: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.createdAt >= :start', { start })
      .andWhere('a.decision = :decision', { decision: WhatsAppSendAuditDecision.BLOCKED });
    if (sessionId) qb.andWhere('a.sessionId = :sessionId', { sessionId });
    return qb.getCount();
  }

  async recent(limit = 50, sessionId?: string): Promise<WhatsAppSendAudit[]> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(limit);
    if (sessionId) qb.where('a.sessionId = :sessionId', { sessionId });
    return qb.getMany();
  }

  async countSendsInLastHour(sessionId: string): Promise<number> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.createdAt >= :since', { since })
      .andWhere('a.decision IN (:...decisions)', {
        decisions: [WhatsAppSendAuditDecision.SENT, WhatsAppSendAuditDecision.ALLOWED],
      })
      .getCount();
  }

  async countSendsToday(sessionId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.createdAt >= :start', { start })
      .andWhere('a.decision IN (:...decisions)', {
        decisions: [WhatsAppSendAuditDecision.SENT, WhatsAppSendAuditDecision.ALLOWED],
      })
      .getCount();
  }

  async countAutoRepliesTodayForContact(sessionId: string, chatId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.chatId = :chatId', { chatId })
      .andWhere('a.createdAt >= :start', { start })
      .andWhere('a.messageType = :messageType', { messageType: WhatsAppMessageType.AI_AUTO_REPLY })
      .andWhere('a.decision = :decision', { decision: WhatsAppSendAuditDecision.SENT })
      .getCount();
  }

  async countAutoRepliesInLastHour(sessionId: string): Promise<number> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.createdAt >= :since', { since })
      .andWhere('a.messageType = :messageType', { messageType: WhatsAppMessageType.AI_AUTO_REPLY })
      .andWhere('a.decision IN (:...decisions)', {
        decisions: [WhatsAppSendAuditDecision.SENT, WhatsAppSendAuditDecision.QUEUED, WhatsAppSendAuditDecision.ALLOWED],
      })
      .getCount();
  }

  async countCampaignSendsInLastHour(sessionId: string): Promise<number> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.createdAt >= :since', { since })
      .andWhere('a.messageType = :messageType', { messageType: WhatsAppMessageType.CAMPAIGN })
      .andWhere('a.decision IN (:...decisions)', {
        decisions: [WhatsAppSendAuditDecision.SENT, WhatsAppSendAuditDecision.QUEUED],
      })
      .getCount();
  }

  async countCampaignSendsToday(sessionId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.createdAt >= :start', { start })
      .andWhere('a.messageType = :messageType', { messageType: WhatsAppMessageType.CAMPAIGN })
      .andWhere('a.decision = :decision', { decision: WhatsAppSendAuditDecision.SENT })
      .getCount();
  }

  async countRecentIdenticalBody(sessionId: string, body: string, hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const bodyHash = hashMessageBody(body);
    const auditCount = await this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.bodyHash = :bodyHash', { bodyHash })
      .andWhere('a.createdAt >= :since', { since })
      .andWhere('a.decision = :decision', { decision: WhatsAppSendAuditDecision.SENT })
      .getCount();
    if (auditCount > 0) return auditCount;

    // Legacy fallback for rows logged before bodyHash existed.
    const normalized = body.trim().toLowerCase();
    const rows = await this.queueRepo
      .createQueryBuilder('q')
      .select(['q.messageBody'])
      .where('q.sessionId = :sessionId', { sessionId })
      .andWhere('q.createdAt >= :since', { since })
      .andWhere('q.status = :status', { status: WhatsAppQueueStatus.SENT })
      .getMany();
    return rows.filter(row => row.messageBody.trim().toLowerCase() === normalized).length;
  }

  async countProductSendsTodayForContact(sessionId: string, chatId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.repo
      .createQueryBuilder('a')
      .where('a.sessionId = :sessionId', { sessionId })
      .andWhere('a.chatId = :chatId', { chatId })
      .andWhere('a.createdAt >= :start', { start })
      .andWhere('a.messageType = :messageType', { messageType: WhatsAppMessageType.PRODUCT_SEND })
      .andWhere('a.decision = :decision', { decision: WhatsAppSendAuditDecision.SENT })
      .getCount();
  }

  async recentFiltered(params: {
    sessionId?: string;
    source?: WhatsAppSendSource;
    decision?: WhatsAppSendAuditDecision;
    riskLevel?: WhatsAppRiskLevel;
    limit?: number;
  }): Promise<WhatsAppSendAudit[]> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(params.limit ?? 50);
    if (params.sessionId) qb.andWhere('a.sessionId = :sessionId', { sessionId: params.sessionId });
    if (params.source) qb.andWhere('a.source = :source', { source: params.source });
    if (params.decision) qb.andWhere('a.decision = :decision', { decision: params.decision });
    if (params.riskLevel) qb.andWhere('a.riskLevel = :riskLevel', { riskLevel: params.riskLevel });
    return qb.getMany();
  }
}
