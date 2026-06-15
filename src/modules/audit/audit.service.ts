import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository, LessThan, In, IsNull } from 'typeorm';
import { AuditLog, AuditAction, AuditSeverity } from './entities/audit-log.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import { Session } from '../session/entities/session.entity';

export interface AuditContext {
  apiKey?: ApiKey;
  sessionId?: string;
  sessionName?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AuditQueryOptions {
  action?: AuditAction;
  apiKeyId?: string;
  sessionId?: string;
  severity?: AuditSeverity;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog, 'main')
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async log(
    action: AuditAction,
    context: AuditContext = {},
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<AuditLog> {
    const auditLog = this.auditRepository.create({
      action,
      severity,
      apiKeyId: context.apiKey?.id || null,
      apiKeyName: context.apiKey?.name || null,
      sessionId: context.sessionId || null,
      sessionName: context.sessionName || null,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      method: context.method || null,
      path: context.path || null,
      statusCode: context.statusCode || null,
      metadata: context.metadata || null,
      errorMessage: context.errorMessage || null,
    });

    return this.auditRepository.save(auditLog);
  }

  async logInfo(action: AuditAction, context: AuditContext = {}): Promise<AuditLog> {
    return this.log(action, context, AuditSeverity.INFO);
  }

  async logWarn(action: AuditAction, context: AuditContext = {}): Promise<AuditLog> {
    return this.log(action, context, AuditSeverity.WARN);
  }

  async logError(action: AuditAction, context: AuditContext = {}): Promise<AuditLog> {
    return this.log(action, context, AuditSeverity.ERROR);
  }

  async countSince(action: AuditAction, since: Date): Promise<number> {
    return this.auditRepository.count({
      where: { action, createdAt: MoreThan(since) },
    });
  }

  async findAll(options: AuditQueryOptions = {}): Promise<{
    data: AuditLog[];
    total: number;
  }> {
    const qb = this.auditRepository.createQueryBuilder('log');

    if (options.action) {
      qb.andWhere('log.action = :action', { action: options.action });
    }
    if (options.apiKeyId) {
      qb.andWhere('log.apiKeyId = :apiKeyId', { apiKeyId: options.apiKeyId });
    }
    if (options.sessionId) {
      qb.andWhere('log.sessionId = :sessionId', { sessionId: options.sessionId });
    }
    if (options.severity) {
      qb.andWhere('log.severity = :severity', { severity: options.severity });
    }
    if (options.startDate && options.endDate) {
      qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }
    if (options.search?.trim()) {
      const q = `%${options.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(log.action) LIKE :q OR LOWER(log.apiKeyName) LIKE :q OR LOWER(log.sessionName) LIKE :q OR LOWER(log.sessionId) LIKE :q OR LOWER(log.ipAddress) LIKE :q OR LOWER(log.errorMessage) LIKE :q)`,
        { q },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.take(options.limit || 50);
    qb.skip(options.offset || 0);

    const [data, total] = await qb.getManyAndCount();
    await this.enrichSessionNames(data);

    return { data, total };
  }

  /**
   * Remove audit rows created by the old QR polling behavior (GET /sessions/:id/qr).
   * Those entries have no API key and usually no session name.
   */
  async removeQrPollNoise(): Promise<number> {
    const result = await this.auditRepository.delete({
      action: AuditAction.SESSION_QR_GENERATED,
      apiKeyId: IsNull(),
    });
    return result.affected || 0;
  }

  private async enrichSessionNames(logs: AuditLog[]): Promise<void> {
    const missingIds = [
      ...new Set(
        logs.filter(l => l.sessionId && !l.sessionName).map(l => l.sessionId as string),
      ),
    ];
    if (missingIds.length === 0) return;

    const sessions = await this.sessionRepository.find({
      where: { id: In(missingIds) },
      select: ['id', 'name'],
    });
    const nameById = new Map(sessions.map(s => [s.id, s.name]));
    for (const log of logs) {
      if (log.sessionId && !log.sessionName) {
        log.sessionName = nameById.get(log.sessionId) ?? null;
      }
    }
  }

  async getRecentByApiKey(apiKeyId: string, limit = 10): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { apiKeyId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentBySession(sessionId: string, limit = 10): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async cleanup(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.auditRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }
}
