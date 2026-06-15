import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiLearningItemsService } from '../ai/ai-learning-items.service';
import { AiLearningKnowledgeService } from '../ai/ai-learning-knowledge.service';
import { AiLearningSettingsService } from '../ai/ai-learning-settings.service';
import { AiLearningItemStatus } from '../ai/ai-learning.enums';
import { AiTrainingApproval } from './entities/ai-training-approval.entity';
import { AiTrainingSuggestion } from './entities/ai-training-suggestion.entity';
import { AiTrainingAuditService } from './ai-training-audit.service';
import { AiTrainingKnowledgeWriterService } from './ai-training-knowledge-writer.service';
import { AiTrainingMemoryWriterService } from './ai-training-memory-writer.service';
import { AiTrainingReindexService } from './ai-training-reindex.service';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiTrainingSuggestionService } from './ai-training-suggestion.service';
import {
  AiTrainingApprovalStatus,
  AiTrainingAuditAction,
  AiTrainingAuditActorType,
  AiTrainingSuggestionActionType,
  AiTrainingUpdateMode,
  ApprovalApplyInput,
  ApprovalPreviewInput,
  HIGH_RISK_ACTION_TYPES,
} from './ai-training.types';
import {
  containsRawPaymentNumber,
  maskPrivateData,
  parseCustomInstruction,
  toRuleId,
} from './utils/ai-training-sanitize.util';
import { itemRequiresAdminApproval } from './utils/ai-training-risk.util';
import { buildTrainingAlternativeQuestions } from './utils/ai-training-knowledge-alternatives.util';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

export interface ApprovalPreviewResult {
  targetFile: string;
  targetSection: string | null;
  updateMode: AiTrainingUpdateMode;
  oldContentPreview: string;
  newContentPreview: string;
  warnings: string[];
  structuredRule?: ReturnType<typeof parseCustomInstruction>;
  requiresAdmin?: boolean;
}

export interface BulkApproveOverride {
  id: string;
  customAnswer?: string;
  selectedSuggestionId?: string;
}

export interface BulkApproveResult {
  approved: string[];
  skipped: Array<{ id: string; reason: string }>;
  failed: Array<{ id: string; error: string }>;
}

@Injectable()
export class AiTrainingApprovalService {
  constructor(
    @InjectRepository(AiTrainingApproval, 'data')
    private readonly approvalRepo: Repository<AiTrainingApproval>,
    @InjectRepository(AiTrainingSuggestion, 'data')
    private readonly suggestionRepo: Repository<AiTrainingSuggestion>,
    private readonly items: AiLearningItemsService,
    private readonly knowledge: AiLearningKnowledgeService,
    private readonly settings: AiLearningSettingsService,
    private readonly audit: AiTrainingAuditService,
    private readonly knowledgeWriter: AiTrainingKnowledgeWriterService,
    private readonly memoryWriter: AiTrainingMemoryWriterService,
    private readonly reindex: AiTrainingReindexService,
    private readonly router: AiTrainingRouterService,
    private readonly suggestions: AiTrainingSuggestionService,
  ) {}

  async previewApproval(input: ApprovalPreviewInput): Promise<ApprovalPreviewResult> {
    const item = await this.items.getItem(input.trainingItemId);
    const resolved = await this.resolveApprovalContent(input, item);
    const warnings: string[] = [];

    if (containsRawPaymentNumber(resolved.answer)) {
      warnings.push('Answer contains payment numbers — use DB tools, save instruction only.');
    }
    if (resolved.actionType && HIGH_RISK_ACTION_TYPES.includes(resolved.actionType)) {
      warnings.push('High-risk rule — admin approval required to apply.');
    }

    let oldContentPreview = '';
    let newContentPreview = resolved.answer;
    if (resolved.targetFile && resolved.updateMode !== AiTrainingUpdateMode.MEMORY_ONLY) {
      try {
        const preview = this.knowledgeWriter.buildPreview({
          targetFile: resolved.targetFile,
          question: item.question,
          approvedAnswer: resolved.answer,
          approvedBy: 'preview',
          ruleId: resolved.ruleId,
          updateMode: AiTrainingUpdateMode.APPEND,
          customInstruction: resolved.instruction,
          triggers: resolved.structured?.triggerPhrases,
          maskPrivate: true,
        });
        if (preview.skippedDuplicate) {
          warnings.push('Rule already exists — will not duplicate.');
        }
        oldContentPreview = preview.oldContent.slice(-800);
        newContentPreview = preview.newContent.slice(-1200);
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }
    }

    return {
      targetFile: resolved.targetFile,
      targetSection: input.targetSection ?? resolved.structured?.intent ?? null,
      updateMode: resolved.updateMode,
      oldContentPreview,
      newContentPreview,
      warnings,
      structuredRule: resolved.structured,
      requiresAdmin: itemRequiresAdminApproval(item, resolved.actionType),
    };
  }

