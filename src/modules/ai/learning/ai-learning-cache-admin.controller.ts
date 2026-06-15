import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiLearnedIntentService } from './ai-learned-intent.service';
import { AiUnknownMessageService } from './ai-unknown-message.service';
import { AiReplyTemplateService } from './ai-reply-template.service';
import { AiTrainingAnalyticsService } from './ai-training-analytics.service';
import { AiUnknownMessageStatus } from '../entities/ai-unknown-message.entity';
import { AiLearnedIntentStatus } from '../entities/ai-learned-intent.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiLearnedIntent } from '../entities/ai-learned-intent.entity';
import { normalizeCustomerText } from './ai-text-normalizer.util';
import { AiCostPermissionGuard, RequireAiCostPermission } from '../cost/guards/ai-cost-permission.guard';
import { AiLearningPermission } from '../cost/ai-cost-permission.enums';
import { CurrentApiKey } from '../../auth/decorators/auth.decorators';
import { ApiKey } from '../../auth/entities/api-key.entity';

@Controller('admin/ai-learning')
@UseGuards(AiCostPermissionGuard)
export class AiLearningCacheAdminController {
  constructor(
    private readonly learnedIntentService: AiLearnedIntentService,
    private readonly unknownMessageService: AiUnknownMessageService,
    private readonly replyTemplateService: AiReplyTemplateService,
    private readonly trainingAnalyticsService: AiTrainingAnalyticsService,
    @InjectRepository(AiLearnedIntent, 'data')
    private readonly learnedRepo: Repository<AiLearnedIntent>,
  ) {}

  @Get('cache-stats')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async cacheStats(@Query('branchId') branchId?: string) {
    return this.learnedIntentService.getCacheStats(branchId ?? null);
  }

  @Get('analytics')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async trainingAnalytics(
    @Query('range') range?: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.trainingAnalyticsService.getAnalytics(
      range ?? '7',
      branchId ?? null,
    );
    return data;
  }

  @Get('learned-intents')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async listLearnedIntents(
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
  ) {
    const rows = await this.learnedIntentService.listForAdmin(
      limit ? Number(limit) : 50,
      branchId ?? null,
    );
    return { items: rows };
  }

  @Post('learned-intents/bulk')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async bulkLearnedIntents(
    @Body()
    body: {
      ids: string[];
      action: 'approve' | 'reject' | 'disable' | 'change_category' | 'assign_template';
      category?: string;
      replyTemplateId?: string;
    },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    if (!body.ids?.length) return { ok: false, error: 'ids_required' };
    return this.learnedIntentService.bulkAction(
      body.ids,
      body.action,
      { category: body.category, replyTemplateId: body.replyTemplateId },
      apiKey.name ?? apiKey.id,
    );
  }

  @Post('learned-intents')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async createLearnedIntent(
    @Body()
    body: {
      phrase: string;
      intent: string;
      suggestedReply: string;
      replyVariations?: string[];
      branchId?: string | null;
      status?: AiLearnedIntentStatus;
    },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const phrase = body.phrase?.trim();
    const intent = body.intent?.trim();
    const suggestedReply = body.suggestedReply?.trim();
    if (!phrase || !intent || !suggestedReply) {
      return { ok: false, error: 'phrase_intent_reply_required' };
    }

    const normalizedPhrase = normalizeCustomerText(phrase);
    const existing = await this.learnedRepo.findOne({ where: { normalizedPhrase } });
    if (existing) return { ok: false, error: 'duplicate_phrase', item: existing };

    const status = body.status ?? AiLearnedIntentStatus.ACTIVE;
    const item = await this.learnedRepo.save(
      this.learnedRepo.create({
        phrase,
        normalizedPhrase,
        intent,
        suggestedReply,
        replyVariations: body.replyVariations?.map(v => v.trim()).filter(Boolean) ?? null,
        status,
        autoApproved: status === AiLearnedIntentStatus.ACTIVE,
        approvedBy: apiKey.name ?? apiKey.id,
        approvedAt: status === AiLearnedIntentStatus.ACTIVE ? new Date() : null,
        branchId: body.branchId ?? null,
        confidence: 100,
        metadata: { source: 'admin_manual_create' },
      }),
    );
    return { ok: true, item };
  }

