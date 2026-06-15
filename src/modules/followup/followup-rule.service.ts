import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupRule } from './entities/followup-rule.entity';
import {
  ConversationStage,
  FollowUpMode,
  FollowUpTriggerEvent,
} from './followup.enums';

export interface CreateRuleDto {
  name: string;
  triggerEvent: FollowUpTriggerEvent;
  stage?: ConversationStage | null;
  condition?: string | null;
  delayMinutes?: number;
  templateId?: string | null;
  mode?: FollowUpMode;
  maxAttempts?: number;
  stopIfCustomerReplied?: boolean;
  stopIfSaleLinked?: boolean;
  active?: boolean;
  branchId?: string | null;
}

export type UpdateRuleDto = Partial<CreateRuleDto>;

@Injectable()
export class FollowupRuleService {
  constructor(
    @InjectRepository(FollowupRule, 'data')
    private readonly repo: Repository<FollowupRule>,
  ) {}

  async findAll(branchId?: string): Promise<FollowupRule[]> {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.name', 'ASC');
    if (branchId) {
      qb.where('r.branchId = :branchId OR r.branchId IS NULL', { branchId });
    }
    return qb.getMany();
  }

  async findActive(branchId?: string): Promise<FollowupRule[]> {
    const qb = this.repo.createQueryBuilder('r').where('r.active = :active', { active: true });
    if (branchId) {
      qb.andWhere('(r.branchId = :branchId OR r.branchId IS NULL)', { branchId });
    }
    return qb.getMany();
  }

  async findById(id: string): Promise<FollowupRule> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Rule ${id} not found`);
    return row;
  }

  async create(dto: CreateRuleDto): Promise<FollowupRule> {
    const row = this.repo.create({
      ...dto,
      mode: dto.mode ?? FollowUpMode.CREATE_TASK,
      delayMinutes: dto.delayMinutes ?? 0,
      maxAttempts: dto.maxAttempts ?? 3,
      stopIfCustomerReplied: dto.stopIfCustomerReplied ?? true,
      stopIfSaleLinked: dto.stopIfSaleLinked ?? true,
      active: dto.active ?? true,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateRuleDto): Promise<FollowupRule> {
    const row = await this.findById(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findById(id);
    await this.repo.remove(row);
  }
}
