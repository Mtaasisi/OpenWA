import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { AiLearningItemsService } from './ai-learning-items.service';
import { AiLearningKnowledgeService } from './ai-learning-knowledge.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { MessageService } from '../message/message.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { EventsGateway } from '../events/events.gateway';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import {
  classifyConfidenceBand,
  computeConfidenceScore,
  knowledgeAutoReplyThreshold,
  TRAINING_KNOWLEDGE_MATCH_MIN,
} from './utils/ai-learning-confidence.util';
import {
  AiLearningItemStatus,
  AiLearningKnowledgeStatus,
  AiLearningOutcome,
} from './ai-learning.enums';
import { parseAiNotes, serializeAiNotes } from './utils/ai-behavior.util';
import { bumpSuccessRate, detectLearningOutcome } from './utils/ai-learning-outcome.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { AiTrainingScanService } from '../ai-training/ai-training-scan.service';

export interface LearningReplyDecision {
  useApprovedAnswer: string | null;
  shouldEscalateLowConfidence: boolean;
  waitingReply: string | null;
  confidenceScore: number;
  knowledgeId?: string | null;
  sourceItemId?: string | null;
}

@Injectable()
export class AiLearningInboxService {
  private readonly logger = new Logger(AiLearningInboxService.name);

  constructor(
    private readonly items: AiLearningItemsService,
    private readonly knowledge: AiLearningKnowledgeService,
    private readonly settings: AiLearningSettingsService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrm: InboxCrmService,
    private readonly events: EventsGateway,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    @Inject(forwardRef(() => AiTrainingScanService))
    private readonly trainingScan: AiTrainingScanService,
  ) {}

  async decideBeforeAgent(
    sessionId: string,
    chatId: string,
    incomingText: string,
    ragScore = 0.5,
    unrestricted = false,
  ): Promise<LearningReplyDecision> {
    const settings = await this.settings.getSettings();
    if (!settings.enableLearningDetection || unrestricted) {
      return {
        useApprovedAnswer: null,
        shouldEscalateLowConfidence: false,
        waitingReply: null,
        confidenceScore: 0.7,
      };
    }

    const minRetrieveScore = Math.min(
      settings.trainingKnowledgeMatchThreshold ?? TRAINING_KNOWLEDGE_MATCH_MIN,
      settings.highConfidenceThreshold ?? 0.8,
    );
    const match = await this.knowledge.findBestMatch(incomingText, minRetrieveScore);
    if (match) {
      const threshold = knowledgeAutoReplyThreshold(match.knowledge, settings);
      if (match.score >= threshold) {
        await this.knowledge.recordUsage(match.knowledge.id);
        return {
          useApprovedAnswer: match.knowledge.approvedAnswer,
          shouldEscalateLowConfidence: false,
          waitingReply: null,
          confidenceScore: match.score,
          knowledgeId: match.knowledge.id,
          sourceItemId: match.knowledge.sourceItemId,
        };
      }
    }

    const score = computeConfidenceScore({
      ragMatchScore: ragScore,
      knowledgeMatchScore: match?.score,
    });
    const band = classifyConfidenceBand(score, settings);
    if (band === 'low') {
      return {
        useApprovedAnswer: null,
        shouldEscalateLowConfidence: true,
        waitingReply: settings.defaultUnknownReply,
        confidenceScore: score,
      };
    }
    return {
      useApprovedAnswer: null,
      shouldEscalateLowConfidence: false,
      waitingReply: null,
      confidenceScore: score,
    };
  }

  async handleLowConfidence(input: {
    sessionId: string;
    chatId: string;
    incomingText: string;
    branchId?: string | null;
    aiDraftAnswer?: string | null;
    confidenceScore: number;
    whyUnsure?: string;
    detectedIntent?: string | null;
    detectedProduct?: string | null;
  }): Promise<void> {
    const context = await this.messageService.getChatMessagesForAi(
      input.sessionId,
      input.chatId,
      8,
    );
    const contextMessages = context.messages.map(m => ({
      role: m.direction === 'incoming' ? 'customer' : 'staff',
      body: m.body ?? '',
      at: m.createdAt?.toISOString?.() ?? undefined,
    }));

    const item = await this.trainingScan.createFromLowConfidence({
      incomingText: input.incomingText,
      sessionId: input.sessionId,
      chatId: input.chatId,
      branchId: input.branchId,
      detectedIntent: input.detectedIntent,
      detectedProduct: input.detectedProduct,
      aiDraftAnswer: input.aiDraftAnswer,
      confidenceScore: input.confidenceScore,
      whyUnsure: input.whyUnsure ?? 'Low confidence — needs admin review',
    });

    await this.inboxCrm.setAiHandlingState(
      input.sessionId,
      input.chatId,
      InboxAiHandlingState.WAITING_HUMAN,
    );

    if (item) {
      this.events.emitAiLearningPending(input.sessionId, {
        itemId: item.id,
        chatId: input.chatId,
        question: item.question,
        timesAsked: item.timesAsked,
      });
      if (item.timesAsked >= 3) {
        this.events.emitAiLearningRepeated(input.sessionId, {
          itemId: item.id,
          question: item.question,
          timesAsked: item.timesAsked,
        });
      }
    }
  }

