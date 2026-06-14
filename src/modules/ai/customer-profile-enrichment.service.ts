import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerProfileEnrichment } from './entities/customer-profile-enrichment.entity';
import { CustomerProfileLearningEvent } from './entities/customer-profile-learning-event.entity';
import { LostDemandFollowup } from './entities/lost-demand-followup.entity';
import { AiConfig } from './entities/ai-config.entity';
import { AiSettingsService } from './ai-settings.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import {
  ProfileConversationFlow,
  ProfileLearningEventStatus,
  ProfileQuestionKind,
  LostDemandReason,
  LostDemandStatus,
} from './customer-profile.enums';
import {
  extractNameSafely,
  formatNameSaveReply,
  formatNameConfirmationQuestion,
  isAffirmative,
  isNegative,
  customerRejectedAlternative,
} from './utils/customer-name-detector.util';
import { detectNameCorrection } from './utils/customer-name-correction.util';
import {
  shouldAskProfileQuestion,
  NOTIFY_PERMISSION_QUESTION,
  type ProfileQuestionPlan,
} from './utils/profile-question-planner.util';
import { extractProfileFieldsSilently } from './utils/profile-field-extractor.util';

type CrmProfileSlice = {
  customerName?: string | null;
  confirmedCity?: string | null;
  inferredCity?: string | null;
};

export type ProfileReplyDecision = {
  replyText?: string;
  skipAgent?: boolean;
  profileQuestionHint?: string;
  recordQuestionAsked?: ProfileQuestionKind;
};

export type ProcessIncomingProfileInput = {
  sessionId: string;
  chatId: string;
  incomingText: string;
  messageId?: string;
  previousAiMessage?: string | null;
  isGroup?: boolean;
  customerAskedUrgentProductQuestion?: boolean;
  profileContext?: 'quote' | 'order' | 'delivery' | 'payment' | 'notify' | 'recommend' | 'general';
  wantedProduct?: string | null;
  alternativeRejected?: boolean;
};

@Injectable()
export class CustomerProfileEnrichmentService {
  constructor(
    @InjectRepository(CustomerProfileEnrichment, 'data')
    private readonly enrichmentRepo: Repository<CustomerProfileEnrichment>,
    @InjectRepository(CustomerProfileLearningEvent, 'data')
    private readonly eventRepo: Repository<CustomerProfileLearningEvent>,
    @InjectRepository(LostDemandFollowup, 'data')
    private readonly lostDemandRepo: Repository<LostDemandFollowup>,
    private readonly aiSettings: AiSettingsService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversations: FollowupConversationService,
  ) {}

