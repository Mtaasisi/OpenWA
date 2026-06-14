import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiLearningKnowledge } from './entities/ai-learning-knowledge.entity';
import { AiLearningKnowledgeStatus } from './ai-learning.enums';
import {
  normalizeQuestion,
  questionSimilarity,
  TRAINING_KNOWLEDGE_MATCH_MIN,
} from './utils/ai-learning-confidence.util';
import { AiLearningKnowledgeFileService } from './ai-learning-knowledge-file.service';

export interface KnowledgeMatch {
  knowledge: AiLearningKnowledge;
  score: number;
}

@Injectable()
export class AiLearningKnowledgeService {
  constructor(
    @InjectRepository(AiLearningKnowledge, 'data')
    private readonly repo: Repository<AiLearningKnowledge>,
    private readonly fileService: AiLearningKnowledgeFileService,
  ) {}

  listKnowledge(query?: { status?: string; search?: string }): Promise<AiLearningKnowledge[]> {
    const qb = this.repo.createQueryBuilder('k').orderBy('k.updatedAt', 'DESC');
    if (query?.status) qb.andWhere('k.status = :status', { status: query.status });
    if (query?.search?.trim()) {
      qb.andWhere('(k.questionPattern LIKE :q OR k.approvedAnswer LIKE :q)', {
        q: `%${query.search.trim()}%`,
      });
    }
    return qb.take(200).getMany();
  }

  async getKnowledge(id: string): Promise<AiLearningKnowledge> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Knowledge not found');
    return row;
  }

  async findBestMatch(
    question: string,
    minScore = TRAINING_KNOWLEDGE_MATCH_MIN,
  ): Promise<KnowledgeMatch | null> {
    const normalized = normalizeQuestion(question);
    const active = await this.repo.find({
      where: { status: AiLearningKnowledgeStatus.ACTIVE },
      order: { timesUsed: 'DESC' },
      take: 100,
    });
    let best: KnowledgeMatch | null = null;
    for (const k of active) {
      const score = Math.max(
        questionSimilarity(normalized, k.questionPattern),
        ...(k.alternativeQuestions ?? []).map(alt => questionSimilarity(normalized, alt)),
      );
      if (score >= minScore && (!best || score > best.score)) {
        best = { knowledge: k, score };
      }
    }
    return best;
  }

  async createFromApproval(input: {
    questionPattern: string;
    alternativeQuestions?: string[];
    approvedAnswer: string;
    category?: string | null;
    targetFile?: string | null;
    approvedBy?: string | null;
    sourceItemId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    reviewDate?: Date | null;
    internalNotes?: string | null;
    writeToFile?: boolean;
  }): Promise<AiLearningKnowledge> {
    const row = this.repo.create({
      questionPattern: input.questionPattern,
      alternativeQuestions: input.alternativeQuestions ?? null,
      approvedAnswer: input.approvedAnswer,
      category: input.category ?? null,
      targetFile: input.targetFile ?? 'FAQ.md',
      approvedBy: input.approvedBy ?? null,
      approvedAt: new Date(),
      status: AiLearningKnowledgeStatus.ACTIVE,
      sourceItemId: input.sourceItemId ?? null,
      sessionId: input.sessionId ?? null,
      chatId: input.chatId ?? null,
      reviewDate: input.reviewDate ?? null,
      internalNotes: input.internalNotes ?? null,
    });
    const saved = await this.repo.save(row);

    if (input.writeToFile !== false && saved.targetFile) {
      this.fileService.appendApprovedKnowledge({
        targetFile: saved.targetFile,
        category: saved.category,
        questionPattern: saved.questionPattern,
        approvedAnswer: saved.approvedAnswer,
        approvedBy: saved.approvedBy,
        examples: saved.alternativeQuestions ?? undefined,
      });
    }
    return saved;
  }

  async updateKnowledge(
    id: string,
    patch: Partial<AiLearningKnowledge>,
    editorId?: string | null,
  ): Promise<AiLearningKnowledge> {
    const row = await this.getKnowledge(id);
    Object.assign(row, patch);
    if (editorId) row.lastEditedBy = editorId;
    return this.repo.save(row);
  }

  async disableKnowledge(id: string): Promise<AiLearningKnowledge> {
    return this.updateKnowledge(id, { status: AiLearningKnowledgeStatus.DISABLED });
  }

  async markNeedsReview(id: string): Promise<AiLearningKnowledge> {
    return this.updateKnowledge(id, { status: AiLearningKnowledgeStatus.NEEDS_REVIEW });
  }

  async recordUsage(id: string): Promise<void> {
    await this.repo.increment({ id }, 'timesUsed', 1);
    await this.repo.update(id, { lastUsedAt: new Date() });
  }
}