  @Get('learned-intents-export.csv')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async exportLearnedIntentsCsv(@Res() res: Response) {
    const rows = await this.learnedIntentService.listForExport();
    const header = 'phrase,intent,suggested_reply,reply_variations,status,usage_count';
    const escape = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const lines = rows.map(r =>
      [
        escape(r.phrase),
        escape(r.intent),
        escape(r.suggestedReply ?? ''),
        escape((r.replyVariations ?? []).join('|')),
        r.status,
        String(r.usageCount ?? 0),
      ].join(','),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="learned-intents-export.csv"');
    res.send([header, ...lines].join('\n'));
  }

  @Post('learned-intents/import-csv')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async importLearnedIntentsCsv(
    @Body() body: { csv: string },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const csv = body.csv?.trim();
    if (!csv) return { ok: false, error: 'csv_required' };

    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { ok: false, error: 'csv_empty' };

    const parseRow = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    };

    const header = parseRow(lines[0]).map(h => h.trim().toLowerCase());
    const phraseIdx = header.indexOf('phrase');
    const intentIdx = header.indexOf('intent');
    const replyIdx = header.findIndex(h => h === 'suggested_reply' || h === 'suggestedreply');
    const variationsIdx = header.findIndex(h => h === 'reply_variations' || h === 'replyvariations');
    if (phraseIdx < 0 || intentIdx < 0 || replyIdx < 0) {
      return { ok: false, error: 'invalid_csv_header' };
    }

    let imported = 0;
    let skipped = 0;
    for (const line of lines.slice(1)) {
      const cols = parseRow(line);
      const phrase = cols[phraseIdx]?.trim();
      const intent = cols[intentIdx]?.trim();
      const suggestedReply = cols[replyIdx]?.trim();
      if (!phrase || !intent || !suggestedReply) {
        skipped += 1;
        continue;
      }
      const normalizedPhrase = normalizeCustomerText(phrase);
      const existing = await this.learnedRepo.findOne({ where: { normalizedPhrase } });
      if (existing) {
        skipped += 1;
        continue;
      }
      const rawVariations = variationsIdx >= 0 ? cols[variationsIdx]?.trim() : '';
      const replyVariations = rawVariations
        ? rawVariations.split('|').map(v => v.trim()).filter(Boolean)
        : null;
      await this.learnedRepo.save(
        this.learnedRepo.create({
          phrase,
          normalizedPhrase,
          intent,
          suggestedReply,
          replyVariations,
          status: AiLearnedIntentStatus.ACTIVE,
          autoApproved: false,
          approvedBy: apiKey.name ?? apiKey.id,
          approvedAt: new Date(),
          confidence: 100,
          metadata: { source: 'admin_csv_import' },
        }),
      );
      imported += 1;
    }
    return { ok: true, imported, skipped };
  }

  @Post('learned-intents/merge')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async mergeLearnedIntents(
    @Body() body: { primaryId: string; duplicateIds: string[] },
  ) {
    if (!body.primaryId?.trim()) return { ok: false, error: 'primary_required' };
    return this.learnedIntentService.mergeIntents(
      body.primaryId.trim(),
      body.duplicateIds ?? [],
    );
  }

  @Get('learned-intents/:id')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async getLearnedIntent(@Param('id') id: string) {
    const row = await this.learnedIntentService.findById(id);
    if (!row) return { item: null };
    return { item: row };
  }

  @Post('learned-intents/:id/approve')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async approveLearnedIntent(@Param('id') id: string, @CurrentApiKey() apiKey: ApiKey) {
    const row = await this.learnedRepo.findOne({ where: { id } });
    if (!row) return { ok: false, error: 'not_found' };
    row.status = AiLearnedIntentStatus.ACTIVE;
    row.approvedBy = apiKey.name ?? apiKey.id;
    row.approvedAt = new Date();
    await this.learnedRepo.save(row);
    return { ok: true, item: row };
  }

  @Post('learned-intents/:id/disable')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async disableLearnedIntent(@Param('id') id: string) {
    const row = await this.learnedRepo.findOne({ where: { id } });
    if (!row) return { ok: false, error: 'not_found' };
    row.status = AiLearnedIntentStatus.DISABLED;
    await this.learnedRepo.save(row);
    return { ok: true, item: row };
  }

  @Post('learned-intents/:id/reject')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async rejectLearnedIntent(@Param('id') id: string) {
    const row = await this.learnedRepo.findOne({ where: { id } });
    if (!row) return { ok: false, error: 'not_found' };
    row.status = AiLearnedIntentStatus.REJECTED;
    await this.learnedRepo.save(row);
    return { ok: true, item: row };
  }

  @Get('reply-templates')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async listReplyTemplates(@Query('branchId') branchId?: string) {
    const items = await this.replyTemplateService.list(branchId ?? null);
    return { items };
  }

  @Post('reply-templates')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async createReplyTemplate(
    @Body()
    body: {
      name: string;
      category: string;
      message: string;
      language?: string;
      active?: boolean;
      branchId?: string | null;
    },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const name = body.name?.trim();
    const category = body.category?.trim();
    const message = body.message?.trim();
    if (!name || !category || !message) {
      return { ok: false, error: 'name_category_message_required' };
    }

    const item = await this.replyTemplateService.create({
      name,
      category,
      message,
      language: body.language,
      active: body.active,
      branchId: body.branchId ?? null,
      createdBy: apiKey.name ?? apiKey.id,
    });
    return { ok: true, item };
  }

