import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  AgentActionConfirmation,
  type AgentActionConfirmationStatus,
} from './entities/agent-action-confirmation.entity';
import type { AgentActionDefinition, AgentActionRequest } from './agent-action.types';
import { AgentActionSettingsService } from './agent-action-settings.service';

@Injectable()
export class AgentActionConfirmationService {
  constructor(
    @InjectRepository(AgentActionConfirmation, 'data')
    private readonly repo: Repository<AgentActionConfirmation>,
    private readonly settings: AgentActionSettingsService,
  ) {}

  async create(
    action: AgentActionDefinition,
    request: AgentActionRequest,
    params: Record<string, unknown>,
  ): Promise<AgentActionConfirmation> {
    const cfg = await this.settings.get();
    const expiresAt = new Date(Date.now() + cfg.actionConfirmExpiryMinutes * 60_000);
    const row = this.repo.create({
      actionId: action.id,
      requestedByUserId: request.userId,
      paramsJson: JSON.stringify(params),
      risk: action.risk,
      warningMessage: action.warningMessage ?? action.description,
      expiresAt,
      status: 'pending',
    });
    return this.repo.save(row);
  }

  async getPendingForUser(userId: string): Promise<AgentActionConfirmation[]> {
    await this.expireStale();
    return this.repo.find({
      where: { requestedByUserId: userId, status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async confirm(
    confirmationId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<{ confirmation: AgentActionConfirmation; params: Record<string, unknown> }> {
    await this.expireStale();
    const row = await this.repo.findOne({ where: { id: confirmationId } });
    if (!row) throw new NotFoundException('Confirmation not found');
    if (row.status !== 'pending') {
      throw new BadRequestException(`Confirmation is ${row.status}`);
    }
    if (row.expiresAt.getTime() < Date.now()) {
      row.status = 'expired';
      await this.repo.save(row);
      throw new BadRequestException('Confirmation expired');
    }
    if (row.requestedByUserId !== userId && !isAdmin) {
      throw new ForbiddenException('Cannot confirm another user action');
    }
    row.status = 'confirmed';
    await this.repo.save(row);
    const params = row.paramsJson ? (JSON.parse(row.paramsJson) as Record<string, unknown>) : {};
    return { confirmation: row, params };
  }

  async cancel(confirmationId: string, userId: string, isAdmin: boolean): Promise<void> {
    const row = await this.repo.findOne({ where: { id: confirmationId } });
    if (!row) throw new NotFoundException('Confirmation not found');
    if (row.requestedByUserId !== userId && !isAdmin) {
      throw new ForbiddenException('Cannot cancel another user action');
    }
    row.status = 'cancelled';
    await this.repo.save(row);
  }

  async countPending(userId?: string): Promise<number> {
    await this.expireStale();
    return this.repo.count({
      where: userId ? { requestedByUserId: userId, status: 'pending' } : { status: 'pending' },
    });
  }

  private async expireStale(): Promise<void> {
    await this.repo.update(
      { status: 'pending' as AgentActionConfirmationStatus, expiresAt: LessThan(new Date()) },
      { status: 'expired' },
    );
  }
}
