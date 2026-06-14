import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AiLearningItem } from './entities/ai-learning-item.entity';
import {
  AiLearningItemSource,
  AiLearningItemStatus,
} from './ai-learning.enums';
import {
  normalizeQuestion,
  questionSimilarity,
} from './utils/ai-learning-confidence.util';
import { AiLearningKnowledgeService } from './ai-learning-knowledge.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { MessageService } from '../message/message.service';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import { InboxCrmService } from '../message/inbox-crm.service';
import { ProductDemandService } from './product-demand.service';

export interface ListLearningItemsQuery {
  status?: AiLearningItemStatus | AiLearningItemStatus[];
  search?: string;
  branchId?: string;
  from?: string;
  to?: string;
}

export interface CreateLearningItemInput {
  question: string;
  sessionId?: string | null;
  chatId?: string | null;
  conversationId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  branchId?: string | null;
  detectedIntent?: string | null;
  detectedProduct?: string | null;
  contextMessages?: Array<{ role: string; body: string; at?: string }> | null;
  aiDraftAnswer?: string | null;
  adminFinalAnswer?: string | null;
  confidenceScore?: number;
  whyUnsure?: string | null;
  source?: AiLearningItemSource;
  status?: AiLearningItemStatus;
}

@Injectable()
export class AiLearningItemsService {
  constructor(
    @InjectRepository(AiLearningItem, 'data')
    private readonly repo: Repository<AiLearningItem>,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    private readonly knowledge: AiLearningKnowledgeService,
    private readonly settings: AiLearningSettingsService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrm: InboxCrmService,
    private readonly productDemand: ProductDemandService,
  ) {}

  async listItems(query: ListLearningItemsQuery = {}): Promise<AiLearningItem[]> {
    const qb = this.repo.createQueryBuilder('i').orderBy('i.createdAt', 'DESC');
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      qb.andWhere('i.status IN (:...statuses)', { statuses });
    }
    if (query.branchId) qb.andWhere('i.branchId = :branchId', { branchId: query.branchId });
    if (query.search?.trim()) {
      qb.andWhere('(i.question LIKE :q OR i.normalizedQuestion LIKE :q)', {
        q: `%${query.search.trim()}%`,
      });
    }
    if (query.from && query.to) {
      qb.andWhere('i.createdAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      });
    }
    return qb.take(300).getMany();
  }

