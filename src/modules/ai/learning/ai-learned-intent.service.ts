import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AiLearnedIntent,
  AiLearnedIntentStatus,
} from '../entities/ai-learned-intent.entity';
import { normalizeCustomerText } from './ai-text-normalizer.util';
import { questionSimilarity } from '../utils/ai-learning-confidence.util';
import { AiSettingsService } from '../ai-settings.service';

export interface TryLearnedReplyInput {
  text: string;
  branchId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
}

export type TryLearnedReplyResult =
  | {
      hit: true;
      reply: string;
      intentId: string;
      intent: string;
      matchType: 'exact' | 'similar';
    }
  | { hit: false };

const SIMILAR_MATCH_MIN = 0.72;

@Injectable()
export class AiLearnedIntentService {
  private readonly logger = new Logger(AiLearnedIntentService.name);

  constructor(
    @InjectRepository(AiLearnedIntent, 'data')
    private readonly repo: Repository<AiLearnedIntent>,
    private readonly aiSettings: AiSettingsService,
  ) {}

  async tryReply(input: TryLearnedReplyInput): Promise<TryLearnedReplyResult> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.learnedReplyCacheEnabled === false) return { hit: false };

    const normalized = normalizeCustomerText(input.text);
    if (!normalized) return { hit: false };

    const qb = this.repo
      .createQueryBuilder('li')
      .where('li.status = :status', { status: AiLearnedIntentStatus.ACTIVE });

    if (input.branchId) {
      qb.andWhere('(li.branchId IS NULL OR li.branchId = :branchId)', {
        branchId: input.branchId,
      });
    }

    const exact = await qb
      .clone()
      .andWhere('li.normalizedPhrase = :normalized', { normalized })
      .orderBy('li.usageCount', 'DESC')
      .getOne();

    const match = exact ?? (await this.findSimilarMatch(normalized, input.branchId));
    if (!match) return { hit: false };

    const reply = this.pickReplyVariation(match, input.contactId, config?.replyVariationRotation !== false);
    if (!reply?.trim()) return { hit: false };

    void this.incrementUsage(match.id).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to increment learned intent usage: ${msg}`);
    });

    return {
      hit: true,
      reply: reply.trim(),
      intentId: match.id,
      intent: match.intent,
      matchType: exact ? 'exact' : 'similar',
    };
  }

  async findById(id: string): Promise<AiLearnedIntent | null> {
    return this.repo.findOne({ where: { id } });
  }

  async listActive(limit = 50, branchId?: string | null): Promise<AiLearnedIntent[]> {
    return this.listForAdmin(limit, branchId, AiLearnedIntentStatus.ACTIVE);
  }

  async listForAdmin(
    limit = 50,
    branchId?: string | null,
    status?: AiLearnedIntentStatus | string | null,
  ): Promise<AiLearnedIntent[]> {
    const qb = this.repo
      .createQueryBuilder('li')
      .orderBy('li.usageCount', 'DESC')
      .addOrderBy('li.updatedAt', 'DESC')
      .take(Math.min(limit, 500));

    if (branchId) {
      qb.andWhere('(li.branchId IS NULL OR li.branchId = :branchId)', { branchId });
    }
    if (status) {
      qb.andWhere('li.status = :status', { status });
    }
    return qb.getMany();
  }

  async bulkAction(
    ids: string[],
    action: 'approve' | 'reject' | 'disable' | 'change_category' | 'assign_template',
    opts: { category?: string; replyTemplateId?: string },
    actor?: string,
  ): Promise<{ ok: boolean; updated: number; skipped: number; error?: string }> {
    const uniqueIds = [...new Set(ids.map(id => id?.trim()).filter(Boolean))];
    if (!uniqueIds.length) return { ok: false, updated: 0, skipped: 0, error: 'ids_required' };

    const rows = await this.repo.find({ where: { id: In(uniqueIds) } });
    if (!rows.length) return { ok: false, updated: 0, skipped: uniqueIds.length, error: 'not_found' };

    const now = new Date();
    let updated = 0;

    for (const row of rows) {
      switch (action) {
        case 'approve':
          row.status = AiLearnedIntentStatus.ACTIVE;
          row.approvedBy = actor ?? null;
          row.approvedAt = now;
          break;
        case 'reject':
          row.status = AiLearnedIntentStatus.REJECTED;
          break;
        case 'disable':
          row.status = AiLearnedIntentStatus.DISABLED;
          break;
        case 'change_category':
          const category = opts.category?.trim();
          if (!category) continue;
          row.intent = category;
          break;
        case 'assign_template':
          const templateId = opts.replyTemplateId?.trim();
          if (!templateId) continue;
          row.replyTemplateId = templateId;
          break;
        default:
          continue;
      }
      await this.repo.save(row);
      updated += 1;
    }

    if (action === 'change_category' && !opts.category?.trim()) {
      return { ok: false, updated: 0, skipped: uniqueIds.length, error: 'category_required' };
    }
    if (action === 'assign_template' && !opts.replyTemplateId?.trim()) {
      return { ok: false, updated: 0, skipped: uniqueIds.length, error: 'template_required' };
    }

    return { ok: updated > 0, updated, skipped: uniqueIds.length - updated };
  }

  async getCacheStats(branchId?: string | null): Promise<{
    activeCount: number;
    totalUsage: number;
    topIntents: Array<{ intent: string; count: number; usage: number }>;
  }> {
    const qb = this.repo
      .createQueryBuilder('li')
      .select('li.intent', 'intent')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(li.usageCount)', 'usage')
      .where('li.status = :status', { status: AiLearnedIntentStatus.ACTIVE })
      .groupBy('li.intent')
      .orderBy('usage', 'DESC')
      .limit(10);

    if (branchId) {
      qb.andWhere('(li.branchId IS NULL OR li.branchId = :branchId)', { branchId });
    }

    const rows = await qb.getRawMany<{ intent: string; count: string; usage: string }>();
    const activeCount = rows.reduce((sum, r) => sum + Number(r.count), 0);
    const totalUsage = rows.reduce((sum, r) => sum + Number(r.usage ?? 0), 0);

    return {
      activeCount,
      totalUsage,
      topIntents: rows.map(r => ({
        intent: r.intent,
        count: Number(r.count),
        usage: Number(r.usage ?? 0),
      })),
    };
  }

  private async findSimilarMatch(
    normalized: string,
    branchId?: string | null,
  ): Promise<AiLearnedIntent | null> {
    const candidates = await this.listActive(120, branchId);
    let best: AiLearnedIntent | null = null;
    let bestScore = 0;

    for (const row of candidates) {
      const score = questionSimilarity(normalized, row.normalizedPhrase);
      if (score >= SIMILAR_MATCH_MIN && score > bestScore) {
        best = row;
        bestScore = score;
      }
    }
    return best;
  }

  private pickReplyVariation(
    row: AiLearnedIntent,
    contactId: string | null | undefined,
    rotate: boolean,
  ): string | null {
    const variations = [
      ...(row.suggestedReply?.trim() ? [row.suggestedReply.trim()] : []),
      ...(row.replyVariations ?? []).map(v => v.trim()).filter(Boolean),
    ];
    if (!variations.length) return null;
    if (!rotate || variations.length === 1) return variations[0];

    const seed = contactId ?? row.id;
    const usage = row.usageCount ?? 0;
    const idx = Math.abs(this.hashString(`${seed}:${usage}`)) % variations.length;
    return variations[idx];
  }

  private hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  private async incrementUsage(id: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(AiLearnedIntent)
      .set({
        usageCount: () => 'usageCount + 1',
        lastUsedAt: new Date(),
      })
      .where('id = :id', { id })
      .execute();
  }

  async listForExport(limit = 5000): Promise<AiLearnedIntent[]> {
    return this.repo.find({
      where: {
        status: In([
          AiLearnedIntentStatus.ACTIVE,
          AiLearnedIntentStatus.PENDING_REVIEW,
          AiLearnedIntentStatus.DISABLED,
        ]),
      },
      order: { usageCount: 'DESC', createdAt: 'DESC' },
      take: Math.min(limit, 5000),
    });
  }

  async mergeIntents(
    primaryId: string,
    duplicateIds: string[],
  ): Promise<{ ok: boolean; item?: AiLearnedIntent; error?: string }> {
    const primary = await this.repo.findOne({ where: { id: primaryId } });
    if (!primary) return { ok: false, error: 'primary_not_found' };

    const ids = duplicateIds.filter(id => id && id !== primaryId);
    if (!ids.length) return { ok: false, error: 'no_duplicates' };

    const dupes = await this.repo.find({ where: { id: In(ids) } });
    if (!dupes.length) return { ok: false, error: 'no_duplicates' };

    let usage = primary.usageCount ?? 0;
    const variations = new Set<string>();
    for (const v of primary.replyVariations ?? []) {
      if (v?.trim()) variations.add(v.trim());
    }

    for (const d of dupes) {
      usage += d.usageCount ?? 0;
      if (d.suggestedReply?.trim()) variations.add(d.suggestedReply.trim());
      for (const v of d.replyVariations ?? []) {
        if (v?.trim()) variations.add(v.trim());
      }
      d.status = AiLearnedIntentStatus.DISABLED;
      d.metadata = { ...(d.metadata ?? {}), mergedInto: primaryId };
      await this.repo.save(d);
    }

    const primaryReply = primary.suggestedReply?.trim() ?? '';
    primary.usageCount = usage;
    primary.replyVariations = [...variations].filter(v => v !== primaryReply);
    await this.repo.save(primary);
    return { ok: true, item: primary };
  }
}
