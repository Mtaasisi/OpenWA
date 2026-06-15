import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupAutopilotAudit } from './entities/followup-autopilot-audit.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

export interface AutopilotAuditPayload {
  followupId?: string | null;
  conversationId?: string | null;
  customerId?: string | null;
  sessionId?: string | null;
  ruleId?: string | null;
  templateId?: string | null;
  aiConfidence?: number | null;
  riskLevel?: string | null;
  channelUsed?: string | null;
  messageSent?: string | null;
  decisionReason?: string | null;
  approvedBy?: string | null;
  sentBy?: string | null;
  resultStatus?: string | null;
  metadata?: Record<string, unknown>;
  failureReason?: string | null;
}

@Injectable()
export class FollowupAutopilotAuditService {
  constructor(
    @InjectRepository(FollowupAutopilotAudit, 'data')
    private readonly auditRepo: Repository<FollowupAutopilotAudit>,
    private readonly auditService: AuditService,
  ) {}

  async log(payload: AutopilotAuditPayload, action: AuditAction): Promise<void> {
    const row = this.auditRepo.create({
      followupId: payload.followupId ?? null,
      conversationId: payload.conversationId ?? null,
      customerId: payload.customerId ?? null,
      sessionId: payload.sessionId ?? null,
      ruleId: payload.ruleId ?? null,
      templateId: payload.templateId ?? null,
      aiConfidence: payload.aiConfidence ?? null,
      riskLevel: payload.riskLevel ?? null,
      channelUsed: payload.channelUsed ?? null,
      messageSent: payload.messageSent ?? null,
      decisionReason: payload.decisionReason ?? null,
      approvedBy: payload.approvedBy ?? null,
      sentBy: payload.sentBy ?? null,
      resultStatus: payload.resultStatus ?? null,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    void this.auditRepo.save(row);
    void this.auditService.logInfo(action, {
      sessionId: payload.sessionId ?? undefined,
      metadata: { ...payload, metadata: payload.metadata },
    });
  }

  async listRecent(limit = 50, sessionId?: string): Promise<FollowupAutopilotAudit[]> {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 200));
    if (sessionId) {
      qb.andWhere('a.sessionId = :sessionId', { sessionId });
    }
    return qb.getMany();
  }
}