  async getItem(id: string): Promise<AiLearningItem> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Learning item not found');
    return row;
  }

  async createItem(input: CreateLearningItemInput): Promise<AiLearningItem> {
    const settings = await this.settings.getSettings();
    const normalized = normalizeQuestion(input.question);
    const existing = await this.repo.findOne({
      where: {
        normalizedQuestion: normalized,
        status: In([
          AiLearningItemStatus.PENDING_REVIEW,
          AiLearningItemStatus.SUGGESTED,
        ]),
      },
    });
    if (existing && settings.trackRepeatedQuestions) {
      existing.timesAsked += 1;
      if (input.aiDraftAnswer && !existing.aiDraftAnswer) {
        existing.aiDraftAnswer = input.aiDraftAnswer;
      }
      if (input.confidenceScore != null) {
        existing.confidenceScore = Math.min(existing.confidenceScore, input.confidenceScore);
      }
      return this.repo.save(existing);
    }

    const row = this.repo.create({
      ...input,
      normalizedQuestion: normalized,
      status: input.status ?? AiLearningItemStatus.PENDING_REVIEW,
      source: input.source ?? AiLearningItemSource.AUTO_UNKNOWN,
      confidenceScore: input.confidenceScore ?? 0,
      timesAsked: 1,
      priority: (input.confidenceScore ?? 1) < 0.4 ? 'high' : 'medium',
    });
    return this.repo.save(row);
  }

  async updateItem(id: string, patch: Partial<AiLearningItem>): Promise<AiLearningItem> {
    const row = await this.getItem(id);
    Object.assign(row, patch);
    if (patch.question) row.normalizedQuestion = normalizeQuestion(patch.question);
    return this.repo.save(row);
  }

  async approveItem(
    id: string,
    input: {
      adminFinalAnswer: string;
      targetFile?: string;
      category?: string;
      approvedBy?: string;
      reviewDate?: Date;
      writeToFile?: boolean;
    },
  ): Promise<{ item: AiLearningItem; knowledgeId: string }> {
    const item = await this.getItem(id);
    item.adminFinalAnswer = input.adminFinalAnswer;
    item.status = AiLearningItemStatus.APPROVED;
    item.approvedBy = input.approvedBy ?? null;
    item.approvedAt = new Date();
    item.targetFile = input.targetFile ?? item.targetFile ?? 'FAQ.md';
    item.knowledgeCategory = input.category ?? item.knowledgeCategory ?? null;
    if (input.reviewDate) item.reviewDate = input.reviewDate;
    await this.repo.save(item);

    const knowledge = await this.knowledge.createFromApproval({
      questionPattern: item.question,
      approvedAnswer: input.adminFinalAnswer,
      category: item.knowledgeCategory,
      targetFile: item.targetFile,
      approvedBy: input.approvedBy ?? null,
      sourceItemId: item.id,
      sessionId: item.sessionId,
      chatId: item.chatId,
      reviewDate: item.reviewDate,
      internalNotes: item.internalNote,
      writeToFile: input.writeToFile,
    });
    return { item, knowledgeId: knowledge.id };
  }

  async rejectItem(id: string): Promise<AiLearningItem> {
    return this.updateItem(id, { status: AiLearningItemStatus.REJECTED });
  }

  async ignoreItem(id: string): Promise<AiLearningItem> {
    return this.updateItem(id, { status: AiLearningItemStatus.IGNORED });
  }

  async mergeItems(id: string, targetIds: string[]): Promise<AiLearningItem> {
    const primary = await this.getItem(id);
    const others = await this.repo.find({ where: { id: In(targetIds) } });
    primary.timesAsked += others.reduce((s, o) => s + o.timesAsked, 0);
    primary.similarGroupId = primary.similarGroupId ?? primary.id;
    await this.repo.save(primary);
    for (const o of others) {
      o.status = AiLearningItemStatus.MERGED;
      o.mergedIntoId = primary.id;
      o.similarGroupId = primary.similarGroupId;
      await this.repo.save(o);
    }
    return primary;
  }

  async findSimilar(id: string, limit = 5): Promise<AiLearningItem[]> {
    const item = await this.getItem(id);
    const candidates = await this.repo.find({
      where: {
        status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
      },
      take: 100,
      order: { createdAt: 'DESC' },
    });
    return candidates
      .filter(c => c.id !== id)
      .map(c => ({ c, score: questionSimilarity(item.question, c.question) }))
      .filter(x => x.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.c);
  }

  private async sendReplyIfPossible(
    item: AiLearningItem,
    text: string,
    actorStaffId?: string,
  ): Promise<void> {
    if (!item.sessionId || !item.chatId) {
      throw new BadRequestException('Item has no linked conversation');
    }
    await this.messageService.sendText(item.sessionId, {
      chatId: item.chatId,
      text,
    }, { actorStaffId });
  }

  async replyAndTeach(
    id: string,
    input: {
      adminFinalAnswer: string;
      targetFile?: string;
      category?: string;
      approvedBy?: string;
      actorStaffId?: string;
    },
  ) {
    const result = await this.approveItem(id, input);
    await this.sendReplyIfPossible(result.item, input.adminFinalAnswer, input.actorStaffId);
    return result;
  }

  async teachOnly(
    id: string,
    input: {
      adminFinalAnswer: string;
      targetFile?: string;
      category?: string;
      approvedBy?: string;
    },
  ) {
    return this.approveItem(id, { ...input, writeToFile: true });
  }

  async replyOnly(
    id: string,
    input: { answer: string; actorStaffId?: string },
  ): Promise<AiLearningItem> {
    const item = await this.getItem(id);
    await this.sendReplyIfPossible(item, input.answer, input.actorStaffId);
    item.adminFinalAnswer = input.answer;
    return this.repo.save(item);
  }

  async getOverview(): Promise<{
    pendingLearning: number;
    unknownQuestionsToday: number;
    mostAskedProduct: string | null;
    outOfStockDemand: number;
    installmentDemand: number;
    aiPausedChats: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const pending = await this.repo.count({
      where: {
        status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
      },
    });
    const unknownToday = await this.repo.count({
      where: {
        createdAt: Between(startOfDay, new Date()),
        source: AiLearningItemSource.AUTO_UNKNOWN,
      },
    });
    const paused = await this.crmRepo.count({
      where: { aiHandlingState: InboxAiHandlingState.WAITING_HUMAN },
    });
    const topProduct = await this.repo
      .createQueryBuilder('i')
      .select('i.detectedProduct', 'product')
      .addSelect('COUNT(*)', 'cnt')
      .where('i.detectedProduct IS NOT NULL')
      .groupBy('i.detectedProduct')
      .orderBy('cnt', 'DESC')
      .limit(1)
      .getRawOne<{ product: string; cnt: string }>();

    const demandCounts = await this.productDemand.getDashboardCounts();

    return {
      pendingLearning: pending,
      unknownQuestionsToday: unknownToday,
      mostAskedProduct: topProduct?.product ?? null,
      outOfStockDemand: demandCounts.outOfStockDemand,
      installmentDemand: demandCounts.installmentDemand,
      aiPausedChats: paused,
    };
  }

  async createFromLowConfidence(input: CreateLearningItemInput): Promise<AiLearningItem | null> {
    const settings = await this.settings.getSettings();
    if (!settings.enableLearningDetection || !settings.autoCreatePendingQuestion) return null;
    return this.createItem({
      ...input,
      source: AiLearningItemSource.AUTO_UNKNOWN,
      status: settings.autoSuggestDraftAnswer
        ? AiLearningItemStatus.SUGGESTED
        : AiLearningItemStatus.PENDING_REVIEW,
    });
  }

  async createStaffCorrection(input: CreateLearningItemInput): Promise<AiLearningItem | null> {
    const settings = await this.settings.getSettings();
    if (!settings.trackStaffCorrections) return null;
    return this.createItem({
      ...input,
      source: AiLearningItemSource.STAFF_CORRECTION,
      status: AiLearningItemStatus.SUGGESTED,
    });
  }

  listHistory(): Promise<AiLearningItem[]> {
    return this.repo.find({
      where: { status: AiLearningItemStatus.APPROVED },
      order: { approvedAt: 'DESC' },
      take: 200,
    });
  }
}
