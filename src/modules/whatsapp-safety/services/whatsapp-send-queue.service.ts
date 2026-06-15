import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { WhatsAppSendQueue } from '../entities/whatsapp-send-queue.entity';
import {
  GuardRequiredAction,
  WhatsAppMessageType,
  WhatsAppQueuePriority,
  WhatsAppQueueStatus,
  WhatsAppRiskLevel,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';
import type { GuardDecision } from './whatsapp-policy-guard.service';
import { randomDelayMs } from '../utils/send-delay.util';

export interface EnqueueParams {
  sessionId: string;
  chatId: string;
  phone?: string | null;
  messageType: WhatsAppMessageType;
  source: WhatsAppSendSource;
  messageBody: string;
  templateId?: string | null;
  mediaUrls?: string[] | null;
  payload?: Record<string, unknown> | null;
  priority?: WhatsAppQueuePriority;
  guardDecision?: GuardDecision;
  createdBy?: string | null;
  scheduledAt?: Date | null;
  conversationId?: string | null;
  customerId?: string | null;
}

@Injectable()
export class WhatsAppSendQueueService {
  private readonly logger = new Logger(WhatsAppSendQueueService.name);

  constructor(
    @InjectRepository(WhatsAppSendQueue, 'data')
    private readonly repo: Repository<WhatsAppSendQueue>,
  ) {}

  async enqueue(params: EnqueueParams): Promise<WhatsAppSendQueue> {
    const action = params.guardDecision?.requiredAction;
    const status =
      action === GuardRequiredAction.REQUIRE_APPROVAL
        ? WhatsAppQueueStatus.APPROVAL_REQUIRED
        : WhatsAppQueueStatus.PENDING;

    const row = this.repo.create({
      sessionId: params.sessionId,
      chatId: params.chatId,
      phone: params.phone ?? null,
      messageType: params.messageType,
      messageBody: params.messageBody,
      templateId: params.templateId ?? null,
      mediaUrls: params.mediaUrls ?? null,
      payload: params.payload ?? null,
      source: params.source,
      priority: params.priority ?? WhatsAppQueuePriority.NORMAL,
      status,
      riskLevel: params.guardDecision?.riskLevel ?? WhatsAppRiskLevel.LOW,
      guardDecision: params.guardDecision as unknown as Record<string, unknown>,
      scheduledAt: params.scheduledAt ?? new Date(),
      createdBy: params.createdBy ?? null,
      conversationId: params.conversationId ?? null,
      customerId: params.customerId ?? null,
    });
    return this.repo.save(row);
  }

  async findLatestPendingForChat(
    sessionId: string,
    chatId: string,
  ): Promise<WhatsAppSendQueue | null> {
    return this.repo.findOne({
      where: {
        sessionId,
        chatId,
        status: In([
          WhatsAppQueueStatus.PENDING,
          WhatsAppQueueStatus.SCHEDULED,
          WhatsAppQueueStatus.APPROVAL_REQUIRED,
        ]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingForSession(sessionId: string, limit = 1): Promise<WhatsAppSendQueue[]> {
    const now = new Date();
    return this.repo.find({
      where: {
        sessionId,
        status: In([WhatsAppQueueStatus.PENDING, WhatsAppQueueStatus.SCHEDULED]),
        scheduledAt: LessThanOrEqual(now),
      },
      order: { priority: 'DESC', scheduledAt: 'ASC' },
      take: limit,
    });
  }

  async markSending(id: string): Promise<void> {
    await this.repo.update(id, { status: WhatsAppQueueStatus.SENDING });
  }

  async markSent(id: string): Promise<void> {
    await this.repo.update(id, { status: WhatsAppQueueStatus.SENT, sentAt: new Date() });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.repo.update(id, {
      status: WhatsAppQueueStatus.FAILED,
      failedAt: new Date(),
      errorMessage: error,
    });
  }

  async markBlocked(id: string, reason: string): Promise<void> {
    await this.repo.update(id, {
      status: WhatsAppQueueStatus.BLOCKED,
      errorMessage: reason,
    });
  }

  async approve(id: string, approvedBy: string): Promise<WhatsAppSendQueue | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || row.status !== WhatsAppQueueStatus.APPROVAL_REQUIRED) return null;
    row.status = WhatsAppQueueStatus.PENDING;
    row.approvedBy = approvedBy;
    row.approvedAt = new Date();
    row.scheduledAt = new Date();
    return this.repo.save(row);
  }

  async cancel(id: string): Promise<boolean> {
    const result = await this.repo.update(id, { status: WhatsAppQueueStatus.CANCELLED });
    return (result.affected ?? 0) > 0;
  }

  async retry(id: string): Promise<WhatsAppSendQueue | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || ![WhatsAppQueueStatus.FAILED, WhatsAppQueueStatus.BLOCKED].includes(row.status)) {
      return null;
    }
    row.status = WhatsAppQueueStatus.PENDING;
    row.retryCount += 1;
    row.scheduledAt = new Date(Date.now() + randomDelayMs(5000, 15000));
    row.errorMessage = null;
    return this.repo.save(row);
  }

  async list(params: {
    status?: WhatsAppQueueStatus;
    sessionId?: string;
    limit?: number;
  }): Promise<WhatsAppSendQueue[]> {
    const qb = this.repo.createQueryBuilder('q').orderBy('q.createdAt', 'DESC').take(params.limit ?? 100);
    if (params.status) qb.andWhere('q.status = :status', { status: params.status });
    if (params.sessionId) qb.andWhere('q.sessionId = :sessionId', { sessionId: params.sessionId });
    return qb.getMany();
  }

  async countPending(sessionId?: string): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('q')
      .where('q.status IN (:...statuses)', {
        statuses: [WhatsAppQueueStatus.PENDING, WhatsAppQueueStatus.APPROVAL_REQUIRED, WhatsAppQueueStatus.SCHEDULED],
      });
    if (sessionId) qb.andWhere('q.sessionId = :sessionId', { sessionId });
    return qb.getCount();
  }

  async findReady(limit = 50): Promise<WhatsAppSendQueue[]> {
    const now = new Date();
    return this.repo.find({
      where: {
        status: In([WhatsAppQueueStatus.PENDING, WhatsAppQueueStatus.SCHEDULED]),
        scheduledAt: LessThanOrEqual(now),
      },
      order: { priority: 'DESC', scheduledAt: 'ASC' },
      take: limit,
    });
  }

  async stats(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('q.status')
      .getRawMany<{ status: string; count: string }>();

    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.status] = Number(row.count) || 0;
    }
    return out;
  }
}
