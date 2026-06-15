import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { AgentActionAuditLog } from './entities/agent-action-audit-log.entity';
import type {
  AgentActionDefinition,
  AgentActionRequest,
  AgentActionResult,
  AgentActionStatus,
} from './agent-action.types';
import { AgentActionSettingsService } from './agent-action-settings.service';

@Injectable()
export class AgentActionAuditService {
  constructor(
    @InjectRepository(AgentActionAuditLog, 'data')
    private readonly repo: Repository<AgentActionAuditLog>,
    private readonly audit: AuditService,
    private readonly settings: AgentActionSettingsService,
  ) {}

  async logAttempt(
    action: AgentActionDefinition,
    request: AgentActionRequest,
    status: AgentActionStatus,
    opts?: {
      confirmationId?: string;
      oldValue?: unknown;
      newValue?: unknown;
      params?: Record<string, unknown>;
      errorMessage?: string;
      requiredConfirmation?: boolean;
    },
  ): Promise<AgentActionAuditLog | null> {
    const cfg = await this.settings.get();
    if (!cfg.actionAuditEnabled) return null;

    const row = this.repo.create({
      actionId: action.id,
      actionTitle: action.title,
      category: action.category,
      requestedByUserId: request.userId,
      requestedByRole: request.userRole,
      businessId: request.businessId ?? null,
      branchId: request.branchId ?? null,
      currentPage: request.currentPage ?? null,
      oldValue: opts?.oldValue != null ? JSON.stringify(opts.oldValue) : null,
      newValue: opts?.newValue != null ? JSON.stringify(opts.newValue) : null,
      paramsSummary: opts?.params ? JSON.stringify(opts.params) : null,
      risk: action.risk,
      requiredConfirmation: opts?.requiredConfirmation ?? action.requiresConfirmation,
      confirmationId: opts?.confirmationId ?? null,
      status,
      errorMessage: opts?.errorMessage ?? null,
      source: 'ai_assistant_agent',
      executedAt: status === 'success' ? new Date() : null,
    });
    const saved = await this.repo.save(row);

    const auditAction =
      status === 'success'
        ? AuditAction.AGENT_ACTION_EXECUTED
        : status === 'permission_denied' || status === 'blocked'
          ? AuditAction.AGENT_ACTION_DENIED
          : status === 'confirmation_required'
            ? AuditAction.AGENT_ACTION_CONFIRMED
            : AuditAction.AGENT_ACTION_EXECUTED;

    await this.audit.logInfo(auditAction, {
      metadata: {
        agentActionId: action.id,
        status,
        userId: request.userId,
        auditLogId: saved.id,
      },
    });

    return saved;
  }

  async listRecent(limit = 50, userId?: string): Promise<AgentActionAuditLog[]> {
    return this.repo.find({
      where: userId ? { requestedByUserId: userId } : {},
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
