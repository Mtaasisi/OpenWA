import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  AiUnknownMessage,
  AiUnknownMessageStatus,
} from '../entities/ai-unknown-message.entity';
import { normalizeCustomerText } from './ai-text-normalizer.util';

export interface UpsertUnknownMessageInput {
  rawText: string;
  branchId?: string | null;
  conversationId?: string | null;
  contactId?: string | null;
  customerId?: string | null;
  messageId?: string | null;
  detectedIntent?: string | null;
  aiSuggestedMeaning?: string | null;
  aiSuggestedReply?: string | null;
  confidence?: number;
}

@Injectable()
export class AiUnknownMessageService {
  constructor(
    @InjectRepository(AiUnknownMessage, 'data')
    private readonly repo: Repository<AiUnknownMessage>,
  ) {}

  async upsert(input: UpsertUnknownMessageInput): Promise<AiUnknownMessage> {
    const normalizedText = normalizeCustomerText(input.rawText);
    const existing = await this.repo.findOne({
      where: {
        normalizedText,
        status: AiUnknownMessageStatus.PENDING_REVIEW,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      order: { updatedAt: 'DESC' },
    });

    if (existing) {
      existing.frequencyCount += 1;
      existing.rawText = input.rawText;
      if (input.detectedIntent) existing.detectedIntent = input.detectedIntent;
      if (input.aiSuggestedMeaning) existing.aiSuggestedMeaning = input.aiSuggestedMeaning;
      if (input.aiSuggestedReply) existing.aiSuggestedReply = input.aiSuggestedReply;
      if (input.confidence != null) existing.confidence = input.confidence;
      if (input.messageId) existing.messageId = input.messageId;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        rawText: input.rawText,
        normalizedText,
        branchId: input.branchId ?? null,
        conversationId: input.conversationId ?? null,
        contactId: input.contactId ?? null,
        customerId: input.customerId ?? null,
        messageId: input.messageId ?? null,
        detectedIntent: input.detectedIntent ?? null,
        aiSuggestedMeaning: input.aiSuggestedMeaning ?? null,
        aiSuggestedReply: input.aiSuggestedReply ?? null,
        confidence: input.confidence ?? 0,
        frequencyCount: 1,
        status: AiUnknownMessageStatus.PENDING_REVIEW,
      }),
    );
  }

  async listPending(limit = 50, branchId?: string | null): Promise<AiUnknownMessage[]> {
    return this.listAll(limit, branchId, AiUnknownMessageStatus.PENDING_REVIEW);
  }

  async listAll(
    limit = 50,
    branchId?: string | null,
    status?: AiUnknownMessageStatus | string | null,
  ): Promise<AiUnknownMessage[]> {
    const qb = this.repo
      .createQueryBuilder('um')
      .orderBy('um.frequencyCount', 'DESC')
      .addOrderBy('um.updatedAt', 'DESC')
      .take(Math.min(limit, 500));

    if (branchId) {
      qb.andWhere('(um.branchId IS NULL OR um.branchId = :branchId)', { branchId });
    }
    if (status) {
      qb.andWhere('um.status = :status', { status });
    }
    return qb.getMany();
  }

  async bulkUpdateStatus(
    ids: string[],
    status: AiUnknownMessageStatus,
    reviewedBy?: string,
  ): Promise<{ updated: number; skipped: number }> {
    const uniqueIds = [...new Set(ids.map(id => id?.trim()).filter(Boolean))];
    if (!uniqueIds.length) return { updated: 0, skipped: 0 };

    const rows = await this.repo.find({ where: { id: In(uniqueIds) } });
    let updated = 0;
    const reviewedAt = new Date();
    for (const row of rows) {
      row.status = status;
      row.reviewedBy = reviewedBy ?? null;
      row.reviewedAt = reviewedAt;
      await this.repo.save(row);
      updated += 1;
    }
    return { updated, skipped: uniqueIds.length - updated };
  }

  async bulkUpdateDetectedIntent(
    ids: string[],
    intent: string,
  ): Promise<{ updated: number; skipped: number }> {
    const category = intent?.trim();
    if (!category) return { updated: 0, skipped: ids.length };

    const uniqueIds = [...new Set(ids.map(id => id?.trim()).filter(Boolean))];
    if (!uniqueIds.length) return { updated: 0, skipped: 0 };

    const rows = await this.repo.find({ where: { id: In(uniqueIds) } });
    let updated = 0;
    for (const row of rows) {
      row.detectedIntent = category;
      await this.repo.save(row);
      updated += 1;
    }
    return { updated, skipped: uniqueIds.length - updated };
  }

  async findById(id: string): Promise<AiUnknownMessage | null> {
    return this.repo.findOne({ where: { id } });
  }

  async updateStatus(
    id: string,
    status: AiUnknownMessageStatus,
    reviewedBy?: string,
  ): Promise<AiUnknownMessage | null> {
    const row = await this.findById(id);
    if (!row) return null;
    row.status = status;
    row.reviewedBy = reviewedBy ?? null;
    row.reviewedAt = new Date();
    return this.repo.save(row);
  }
}
