import { Injectable, Logger, Inject, forwardRef, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiLearningItemsService } from '../ai/ai-learning-items.service';
import { AiLearningSettingsService } from '../ai/ai-learning-settings.service';
import { AiLearningItemSource, AiLearningItemStatus } from '../ai/ai-learning.enums';
import { AiReplyEvent } from '../ai/entities/ai-reply-event.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { InboxAiHandlingState } from '../ai/inbox-ai-handling.enum';
import { MessageService } from '../message/message.service';
import { AiTrainingAuditService } from './ai-training-audit.service';
import { AiTrainingQuestionGeneratorService } from './ai-training-question-generator.service';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiTrainingSuggestionService } from './ai-training-suggestion.service';
import {
  AiTrainingAuditAction,
  AiTrainingAuditActorType,
  AiTrainingIssueType,
  AiTrainingSourceType,
  CreateTrainingItemInput,
} from './ai-training.types';
import { maskPrivateData } from './utils/ai-training-sanitize.util';
import { applyGroupChatTrainingPolicy } from './utils/ai-training-group-chat.util';
import { DEFAULT_UNKNOWN_REPLY } from '../ai/ai-learning.enums';

const UNKNOWN_PATTERNS = [
  /si\s*jui/i,
  /sijui/i,
  /i\s*don'?t\s*know/i,
  /nipe\s*muda/i,
  /nitakurudia/i,
  /human\s*help/i,
];

