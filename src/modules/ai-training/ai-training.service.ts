import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiLearningItemsService, ListLearningItemsQuery } from '../ai/ai-learning-items.service';
import { AiLearningSettingsService } from '../ai/ai-learning-settings.service';
import { AiLearningItemStatus } from '../ai/ai-learning.enums';
import { AiTrainingSuggestion } from './entities/ai-training-suggestion.entity';
import { AiTrainingAuditService } from './ai-training-audit.service';
import { AiTrainingQuestionGeneratorService } from './ai-training-question-generator.service';
import { AiTrainingReindexService } from './ai-training-reindex.service';
import { AiTrainingScanService } from './ai-training-scan.service';
import { AiTrainingSuggestionService } from './ai-training-suggestion.service';
import { AiTrainingApprovalService } from './ai-training-approval.service';
import {
  AiTrainingIssueType,
  AiTrainingSourceType,
  AiTrainingAuditAction,
  AiTrainingAuditActorType,
  CreateTrainingItemInput,
  TrainingOverview,
} from './ai-training.types';

export interface TrainingItemDetail extends AiLearningItem {
  trainingQuestion: string;
  suggestions: AiTrainingSuggestion[];
}

@Injectable()
export class AiTrainingService {
  constructor(
    @InjectRepository(AiLearningItem, 'data')
    private readonly itemRepo: Repository<AiLearningItem>,
    private readonly items: AiLearningItemsService,
    private readonly settings: AiLearningSettingsService,
    private readonly scan: AiTrainingScanService,
    private readonly suggestions: AiTrainingSuggestionService,
    private readonly questionGen: AiTrainingQuestionGeneratorService,
    private readonly audit: AiTrainingAuditService,
    private readonly reindexService: AiTrainingReindexService,
    private readonly approval: AiTrainingApprovalService,
  ) {}

  async getOverview(): Promise<TrainingOverview> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const pending = await this.itemRepo.count({
      where: {
        status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
      },
    });
    const highPriority = await this.itemRepo.count({
      where: {
        status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
        priority: In(['high', 'urgent']),
      },
    });
    const approvedToday = await this.itemRepo.count({
      where: {
        status: In([AiLearningItemStatus.APPROVED, AiLearningItemStatus.APPLIED]),
        approvedAt: Between(startOfDay, new Date()),
      },
    });
    const appliedKnowledge = await this.itemRepo.count({
      where: { status: AiLearningItemStatus.APPLIED },
    });
    const aiSuggestions = await this.itemRepo.count({
      where: { status: AiLearningItemStatus.SUGGESTED },
    });
    const needsReindex = await this.reindexService.isStale();

    return {
      pendingQuestions: pending,
      highPriority,
      approvedToday,
      appliedKnowledge,
      needsReindex,
      aiSuggestions,
      urgentCount: await this.itemRepo.count({
        where: {
          status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
          priority: 'urgent',
        },
      }),
    };
  }

  async listItems(query: ListLearningItemsQuery & {
    sourceType?: string;
    issueType?: string;
    priority?: string;
  }): Promise<AiLearningItem[]> {
    const qb = this.itemRepo.createQueryBuilder('i').orderBy('i.createdAt', 'DESC');
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      qb.andWhere('i.status IN (:...statuses)', { statuses });
    }
    if (query.branchId) qb.andWhere('i.branchId = :branchId', { branchId: query.branchId });
    if (query.search?.trim()) {
      qb.andWhere('(i.question LIKE :q OR i.normalizedQuestion LIKE :q OR i.title LIKE :q)', {
        q: `%${query.search.trim()}%`,
      });
    }
    if (query.sourceType) qb.andWhere('i.sourceType = :sourceType', { sourceType: query.sourceType });
    if (query.issueType) qb.andWhere('i.issueType = :issueType', { issueType: query.issueType });
    if (query.priority) qb.andWhere('i.priority = :priority', { priority: query.priority });
    if (query.from && query.to) {
      qb.andWhere('i.createdAt BETWEEN :from AND :to', { from: query.from, to: query.to });
    }
    return qb.take(300).getMany();
  }

  async getItemDetail(id: string): Promise<TrainingItemDetail> {
    const item = await this.items.getItem(id);
    const suggestions = await this.suggestions.listForItem(id);
    return {
      ...item,
      trainingQuestion: this.questionGen.generateQuestion(item),
      suggestions,
    };
  }

  createManualItem(input: CreateTrainingItemInput) {
    return this.scan.createTrainingItem({
      ...input,
      sourceType: input.sourceType ?? AiTrainingSourceType.MANUAL_ADMIN_NOTE,
      issueType: input.issueType ?? AiTrainingIssueType.ADMIN_MANUAL_TRAINING,
      createdByAi: false,
    });
  }

  scanInbox(options?: { days?: number }) {
    return this.scan.scanInbox(options);
  }

  scanSystem() {
    return this.scan.scanSystem();
  }

  generateSuggestions(id: string) {
    return this.items.getItem(id).then(item => this.suggestions.generateSuggestions(item));
  }

  ignoreItem(id: string, actorId: string) {
    return this.items.ignoreItem(id).then(async item => {
      await this.audit.log({
        trainingItemId: id,
        action: AiTrainingAuditAction.REJECTED,
        actorType: AiTrainingAuditActorType.ADMIN,
        actorId,
        summary: 'Training item ignored',
      });
      return item;
    });
  }

  bulkIgnore(ids: string[], actorId: string) {
    return Promise.all(ids.map(id => this.ignoreItem(id, actorId)));
  }

  bulkApprove(
    ids: string[],
    actorId: string,
    actorRole?: string,
    applyNow?: boolean,
    overrides?: Array<{ id: string; customAnswer?: string; selectedSuggestionId?: string }>,
  ) {
    return this.approval.bulkApprove({
      ids,
      approvedBy: actorId,
      approvedByRole: actorRole,
      applyNow,
      overrides,
    });
  }

  getAudit(trainingItemId?: string) {
    if (trainingItemId) return this.audit.listForItem(trainingItemId);
    return this.audit.listRecent();
  }

  reindex(includeMemory?: boolean) {
    return this.reindexService.reindexAll({ includeMemory });
  }

  getSettings() {
    return this.settings.getSettings();
  }

  updateSettings(patch: Record<string, unknown>) {
    return this.settings.updateSettings(patch as never);
  }
}