  @Patch('reply-templates/:id')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async updateReplyTemplate(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      category?: string;
      message?: string;
      language?: string;
      active?: boolean;
      isFavorite?: boolean;
    },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const item = await this.replyTemplateService.update(id, {
      ...body,
      updatedBy: apiKey.name ?? apiKey.id,
    });
    if (!item) return { ok: false, error: 'not_found' };
    return { ok: true, item };
  }

  @Delete('reply-templates/:id')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async deleteReplyTemplate(@Param('id') id: string) {
    const ok = await this.replyTemplateService.delete(id);
    return { ok };
  }

  @Get('unknown-messages')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async listUnknownMessages(
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
  ) {
    const items = await this.unknownMessageService.listAll(
      limit ? Number(limit) : 50,
      branchId ?? null,
    );
    return { items };
  }

  @Post('unknown-messages/bulk')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async bulkUnknownMessages(
    @Body()
    body: {
      ids: string[];
      action: 'approve' | 'reject' | 'disable' | 'change_category';
      category?: string;
    },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    if (!body.ids?.length) return { ok: false, error: 'ids_required' };
    const actor = apiKey.name ?? apiKey.id;

    if (body.action === 'change_category') {
      const category = body.category?.trim();
      if (!category) return { ok: false, error: 'category_required' };
      const result = await this.unknownMessageService.bulkUpdateDetectedIntent(body.ids, category);
      return { ok: result.updated > 0, ...result };
    }

    if (body.action === 'approve') {
      const uniqueIds = [...new Set(body.ids.map(id => id?.trim()).filter(Boolean))];
      let updated = 0;
      let trained = 0;
      for (const id of uniqueIds) {
        const unknown = await this.unknownMessageService.findById(id);
        if (!unknown) continue;

        await this.unknownMessageService.updateStatus(
          id,
          AiUnknownMessageStatus.APPROVED,
          actor,
        );
        updated += 1;

        const intent = unknown.detectedIntent?.trim();
        const reply = unknown.aiSuggestedReply?.trim();
        if (reply && intent) {
          await this.learnedRepo.save(
            this.learnedRepo.create({
              phrase: unknown.rawText,
              normalizedPhrase: unknown.normalizedText ?? unknown.rawText,
              intent,
              suggestedReply: reply,
              status: AiLearnedIntentStatus.ACTIVE,
              autoApproved: false,
              approvedBy: actor,
              approvedAt: new Date(),
              branchId: unknown.branchId,
              createdFromMessageId: unknown.messageId,
              createdFromConversationId: unknown.conversationId,
              confidence: Number(unknown.confidence ?? 0),
            }),
          );
          trained += 1;
        }
      }
      return {
        ok: updated > 0,
        updated,
        skipped: uniqueIds.length - updated,
        trained,
      };
    }

    const statusMap: Record<string, AiUnknownMessageStatus> = {
      reject: AiUnknownMessageStatus.REJECTED,
      disable: AiUnknownMessageStatus.IGNORED,
    };
    const status = statusMap[body.action];
    if (!status) return { ok: false, error: 'invalid_action' };

    const result = await this.unknownMessageService.bulkUpdateStatus(body.ids, status, actor);
    return { ok: result.updated > 0, ...result };
  }

  @Get('unknown-messages/:id')
  @RequireAiCostPermission(AiLearningPermission.VIEW)
  async getUnknownMessage(@Param('id') id: string) {
    const item = await this.unknownMessageService.findById(id);
    return { item };
  }

  @Post('unknown-messages/:id/approve')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async approveUnknownMessage(
    @Param('id') id: string,
    @Body() body: { reply?: string; intent?: string },
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const unknown = await this.unknownMessageService.findById(id);
    if (!unknown) return { ok: false, error: 'not_found' };

    await this.unknownMessageService.updateStatus(
      id,
      AiUnknownMessageStatus.APPROVED,
      apiKey.name ?? apiKey.id,
    );

    if (body.reply?.trim() && body.intent?.trim()) {
      await this.learnedRepo.save(
        this.learnedRepo.create({
          phrase: unknown.rawText,
          normalizedPhrase: unknown.normalizedText ?? unknown.rawText,
          intent: body.intent.trim(),
          suggestedReply: body.reply.trim(),
          status: AiLearnedIntentStatus.ACTIVE,
          autoApproved: false,
          approvedBy: apiKey.name ?? apiKey.id,
          approvedAt: new Date(),
          branchId: unknown.branchId,
          createdFromMessageId: unknown.messageId,
          createdFromConversationId: unknown.conversationId,
          confidence: Number(unknown.confidence ?? 0),
        }),
      );
    }

    return { ok: true };
  }

  @Post('unknown-messages/:id/reject')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async rejectUnknownMessage(@Param('id') id: string, @CurrentApiKey() apiKey: ApiKey) {
    const row = await this.unknownMessageService.updateStatus(
      id,
      AiUnknownMessageStatus.REJECTED,
      apiKey.name ?? apiKey.id,
    );
    return { ok: !!row };
  }

  @Post('unknown-messages/:id/ignore')
  @RequireAiCostPermission(AiLearningPermission.MANAGE)
  async ignoreUnknownMessage(@Param('id') id: string, @CurrentApiKey() apiKey: ApiKey) {
    const row = await this.unknownMessageService.updateStatus(
      id,
      AiUnknownMessageStatus.IGNORED,
      apiKey.name ?? apiKey.id,
    );
    return { ok: !!row };
  }
}
