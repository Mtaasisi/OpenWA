import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversationFact } from '../entities/ai-conversation-fact.entity';

export interface SaveConversationFactInput {
  conversationId: string;
  factType: string;
  factKey: string;
  factValue: string;
  branchId?: string | null;
  contactId?: string | null;
  customerId?: string | null;
  confidence?: number;
  sourceMessageId?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AiConversationFactsService {
  constructor(
    @InjectRepository(AiConversationFact, 'data')
    private readonly repo: Repository<AiConversationFact>,
  ) {}

  async saveFact(input: SaveConversationFactInput): Promise<AiConversationFact> {
    const existing = await this.repo.findOne({
      where: {
        conversationId: input.conversationId,
        factType: input.factType,
        factKey: input.factKey,
      },
    });

    if (existing) {
      existing.factValue = input.factValue;
      existing.confidence = input.confidence ?? existing.confidence;
      existing.sourceMessageId = input.sourceMessageId ?? existing.sourceMessageId;
      existing.expiresAt = input.expiresAt ?? existing.expiresAt;
      existing.metadata = input.metadata ?? existing.metadata;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        conversationId: input.conversationId,
        factType: input.factType,
        factKey: input.factKey,
        factValue: input.factValue,
        branchId: input.branchId ?? null,
        contactId: input.contactId ?? null,
        customerId: input.customerId ?? null,
        confidence: input.confidence ?? 0,
        sourceMessageId: input.sourceMessageId ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
      }),
    );
  }

  async loadFacts(conversationId: string): Promise<AiConversationFact[]> {
    const now = new Date();
    return this.repo
      .createQueryBuilder('f')
      .where('f.conversationId = :conversationId', { conversationId })
      .andWhere('(f.expiresAt IS NULL OR f.expiresAt > :now)', { now })
      .orderBy('f.updatedAt', 'DESC')
      .take(40)
      .getMany();
  }

  async buildFactsSummaryBlock(conversationId: string): Promise<string> {
    const facts = await this.loadFacts(conversationId);
    if (!facts.length) return '';

    const lines = ['=== Conversation facts (older context summary) ==='];
    for (const f of facts.slice(0, 12)) {
      lines.push(`${f.factType}/${f.factKey}: ${f.factValue}`);
    }
    return lines.join('\n');
  }
}