  async getOrCreate(sessionId: string, chatId: string): Promise<CustomerProfileEnrichment> {
    let row = await this.enrichmentRepo.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.enrichmentRepo.create({ sessionId, chatId });
      row = await this.enrichmentRepo.save(row);
    }
    return row;
  }

  async processIncomingMessage(input: ProcessIncomingProfileInput): Promise<ProfileReplyDecision | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config?.progressiveProfilingEnabled) return null;
    if (input.isGroup && config.profilingDisabledInGroups) return null;

    const enrichment = await this.getOrCreate(input.sessionId, input.chatId);
    if (enrichment.profileLearningPaused) return null;

    const crm = await this.inboxCrmService.getThreadCrm(input.sessionId, input.chatId);
    const currentName =
      enrichment.preferredName ?? crm?.customerName ?? enrichment.fullName ?? null;

    if (config.profilingDetectNameCorrections) {
      const correction = detectNameCorrection(input.incomingText, currentName);
      if (correction && (currentName || correction.previousName)) {
        await this.updateCorrectedName(
          input.sessionId,
          input.chatId,
          correction.correctedName,
          input.messageId,
          config,
        );
        return {
          replyText:
            config.profilingNameCorrectionReply?.trim() || 'Ahaa basi powa nimekupata.',
          skipAgent: true,
        };
      }
    }

    if (enrichment.conversationFlow === ProfileConversationFlow.AWAITING_NAME_CONFIRMATION) {
      const pending =
        typeof enrichment.aiProfileNotes?.pendingNameConfirmation === 'string'
          ? enrichment.aiProfileNotes.pendingNameConfirmation
          : null;
      if (pending && isAffirmative(input.incomingText)) {
        await this.saveDetectedName(
          input.sessionId,
          input.chatId,
          pending,
          0.85,
          input.messageId,
          config,
          'after_name_question',
        );
        enrichment.conversationFlow = ProfileConversationFlow.IDLE;
        enrichment.aiProfileNotes = {
          ...(enrichment.aiProfileNotes ?? {}),
          pendingNameConfirmation: undefined,
        };
        await this.enrichmentRepo.save(enrichment);
        const template =
          config.profilingNameSaveReplyTemplate || 'Sawa {name}, ngoja nisave namba yako 😊';
        return {
          replyText: formatNameSaveReply(template, pending),
          skipAgent: true,
        };
      }
      if (isNegative(input.incomingText)) {
        enrichment.conversationFlow = ProfileConversationFlow.IDLE;
        enrichment.aiProfileNotes = {
          ...(enrichment.aiProfileNotes ?? {}),
          pendingNameConfirmation: undefined,
        };
        await this.enrichmentRepo.save(enrichment);
        return null;
      }
    }

    if (enrichment.conversationFlow === ProfileConversationFlow.AWAITING_NOTIFY_PERMISSION) {
      if (isAffirmative(input.incomingText)) {
        enrichment.notifyWhenAvailable = true;
        enrichment.conversationFlow = ProfileConversationFlow.AWAITING_NAME_FOR_NOTIFY;
        await this.enrichmentRepo.save(enrichment);
        if (!currentName) {
          return {
            replyText:
              'Sawa Boss, nikikupatia hiyo model nitakujulisha. Nikutambue kwa jina gani?',
            skipAgent: true,
            recordQuestionAsked: ProfileQuestionKind.NAME,
          };
        }
        enrichment.conversationFlow = ProfileConversationFlow.IDLE;
        await this.enrichmentRepo.save(enrichment);
        return null;
      }
      if (isNegative(input.incomingText)) {
        enrichment.conversationFlow = ProfileConversationFlow.IDLE;
        await this.enrichmentRepo.save(enrichment);
        return null;
      }
    }

    const nameDetection = extractNameSafely(input.incomingText, input.previousAiMessage);
    if (nameDetection) {
      const high = config.profilingHighConfidenceThreshold ?? 0.9;
      const medium = config.profilingMediumConfidenceThreshold ?? 0.6;
      const suspiciousConfirmationEnabled = config.suspiciousNameConfirmationEnabled !== false;

      if (
        nameDetection.suspicious &&
        suspiciousConfirmationEnabled &&
        config.profilingRequireReviewMediumConfidence
      ) {
        enrichment.conversationFlow = ProfileConversationFlow.AWAITING_NAME_CONFIRMATION;
        enrichment.aiProfileNotes = {
          ...(enrichment.aiProfileNotes ?? {}),
          pendingNameConfirmation: nameDetection.name,
        };
        await this.enrichmentRepo.save(enrichment);
        return {
          replyText: formatNameConfirmationQuestion(nameDetection.name),
          skipAgent: true,
        };
      }

      if (
        nameDetection.confidence >= high &&
        !nameDetection.suspicious &&
        config.profilingAutoSaveHighConfidenceNames &&
        this.canSaveName(currentName, nameDetection.name, true)
      ) {
        await this.saveDetectedName(
          input.sessionId,
          input.chatId,
          nameDetection.name,
          nameDetection.confidence,
          input.messageId,
          config,
          nameDetection.source,
        );
        if (
          enrichment.conversationFlow === ProfileConversationFlow.AWAITING_NAME_FOR_NOTIFY ||
          nameDetection.source === 'after_name_question'
        ) {
          enrichment.conversationFlow = ProfileConversationFlow.IDLE;
          await this.enrichmentRepo.save(enrichment);
        }
        const template =
          config.profilingNameSaveReplyTemplate ||
          'Sawa {name}, ngoja nisave namba yako 😊';
        return {
          replyText: formatNameSaveReply(template, nameDetection.name),
          skipAgent: true,
        };
      }

      if (
        nameDetection.confidence >= medium &&
        nameDetection.confidence < high &&
        config.profilingRequireReviewMediumConfidence
      ) {
        enrichment.nameNeedsReview = true;
        await this.enrichmentRepo.save(enrichment);
        await this.createProfileLearningEvent({
          sessionId: input.sessionId,
          chatId: input.chatId,
          fieldName: 'preferredName',
          newValue: nameDetection.name,
          confidenceScore: nameDetection.confidence,
          source: nameDetection.source,
          status: ProfileLearningEventStatus.NEEDS_REVIEW,
          messageId: input.messageId,
        });
        return {
          replyText: `Boss nikutambue kama ${nameDetection.name}?`,
          skipAgent: true,
        };
      }
    }

    if (config.profilingSilentSaveFields) {
      await this.applySilentFieldExtraction(input.sessionId, input.chatId, input.incomingText);
    }

    if (input.alternativeRejected && input.wantedProduct && config.profilingCreateLostDemandFollowups) {
      await this.createLostDemandFollowup({
        sessionId: input.sessionId,
        chatId: input.chatId,
        wantedProduct: input.wantedProduct,
        reason: LostDemandReason.CUSTOMER_REJECTED_ALTERNATIVE,
        alternativeOffered: true,
        alternativeAccepted: false,
      });
      enrichment.conversationFlow = ProfileConversationFlow.AWAITING_NOTIFY_PERMISSION;
      if (input.wantedProduct) enrichment.wantedProduct = input.wantedProduct;
      await this.enrichmentRepo.save(enrichment);
      return { replyText: NOTIFY_PERMISSION_QUESTION, skipAgent: true };
    }

    const plan = this.planQuestion(enrichment, crm, input, config);
    if (plan) {
      return {
        profileQuestionHint: plan.text,
        recordQuestionAsked: plan.kind,
      };
    }

    return null;
  }

  private planQuestion(
    enrichment: CustomerProfileEnrichment,
    crm: CrmProfileSlice | null,
    input: ProcessIncomingProfileInput,
    config: AiConfig,
  ): ProfileQuestionPlan | null {
    if ((config.profilingMaxQuestionsPerReply ?? 1) < 1) return null;
    return shouldAskProfileQuestion({
      hasName: Boolean(enrichment.preferredName ?? crm?.customerName),
      hasCity: Boolean(crm?.confirmedCity ?? crm?.inferredCity),
      hasDeliveryPreference: Boolean(enrichment.deliveryPreference),
      hasBudget: Boolean(enrichment.budgetRange),
      hasUseCase: Boolean(enrichment.customerUseCase),
      lastQuestionAsked: enrichment.lastProfileQuestionAsked,
      lastQuestionAskedAt: enrichment.lastProfileQuestionAskedAt,
      context: input.profileContext ?? 'general',
      customerAskedUrgentProductQuestion: input.customerAskedUrgentProductQuestion ?? false,
    });
  }

  private canSaveName(
    existing: string | null,
    candidate: string,
    isCorrectionOrHighConfidence: boolean,
  ): boolean {
    if (!existing?.trim()) return true;
    if (isCorrectionOrHighConfidence && existing.trim().toLowerCase() !== candidate.toLowerCase()) {
      return true;
    }
    return existing.trim().toLowerCase() === candidate.toLowerCase();
  }

  async saveDetectedName(
    sessionId: string,
    chatId: string,
    name: string,
    confidence: number,
    messageId: string | undefined,
    config: AiConfig,
    source: string,
  ): Promise<void> {
    const enrichment = await this.getOrCreate(sessionId, chatId);
    const oldName = enrichment.preferredName;
    enrichment.preferredName = name;
    enrichment.fullName = name;
    enrichment.nameConfidenceScore = confidence;
    enrichment.nameSourceMessageId = messageId ?? null;
    enrichment.nameLastConfirmedAt = new Date();
    enrichment.nameNeedsReview = false;
    enrichment.lastProfileUpdatedByAiAt = new Date();
    enrichment.profileCompleteness = this.computeCompleteness(enrichment);
    await this.enrichmentRepo.save(enrichment);

    await this.inboxCrmService.upsertThreadCrm(sessionId, chatId, { customerName: name });
    const conv = await this.followupConversations.findByThread(sessionId, chatId);
    if (conv) {
      await this.followupConversations.update(conv.id, { customerName: name });
    }

    await this.createProfileLearningEvent({
      sessionId,
      chatId,
      fieldName: 'preferredName',
      oldValue: oldName,
      newValue: name,
      confidenceScore: confidence,
      source,
      status: ProfileLearningEventStatus.AUTO_SAVED,
      messageId,
    });
  }

  async updateCorrectedName(
    sessionId: string,
    chatId: string,
    name: string,
    messageId: string | undefined,
    config: AiConfig,
  ): Promise<void> {
    const enrichment = await this.getOrCreate(sessionId, chatId);
    const oldName = enrichment.preferredName;
    enrichment.preferredName = name;
    enrichment.fullName = name;
    enrichment.nameConfidenceScore = 0.98;
    enrichment.nameLastConfirmedAt = new Date();
    enrichment.nameNeedsReview = false;
    enrichment.lastProfileUpdatedByAiAt = new Date();
    await this.enrichmentRepo.save(enrichment);
    await this.inboxCrmService.upsertThreadCrm(sessionId, chatId, { customerName: name });
    const conv = await this.followupConversations.findByThread(sessionId, chatId);
    if (conv) {
      await this.followupConversations.update(conv.id, { customerName: name });
    }
    await this.createProfileLearningEvent({
      sessionId,
      chatId,
      fieldName: 'preferredName',
      oldValue: oldName,
      newValue: name,
      confidenceScore: 0.98,
      source: 'correction',
      status: ProfileLearningEventStatus.CORRECTED,
      messageId,
    });
  }

  async applySilentFieldExtraction(
    sessionId: string,
    chatId: string,
    message: string,
  ): Promise<void> {
    const fields = extractProfileFieldsSilently(message);
    if (!Object.keys(fields).length) return;
    const enrichment = await this.getOrCreate(sessionId, chatId);
    const crmPatch: Record<string, string> = {};

    if (fields.deliveryPreference && !enrichment.deliveryPreference) {
      enrichment.deliveryPreference = fields.deliveryPreference;
      await this.createProfileLearningEvent({
        sessionId,
        chatId,
        fieldName: 'deliveryPreference',
        newValue: fields.deliveryPreference,
        confidenceScore: 0.85,
        source: 'message',
        status: ProfileLearningEventStatus.AUTO_SAVED,
      });
    }
    if (fields.paymentPreference && !enrichment.paymentPreference) {
      enrichment.paymentPreference = fields.paymentPreference;
      await this.createProfileLearningEvent({
        sessionId,
        chatId,
        fieldName: 'paymentPreference',
        newValue: fields.paymentPreference,
        confidenceScore: 0.85,
        source: 'message',
        status: ProfileLearningEventStatus.AUTO_SAVED,
      });
    }
    if (fields.budgetRange && !enrichment.budgetRange) {
      enrichment.budgetRange = fields.budgetRange;
    }
    if (fields.customerUseCase && !enrichment.customerUseCase) {
      enrichment.customerUseCase = fields.customerUseCase;
    }
    if (fields.gender) {
      const existing =
        typeof enrichment.aiProfileNotes?.gender === 'string'
          ? enrichment.aiProfileNotes.gender
          : null;
      if (!existing) {
        enrichment.aiProfileNotes = {
          ...(enrichment.aiProfileNotes ?? {}),
          gender: fields.gender,
        };
        await this.createProfileLearningEvent({
          sessionId,
          chatId,
          fieldName: 'gender',
          newValue: fields.gender,
          confidenceScore: 0.8,
          source: 'message',
          status: ProfileLearningEventStatus.AUTO_SAVED,
        });
      }
    }
    if (fields.location) {
      const existingLocation =
        typeof enrichment.aiProfileNotes?.location === 'string'
          ? enrichment.aiProfileNotes.location
          : null;
      if (!existingLocation) {
        enrichment.aiProfileNotes = {
          ...(enrichment.aiProfileNotes ?? {}),
          location: fields.location,
          ...(fields.country ? { country: fields.country } : {}),
        };
        await this.createProfileLearningEvent({
          sessionId,
          chatId,
          fieldName: 'location',
          newValue: fields.country ? `${fields.location}, ${fields.country}` : fields.location,
          confidenceScore: 0.82,
          source: 'message',
          status: ProfileLearningEventStatus.AUTO_SAVED,
        });
      }
    }
    if (fields.confirmedCity) {
      crmPatch.confirmedCity = fields.confirmedCity;
      await this.inboxCrmService.upsertThreadCrm(sessionId, chatId, {
        confirmedCity: fields.confirmedCity,
      });
    }
    enrichment.lastProfileUpdatedByAiAt = new Date();
    enrichment.profileCompleteness = this.computeCompleteness(enrichment);
    await this.enrichmentRepo.save(enrichment);
  }

  async createProfileLearningEvent(input: {
    sessionId: string;
    chatId: string;
    fieldName: string;
    oldValue?: string | null;
    newValue?: string | null;
    confidenceScore?: number;
    source?: string;
    status?: ProfileLearningEventStatus | string;
    messageId?: string;
    conversationId?: string;
  }): Promise<CustomerProfileLearningEvent> {
    return this.eventRepo.save(
      this.eventRepo.create({
        sessionId: input.sessionId,
        chatId: input.chatId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        fieldName: input.fieldName,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        confidenceScore: input.confidenceScore ?? null,
        source: input.source ?? null,
        status: input.status ?? ProfileLearningEventStatus.AUTO_SAVED,
        createdByAi: true,
      }),
    );
  }

  async createLostDemandFollowup(input: {
    sessionId: string;
    chatId: string;
    wantedProduct: string;
    wantedVariant?: string | null;
    reason?: LostDemandReason | string;
    alternativeOffered?: boolean;
    alternativeAccepted?: boolean | null;
    branchId?: string | null;
  }): Promise<LostDemandFollowup> {
    const crm = await this.inboxCrmService.getThreadCrm(input.sessionId, input.chatId);
    const enrichment = await this.getOrCreate(input.sessionId, input.chatId);
    return this.lostDemandRepo.save(
      this.lostDemandRepo.create({
        sessionId: input.sessionId,
        chatId: input.chatId,
        wantedProduct: input.wantedProduct,
        wantedVariant: input.wantedVariant ?? null,
        reason: input.reason ?? LostDemandReason.PRODUCT_UNAVAILABLE,
        alternativeOffered: input.alternativeOffered ?? false,
        alternativeAccepted: input.alternativeAccepted ?? null,
        notifyWhenAvailable: enrichment.notifyWhenAvailable,
        customerNameAtTime: enrichment.preferredName ?? crm?.customerName ?? null,
        customerPhone: crm?.customerPhone ?? null,
        branchId: input.branchId ?? null,
        status: LostDemandStatus.OPEN,
      }),
    );
  }

  async getCustomerProfileForAi(sessionId: string, chatId: string) {
    const enrichment = await this.getOrCreate(sessionId, chatId);
    const crm = await this.inboxCrmService.getThreadCrm(sessionId, chatId);
    return { enrichment, crm };
  }

  computeCompleteness(enrichment: CustomerProfileEnrichment): number {
    let score = 0;
    if (enrichment.preferredName) score += 25;
    if (enrichment.deliveryPreference) score += 15;
    if (enrichment.budgetRange) score += 15;
    if (enrichment.customerUseCase) score += 15;
    if (enrichment.paymentPreference) score += 10;
    if (enrichment.wantedProduct) score += 10;
    if (enrichment.notifyWhenAvailable) score += 10;
    return Math.min(100, score);
  }

  async getProfileCompleteness(sessionId: string, chatId: string): Promise<number> {
    const row = await this.getOrCreate(sessionId, chatId);
    return row.profileCompleteness ?? this.computeCompleteness(row);
  }

  async recordQuestionAsked(sessionId: string, chatId: string, kind: ProfileQuestionKind): Promise<void> {
    const row = await this.getOrCreate(sessionId, chatId);
    row.lastProfileQuestionAsked = kind;
    row.lastProfileQuestionAskedAt = new Date();
    await this.enrichmentRepo.save(row);
  }

  async getEnrichmentByThread(sessionId: string, chatId: string) {
    const enrichment = await this.getOrCreate(sessionId, chatId);
    const crm = await this.inboxCrmService.getThreadCrm(sessionId, chatId);
    return { ...enrichment, crm };
  }

  async listLearningEvents(sessionId: string, chatId: string, limit = 50) {
    return this.eventRepo.find({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async approveEvent(eventId: string, reviewedBy?: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.fieldName === 'preferredName' && event.newValue) {
      const config = await this.aiSettings.getActiveConfig();
      if (config) {
        await this.saveDetectedName(
          event.sessionId,
          event.chatId,
          event.newValue,
          event.confidenceScore ?? 0.9,
          event.messageId ?? undefined,
          config,
          'review_approved',
        );
      }
    }
    event.status = ProfileLearningEventStatus.AUTO_SAVED;
    event.reviewedBy = reviewedBy ?? null;
    event.reviewedAt = new Date();
    return this.eventRepo.save(event);
  }

  async rejectEvent(eventId: string, reviewedBy?: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    event.status = ProfileLearningEventStatus.REJECTED;
    event.reviewedBy = reviewedBy ?? null;
    event.reviewedAt = new Date();
    const enrichment = await this.getOrCreate(event.sessionId, event.chatId);
    if (event.fieldName === 'preferredName') {
      enrichment.nameNeedsReview = false;
      await this.enrichmentRepo.save(enrichment);
    }
    return this.eventRepo.save(event);
  }

  async updateEnrichment(id: string, patch: Partial<CustomerProfileEnrichment>) {
    const row = await this.enrichmentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Profile enrichment not found');
    Object.assign(row, patch);
    row.profileCompleteness = this.computeCompleteness(row);
    return this.enrichmentRepo.save(row);
  }

  async listLostDemand(status?: string) {
    return this.lostDemandRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getLostDemand(id: string) {
    const row = await this.lostDemandRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Lost demand follow-up not found');
    return row;
  }

  async updateLostDemand(id: string, patch: Partial<LostDemandFollowup>) {
    const row = await this.getLostDemand(id);
    Object.assign(row, patch);
    return this.lostDemandRepo.save(row);
  }

  async getDashboardCounts() {
    const nameReview = await this.enrichmentRepo.count({ where: { nameNeedsReview: true } });
    const learningReview = await this.eventRepo.count({
      where: { status: ProfileLearningEventStatus.NEEDS_REVIEW },
    });
    const lostWaiting = await this.lostDemandRepo.count({
      where: { status: LostDemandStatus.OPEN, notifyWhenAvailable: true },
    });
    return { nameReview, learningReview, lostWaiting, openLostDemand: await this.lostDemandRepo.count({ where: { status: LostDemandStatus.OPEN } }) };
  }

  markQuestionAskedFromReply(sessionId: string, chatId: string, replyText: string): void {
    void this.recordQuestionFromReplyText(sessionId, chatId, replyText);
  }

  private async recordQuestionFromReplyText(sessionId: string, chatId: string, replyText: string) {
    if (/jina\s+gani|nikutambue/i.test(replyText)) {
      await this.recordQuestionAsked(sessionId, chatId, ProfileQuestionKind.NAME);
    } else if (/delivery|dukan/i.test(replyText)) {
      await this.recordQuestionAsked(sessionId, chatId, ProfileQuestionKind.DELIVERY);
    }
  }
}
