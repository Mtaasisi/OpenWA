import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiTrainingAuditLog } from './entities/ai-training-audit-log.entity';
import {
  AiTrainingAuditAction,
  AiTrainingAuditActorType,
} from './ai-training.types';

@Injectable()
export class AiTrainingAuditService {
  constructor(
    @InjectRepository(AiTrainingAuditLog, 'data')
    private readonly repo: Repository<AiTrainingAuditLog>,
  ) {}

  async log(input: {
    trainingItemId: string;
    action: AiTrainingAuditAction;
    actorType: AiTrainingAuditActorType;
    actorId?: string | null;
    summary: string;
    details?: Record<string, unknown> | null;
  }): Promise<AiTrainingAuditLog> {
    const row = this.repo.create({
      trainingItemId: input.trainingItemId,
      action: input.action,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      summary: input.summary,
      details: input.details ?? null,
    });
    return this.repo.save(row);
  }

  async listForItem(trainingItemId: string, limit = 50): Promise<AiTrainingAuditLog[]> {
    return this.repo.find({
      where: { trainingItemId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async listRecent(limit = 100): Promise<AiTrainingAuditLog[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