  async markPendingKnowledgeOutcome(
    sessionId: string,
    chatId: string,
    knowledgeId: string,
    sourceItemId?: string | null,
  ): Promise<void> {
    const settings = await this.settings.getSettings();
    if (!settings.trackCustomerOutcome) return;
    const row = await this.crmRepo.findOne({ where: { sessionId, chatId } });
    if (!row) return;
    const notes = parseAiNotes(row.aiNotes);
    notes.pendingKnowledgeOutcome = {
      knowledgeId,
      sourceItemId: sourceItemId ?? null,
      askedAt: new Date().toISOString(),
    };
    row.aiNotes = serializeAiNotes(notes);
    await this.crmRepo.save(row);
  }

  async processOutcomeOnIncoming(
    sessionId: string,
    chatId: string,
    incomingText: string,
  ): Promise<void> {
    const settings = await this.settings.getSettings();
    if (!settings.trackCustomerOutcome) return;
    const row = await this.crmRepo.findOne({ where: { sessionId, chatId } });
    if (!row?.aiNotes) return;
    const notes = parseAiNotes(row.aiNotes);
    const pending = notes.pendingKnowledgeOutcome as
      | { knowledgeId?: string; sourceItemId?: string | null }
      | undefined;
    if (!pending?.knowledgeId) return;

    const outcome = detectLearningOutcome(incomingText);
    if (!outcome) return;

    try {
      const knowledge = await this.knowledge.getKnowledge(pending.knowledgeId);
      knowledge.successRate = bumpSuccessRate(knowledge.successRate, outcome);
      const patch: { successRate: number; status?: AiLearningKnowledgeStatus } = {
        successRate: knowledge.successRate,
      };
      if (
        outcome === AiLearningOutcome.POOR_PERFORMANCE ||
        outcome === AiLearningOutcome.STAFF_CORRECTED_LATER
      ) {
        patch.status = AiLearningKnowledgeStatus.NEEDS_REVIEW;
        this.events.emitKnowledgeNeedsReview({
          knowledgeId: knowledge.id,
          questionPattern: knowledge.questionPattern,
        });
      }
      await this.knowledge.updateKnowledge(pending.knowledgeId, patch);

      if (pending.sourceItemId) {
        await this.items.updateItem(pending.sourceItemId, { outcome });
      }
    } catch {
      // knowledge row may have been removed
    }

    delete notes.pendingKnowledgeOutcome;
    row.aiNotes = Object.keys(notes).length ? serializeAiNotes(notes) : null;
    await this.crmRepo.save(row);
  }

  async handleStaffCorrection(
    sessionId: string,
    chatId: string,
    staffText: string,
  ): Promise<void> {
    const settings = await this.settings.getSettings();
    if (!settings.trackStaffCorrections) return;

    const { messages } = await this.messageService.getMessages(sessionId, { chatId, limit: 12 });
    const lastAi = [...messages]
      .reverse()
      .find(m => m.direction === 'outgoing' && m.isAiGenerated);
    if (!lastAi?.body) return;

    const lastIncoming = [...messages]
      .reverse()
      .find(m => m.direction === 'incoming');
    if (!lastIncoming?.body) return;

    if (lastAi.body.trim() === staffText.trim()) return;

    if (settings.trainingCenterEnabled && settings.autoCreateFromHumanReplies) {
      const item = await this.trainingScan.createFromHumanReply({
        sessionId,
        chatId,
        question: lastIncoming.body,
        staffAnswer: staffText,
      });
      if (item) {
        this.events.emitAiLearningPending(sessionId, {
          itemId: item.id,
          chatId,
          question: item.question,
          timesAsked: item.timesAsked,
        });
      }
      return;
    }

    await this.items.createStaffCorrection({
      question: lastIncoming.body,
      sessionId,
      chatId,
      aiDraftAnswer: lastAi.body,
      status: AiLearningItemStatus.SUGGESTED,
      whyUnsure: 'Staff edited AI reply',
      confidenceScore: 0.4,
    });
  }
}