@Injectable()
export class AiTrainingScanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiTrainingScanService.name);
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private scanRunning = false;
  private lastScanRunKey: string | null = null;

  constructor(
    @InjectRepository(AiReplyEvent, 'data')
    private readonly replyEvents: Repository<AiReplyEvent>,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    @InjectRepository(AiLearningItem, 'data')
    private readonly itemRepo: Repository<AiLearningItem>,
    private readonly items: AiLearningItemsService,
    private readonly settings: AiLearningSettingsService,
    private readonly audit: AiTrainingAuditService,
    private readonly router: AiTrainingRouterService,
    private readonly questionGen: AiTrainingQuestionGeneratorService,
    private readonly suggestions: AiTrainingSuggestionService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  onModuleInit(): void {
    this.scanTimer = setInterval(() => {
      void this.tickDailyScan().catch(err => {
        this.logger.warn(`Daily training scan failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, 60_000);
    void this.tickDailyScan();
  }

  onModuleDestroy(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
  }

  private async tickDailyScan(): Promise<void> {
    if (this.scanRunning) return;
    this.scanRunning = true;
    try {
      const settings = await this.settings.getSettings();
      if (!settings.trainingCenterEnabled || !settings.dailyInboxScan) return;

      const now = new Date();
      const slot = this.parseScanSlot(now, settings.dailyScanTime ?? '02:00');
      if (now < slot) return;

      const runKey = `${now.toISOString().slice(0, 10)}:${settings.dailyScanTime ?? '02:00'}`;
      if (this.lastScanRunKey === runKey) return;

      this.logger.log(`Running scheduled inbox training scan (${settings.dailyScanTime ?? '02:00'})`);
      await this.scanInbox({ days: settings.scanLastDays ?? 7 });
      this.lastScanRunKey = runKey;
    } finally {
      this.scanRunning = false;
    }
  }

  private parseScanSlot(reference: Date, scanTime: string): Date {
    const [hhRaw, mmRaw] = scanTime.split(':');
    const hh = Number(hhRaw) || 2;
    const mm = Number(mmRaw) || 0;
    const slot = new Date(reference);
    slot.setHours(hh, mm, 0, 0);
    return slot;
  }

  async scheduledDailyScan(): Promise<void> {
    const settings = await this.settings.getSettings();
    if (!settings.trainingCenterEnabled || !settings.dailyInboxScan) return;
    await this.scanInbox({ days: settings.scanLastDays ?? 7 });
  }

  async scanInbox(options?: { days?: number; sessionId?: string }): Promise<{ created: number; scanned: number }> {
    const settings = await this.settings.getSettings();
    if (!settings.trainingCenterEnabled) return { created: 0, scanned: 0 };

    const days = options?.days ?? settings.scanLastDays ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await this.replyEvents.find({
      where: {
        createdAt: MoreThan(since),
        ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 500,
    });

    let created = 0;
    for (const ev of events) {
      if (!ev.incomingText?.trim()) continue;
      const issue = this.detectIssueFromEvent(ev);
      if (!issue) continue;
      const item = await this.createTrainingItem({
        sourceType: AiTrainingSourceType.INBOX_MESSAGE,
        sourceId: ev.id,
        issueType: issue,
        question: ev.incomingText,
        sessionId: ev.sessionId,
        chatId: ev.chatId,
        branchId: ev.branchId,
        productId: ev.productId,
        aiDraftAnswer: ev.replyText,
        detectedIntent: ev.detectedIntent,
        confidenceScore: ev.escalated ? 0.3 : 0.5,
        whyUnsure: ev.escalated ? 'Escalated reply event' : undefined,
      });
      if (item) created += 1;
    }

    const waitingHuman = await this.crmRepo.find({
      where: { aiHandlingState: InboxAiHandlingState.WAITING_HUMAN },
      take: 100,
    });
    for (const thread of waitingHuman) {
      if (!thread.sessionId || !thread.chatId) continue;
      try {
        const { messages } = await this.messageService.getMessages(thread.sessionId, {
          chatId: thread.chatId,
          limit: 8,
        });
        const lastIncoming = [...messages].reverse().find(m => m.direction === 'incoming');
        if (!lastIncoming?.body) continue;
        const item = await this.createTrainingItem({
          sourceType: AiTrainingSourceType.CONVERSATION,
          sourceId: thread.chatId,
          issueType: AiTrainingIssueType.HUMAN_TAKEOVER,
          question: lastIncoming.body,
          sessionId: thread.sessionId,
          chatId: thread.chatId,
          customerId: thread.linkedExternalId ?? null,
          confidenceScore: 0.35,
          whyUnsure: 'Chat waiting for human',
        });
        if (item) created += 1;
      } catch {
        // skip broken thread
      }
    }

    return { created, scanned: events.length + waitingHuman.length };
  }

  async scanSystem(): Promise<{ created: number }> {
    const settings = await this.settings.getSettings();
    if (!settings.trainingCenterEnabled) return { created: 0 };

    let created = 0;
    const repeated = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.timesAsked >= :n', { n: 3 })
      .andWhere('i.status IN (:...s)', {
        s: [AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED],
      })
      .take(50)
      .getMany();

    for (const item of repeated) {
      if (item.issueType === AiTrainingIssueType.REPEATED_QUESTION) continue;
      await this.items.updateItem(item.id, {
        issueType: AiTrainingIssueType.REPEATED_QUESTION,
        priority: 'high',
        title: this.questionGen.generateTitle(item),
      });
      await this.suggestions.generateSuggestions(item);
      created += 1;
    }

    if (settings.trackInstallmentDemand) {
      const installmentItems = await this.itemRepo.count({
        where: { detectedIntent: 'installment' as never },
      });
      if (installmentItems >= 5) {
        const item = await this.createTrainingItem({
          sourceType: AiTrainingSourceType.SYSTEM_DIAGNOSIS,
          issueType: AiTrainingIssueType.MISSING_POLICY,
          question: 'Many customers ask about installment — create installment response rule',
          title: 'Installment demand pattern',
          confidenceScore: 0.4,
          metadata: { pattern: 'installment_demand' },
        });
        if (item) created += 1;
      }
    }

    return { created };
  }

  async createTrainingItem(input: CreateTrainingItemInput): Promise<AiLearningItem | null> {
    const settings = await this.settings.getSettings();
    if (!settings.trainingCenterEnabled) return null;

    const gated = applyGroupChatTrainingPolicy(input, settings.trainingGroupChatsMode);
    if (!gated) return null;
    input = gated;

    const routing = this.router.route({
      question: input.question,
      issueType: input.issueType,
      sourceType: input.sourceType,
      detectedIntent: input.detectedIntent,
    });

    const excerpt = input.conversationExcerpt
      ? maskPrivateData(input.conversationExcerpt)
      : null;

    const item = await this.items.createItem({
      question: input.question,
      sessionId: input.sessionId,
      chatId: input.chatId,
      customerId: input.customerId,
      branchId: input.branchId,
      detectedIntent: input.detectedIntent,
      detectedProduct: input.detectedProduct,
      contextMessages: input.contextMessages,
      aiDraftAnswer: input.aiDraftAnswer,
      confidenceScore: input.confidenceScore,
      whyUnsure: input.whyUnsure,
      source:
        input.issueType === AiTrainingIssueType.HUMAN_TAKEOVER
          ? AiLearningItemSource.STAFF_CORRECTION
          : AiLearningItemSource.AUTO_UNKNOWN,
      status:
        input.issueType === AiTrainingIssueType.HUMAN_TAKEOVER
          ? AiLearningItemStatus.SUGGESTED
          : AiLearningItemStatus.PENDING_REVIEW,
    });

    await this.items.updateItem(item.id, {
      issueType: input.issueType,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      messageId: input.messageId ?? null,
      productId: input.productId ?? null,
      title: input.title ?? this.questionGen.generateTitle(item),
      conversationExcerpt: excerpt,
      suggestedMemoryType: input.suggestedMemoryType ?? null,
      suggestedRuleCategory: input.suggestedRuleCategory ?? null,
      createdByAi: input.createdByAi ?? true,
      metadata: input.metadata ?? null,
      targetFile: input.suggestedTargetFile ?? routing.targetFiles[0] ?? 'FAQ.md',
    });

    const updated = await this.items.getItem(item.id);
    if (settings.autoSuggestDraftAnswer) {
      await this.suggestions.generateSuggestions(updated);
    }

    await this.audit.log({
      trainingItemId: updated.id,
      action: AiTrainingAuditAction.CREATED,
      actorType: input.createdByAi ? AiTrainingAuditActorType.AI : AiTrainingAuditActorType.ADMIN,
      summary: `Training item created: ${input.issueType}`,
      details: { sourceType: input.sourceType },
    });

    if (settings.autoClusterRepeated && updated.timesAsked >= 3) {
      updated.similarGroupId = updated.similarGroupId ?? updated.id;
      await this.items.updateItem(updated.id, {
        similarGroupId: updated.similarGroupId,
        issueType: AiTrainingIssueType.REPEATED_QUESTION,
        priority: 'high',
      });
    }

    return this.items.getItem(updated.id);
  }

  async createFromLowConfidence(input: {
    sessionId: string;
    chatId: string;
    incomingText: string;
    branchId?: string | null;
    aiDraftAnswer?: string | null;
    confidenceScore: number;
    whyUnsure?: string;
    detectedIntent?: string | null;
    detectedProduct?: string | null;
  }): Promise<AiLearningItem | null> {
    const settings = await this.settings.getSettings();
    const gated = applyGroupChatTrainingPolicy(
      {
        chatId: input.chatId,
        sourceType: AiTrainingSourceType.INBOX_MESSAGE,
      },
      settings.trainingGroupChatsMode,
    );
    if (!gated) return null;

    if (!settings.autoCreateFromLowConfidence) {
      return this.items.createFromLowConfidence({
        question: input.incomingText,
        sessionId: input.sessionId,
        chatId: input.chatId,
        branchId: input.branchId,
        aiDraftAnswer: input.aiDraftAnswer,
        confidenceScore: input.confidenceScore,
        whyUnsure: input.whyUnsure,
        detectedIntent: input.detectedIntent,
        detectedProduct: input.detectedProduct,
      });
    }
    return this.createTrainingItem({
      sourceType: AiTrainingSourceType.INBOX_MESSAGE,
      issueType: AiTrainingIssueType.LOW_CONFIDENCE,
      question: input.incomingText,
      sessionId: input.sessionId,
      chatId: input.chatId,
      branchId: input.branchId,
      aiDraftAnswer: input.aiDraftAnswer,
      confidenceScore: input.confidenceScore,
      whyUnsure: input.whyUnsure,
      detectedIntent: input.detectedIntent,
      detectedProduct: input.detectedProduct,
    });
  }

  async createFromHumanReply(input: {
    sessionId: string;
    chatId: string;
    question: string;
    staffAnswer: string;
    branchId?: string | null;
  }): Promise<AiLearningItem | null> {
    const settings = await this.settings.getSettings();
    if (!settings.autoCreateFromHumanReplies) return null;
    return this.createTrainingItem({
      sourceType: AiTrainingSourceType.INBOX_MESSAGE,
      issueType: AiTrainingIssueType.HUMAN_TAKEOVER,
      question: input.question,
      sessionId: input.sessionId,
      chatId: input.chatId,
      branchId: input.branchId,
      confidenceScore: 0.5,
      whyUnsure: 'Staff answered after AI pause',
      metadata: { staffAnswer: maskPrivateData(input.staffAnswer) },
    }).then(async item => {
      if (item && input.staffAnswer) {
        await this.items.updateItem(item.id, { adminFinalAnswer: input.staffAnswer });
        return this.items.getItem(item.id);
      }
      return item;
    });
  }

  private detectIssueFromEvent(ev: AiReplyEvent): AiTrainingIssueType | null {
    const reply = ev.replyText ?? '';
    const incoming = ev.incomingText ?? '';

    if (ev.escalated) return AiTrainingIssueType.LOW_CONFIDENCE;
    if (!reply.trim()) return AiTrainingIssueType.NO_ANSWER;
    if (UNKNOWN_PATTERNS.some(p => p.test(reply))) return AiTrainingIssueType.NO_ANSWER;
    if (reply.trim() === DEFAULT_UNKNOWN_REPLY) return AiTrainingIssueType.LOW_CONFIDENCE;

    if (/warranty|garansi/i.test(incoming)) return AiTrainingIssueType.MISSING_POLICY;
    if (/installment|kidogo kidogo/i.test(incoming)) return AiTrainingIssueType.MISSING_POLICY;
    if (/discount|punguzo/i.test(incoming)) return AiTrainingIssueType.MISSING_POLICY;
    if (/customer care|namba ya kupiga/i.test(incoming)) {
      return AiTrainingIssueType.CUSTOMER_SERVICE_REQUEST;
    }

    return null;
  }
}