  async bulkApprove(input: {
    ids: string[];
    approvedBy: string;
    approvedByRole?: string;
    applyNow?: boolean;
    overrides?: BulkApproveOverride[];
  }): Promise<BulkApproveResult> {
    const approved: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of input.ids) {
      try {
        const item = await this.items.getItem(id);
        if (
          item.status !== AiLearningItemStatus.PENDING_REVIEW &&
          item.status !== AiLearningItemStatus.SUGGESTED
        ) {
          skipped.push({ id, reason: 'Item not in review queue' });
          continue;
        }

        const override = input.overrides?.find(row => row.id === id);
        const suggestions = await this.suggestionRepo.find({
          where: { trainingItemId: id },
          order: { isRecommended: 'DESC', confidence: 'DESC' },
        });
        const pick = override?.selectedSuggestionId
          ? suggestions.find(s => s.id === override.selectedSuggestionId) ??
            suggestions.find(s => s.isRecommended) ??
            suggestions[0]
          : suggestions.find(s => s.isRecommended) ?? suggestions[0];
        const customAnswer =
          override?.customAnswer?.trim() ||
          item.adminFinalAnswer?.trim() ||
          item.aiDraftAnswer?.trim() ||
          pick?.responseText?.trim() ||
          '';
        if (!customAnswer && pick?.actionType !== AiTrainingSuggestionActionType.MARK_UNANSWERABLE) {
          skipped.push({ id, reason: 'No answer available' });
          continue;
        }

        await this.approve({
          trainingItemId: id,
          selectedSuggestionId: override?.selectedSuggestionId ?? pick?.id,
          customAnswer: customAnswer || undefined,
          targetFile: pick?.targetFile ?? item.targetFile ?? undefined,
          approvedBy: input.approvedBy,
          approvedByRole: input.approvedByRole,
          applyNow: input.applyNow ?? true,
        });
        approved.push(id);
      } catch (err) {
        if (err instanceof ForbiddenException || err instanceof BadRequestException) {
          skipped.push({ id, reason: err.message });
        } else {
          failed.push({ id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    return { approved, skipped, failed };
  }

  async approve(input: ApprovalApplyInput): Promise<{
    item: AiLearningItem;
    approval: AiTrainingApproval;
  }> {
    await this.assertCanApprove(input);
    const item = await this.items.getItem(input.trainingItemId);
    const resolved = await this.resolveApprovalContent(input, item);
    const settings = await this.settings.getSettings();

    if (!settings.requireAdminApproval && input.approvedByRole !== ApiKeyRole.ADMIN) {
      // still allow operators when requireAdminApproval is false
    }

    const approval = this.approvalRepo.create({
      trainingItemId: item.id,
      selectedSuggestionId: input.selectedSuggestionId ?? null,
      customAnswer: resolved.answer,
      customInstruction: resolved.instruction ?? null,
      targetFile: resolved.targetFile,
      targetSection: input.targetSection ?? null,
      updateMode: resolved.updateMode,
      status: AiTrainingApprovalStatus.APPROVED,
      approvedBy: input.approvedBy,
      reindexRequested: false,
    });
    await this.approvalRepo.save(approval);

    item.adminFinalAnswer = resolved.answer;
    item.targetFile = resolved.targetFile;
    item.status = AiLearningItemStatus.APPROVED;
    item.approvedBy = input.approvedBy;
    item.approvedAt = new Date();
    item.reviewedAt = new Date();
    await this.items.updateItem(item.id, item);

    await this.audit.log({
      trainingItemId: item.id,
      action: AiTrainingAuditAction.APPROVED,
      actorType: AiTrainingAuditActorType.ADMIN,
      actorId: input.approvedBy,
      summary: `Approved training for: ${item.question.slice(0, 80)}`,
      details: { targetFile: resolved.targetFile, approvalId: approval.id },
    });

    if (input.applyNow !== false) {
      return this.apply(approval.id, input.approvedBy, input.approvedByRole);
    }

    return { item, approval };
  }

  async apply(
    approvalId: string,
    actorId: string,
    actorRole?: string,
  ): Promise<{ item: AiLearningItem; approval: AiTrainingApproval }> {
    const approval = await this.approvalRepo.findOne({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');

    await this.assertCanApply(approval, actorRole);

    const item = await this.items.getItem(approval.trainingItemId);
    const settings = await this.settings.getSettings();
    const answer = approval.customAnswer ?? item.adminFinalAnswer ?? '';
    if (!answer && approval.updateMode !== AiTrainingUpdateMode.MEMORY_ONLY) {
      throw new BadRequestException('No approved answer to apply');
    }

    let backupPath: string | null = null;
    let oldSnapshot: string | null = null;
    let newSnapshot: string | null = null;

    try {
      if (
        approval.updateMode === AiTrainingUpdateMode.MEMORY_ONLY ||
        approval.updateMode === AiTrainingUpdateMode.FILE_AND_MEMORY
      ) {
        if (!settings.allowMemoryWrites) {
          throw new BadRequestException('Memory writes disabled in settings');
        }
        this.memoryWriter.appendApprovedMemory({
          fact: approval.customInstruction ?? answer,
          approvedBy: actorId,
          sourceItemId: item.id,
          maskPrivate: settings.maskPrivateDataInExports,
        });
      }

      if (
        approval.updateMode !== AiTrainingUpdateMode.MEMORY_ONLY &&
        approval.updateMode !== AiTrainingUpdateMode.DB_RULE_ONLY &&
        settings.allowMarkdownWrites &&
        approval.targetFile
      ) {
        const structured = approval.customInstruction
          ? parseCustomInstruction(approval.customInstruction, item.question)
          : undefined;
        const writeResult = this.knowledgeWriter.writeApprovedKnowledge({
          targetFile: approval.targetFile,
          question: item.question,
          approvedAnswer: answer,
          approvedBy: actorId,
          ruleId: structured?.ruleId ?? toRuleId(item.detectedIntent ?? item.question),
          updateMode: approval.updateMode,
          customInstruction: approval.customInstruction,
          triggers: structured?.triggerPhrases,
          maskPrivate: settings.maskPrivateDataInExports,
        });
        backupPath = writeResult.backupPath;
        oldSnapshot = writeResult.oldContent.slice(-4000);
        newSnapshot = writeResult.newContent.slice(-4000);
      }

      await this.knowledge.createFromApproval({
        questionPattern: item.question,
        alternativeQuestions: buildTrainingAlternativeQuestions(item, {
          customInstruction: approval.customInstruction,
        }),
        approvedAnswer: maskPrivateData(answer),
        category: item.knowledgeCategory,
        targetFile: approval.targetFile ?? item.targetFile ?? 'FAQ.md',
        approvedBy: actorId,
        sourceItemId: item.id,
        sessionId: item.sessionId,
        chatId: item.chatId,
        reviewDate: item.reviewDate,
        internalNotes: approval.customInstruction,
        writeToFile: false,
      });

      item.status = AiLearningItemStatus.APPLIED;
      item.appliedAt = new Date();
      await this.items.updateItem(item.id, item);

      approval.status = AiTrainingApprovalStatus.APPLIED;
      approval.appliedBy = actorId;
      approval.appliedAt = new Date();
      approval.fileBackupPath = backupPath;
      approval.oldContentSnapshot = oldSnapshot;
      approval.newContentSnapshot = newSnapshot;
      approval.reindexRequested = true;

      const changeSize = (newSnapshot?.length ?? 0) - (oldSnapshot?.length ?? 0);
      const reindexed = await this.reindex.maybeAutoReindex(Math.abs(changeSize));
      approval.reindexStatus = reindexed ? 'completed' : 'pending';

      await this.approvalRepo.save(approval);

      await this.audit.log({
        trainingItemId: item.id,
        action: reindexed ? AiTrainingAuditAction.REINDEXED : AiTrainingAuditAction.APPLIED,
        actorType: AiTrainingAuditActorType.ADMIN,
        actorId,
        summary: `Applied training to ${approval.targetFile ?? 'memory'}`,
        details: { approvalId: approval.id, backupPath },
      });

      return { item, approval };
    } catch (err) {
      approval.status = AiTrainingApprovalStatus.FAILED;
      approval.error = err instanceof Error ? err.message : String(err);
      await this.approvalRepo.save(approval);
      await this.audit.log({
        trainingItemId: item.id,
        action: AiTrainingAuditAction.FAILED,
        actorType: AiTrainingAuditActorType.SYSTEM,
        actorId,
        summary: 'Apply failed',
        details: { error: approval.error },
      });
      throw err;
    }
  }

  async reject(trainingItemId: string, actorId: string): Promise<AiLearningItem> {
    const item = await this.items.rejectItem(trainingItemId);
    await this.audit.log({
      trainingItemId,
      action: AiTrainingAuditAction.REJECTED,
      actorType: AiTrainingAuditActorType.ADMIN,
      actorId,
      summary: 'Training item rejected',
    });
    return item;
  }

  private async resolveApprovalContent(
    input: ApprovalPreviewInput,
    item: AiLearningItem,
  ): Promise<{
    answer: string;
    instruction?: string;
    targetFile: string;
    updateMode: AiTrainingUpdateMode;
    actionType?: AiTrainingSuggestionActionType;
    ruleId: string;
    structured?: ReturnType<typeof parseCustomInstruction>;
  }> {
    let answer = input.customAnswer ?? item.adminFinalAnswer ?? item.aiDraftAnswer ?? '';
    let actionType: AiTrainingSuggestionActionType | undefined;
    let targetFile = input.targetFile ?? item.targetFile ?? 'FAQ.md';

    if (input.selectedSuggestionId) {
      const suggestion = await this.suggestionRepo.findOne({
        where: { id: input.selectedSuggestionId },
      });
      if (!suggestion || suggestion.trainingItemId !== item.id) {
        throw new NotFoundException('Suggestion not found');
      }
      answer = input.customAnswer ?? suggestion.responseText ?? answer;
      actionType = suggestion.actionType;
      targetFile = input.targetFile ?? suggestion.targetFile ?? targetFile;
    }

    const routing = this.router.route({
      question: item.question,
      issueType: item.issueType,
      sourceType: item.sourceType,
      detectedIntent: item.detectedIntent,
      actionType,
    });
    targetFile = this.router.resolveTargetFile(targetFile || routing.targetFiles[0]);

    let updateMode = input.updateMode ?? AiTrainingUpdateMode.APPEND;
    if (actionType === AiTrainingSuggestionActionType.UPDATE_MEMORY) {
      updateMode = AiTrainingUpdateMode.MEMORY_ONLY;
    }

    const structured = input.customInstruction
      ? parseCustomInstruction(input.customInstruction, item.question)
      : undefined;

    if (structured && input.customInstruction) {
      answer = answer || structured.responseTemplate;
    }

    return {
      answer,
      instruction: input.customInstruction ?? undefined,
      targetFile,
      updateMode,
      actionType,
      ruleId: structured?.ruleId ?? toRuleId(item.detectedIntent ?? item.question),
      structured,
    };
  }

  private async assertCanApprove(input: ApprovalApplyInput): Promise<void> {
    const settings = await this.settings.getSettings();
    if (!settings.trainingCenterEnabled) {
      throw new BadRequestException('AI Training Center is disabled');
    }
    if (settings.requireAdminApproval && input.approvedByRole !== ApiKeyRole.ADMIN) {
      const item = await this.items.getItem(input.trainingItemId);
      let actionType: AiTrainingSuggestionActionType | undefined;
      if (input.selectedSuggestionId) {
        const s = await this.suggestionRepo.findOne({ where: { id: input.selectedSuggestionId } });
        actionType = s?.actionType;
      }
      if (itemRequiresAdminApproval(item, actionType)) {
        throw new ForbiddenException('High-risk training requires admin role');
      }
    }
  }

  private async assertCanApply(
    approval: AiTrainingApproval,
    actorRole?: string,
  ): Promise<void> {
    const settings = await this.settings.getSettings();
    if (settings.requireAdminApproval && actorRole !== ApiKeyRole.ADMIN) {
      if (approval.targetFile?.includes('PAYMENT') || approval.targetFile?.includes('DISCOUNT')) {
        throw new ForbiddenException('Admin required to apply this training');
      }
    }
  }
}
