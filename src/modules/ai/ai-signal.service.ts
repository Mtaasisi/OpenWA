import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { InboxThreadSummary } from '../message/entities/inbox-thread-summary.entity';
import { Session } from '../session/entities/session.entity';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import type {
  AiEscalationDashboardRow,
  StockingReminderDashboardRow,
  ThreadDisplayFields,
} from './dto/ai-escalation-dashboard.dto';
import { AiReplyEvent } from './entities/ai-reply-event.entity';
import { AiEscalation } from './entities/ai-escalation.entity';
import { StockingReminder } from './entities/stocking-reminder.entity';
import {
  AiCustomerIntent,
  AiEscalationReason,
  AiEscalationStatus,
  AiSignalType,
  StockingReminderReason,
  StockingReminderStatus,
} from './ai-signal.enums';
import {
  detectCityFromText,
  detectCustomerIntent,
  intentToSignal,
} from './utils/ai-intent-detector.util';
import { hasExplicitProductPurchaseIntent } from './utils/customer-product-intent.util';
import {
  BRANCH_CITY_ASK_REPLY,
  CONTEXT_CLARIFICATION_REPLY,
  buildCompatibilityAckReply,
  buildOosAlternativesReply,
  buildSoftCityLocationReply,
  isCompatibilityModelAnswer,
  isCompatibilityQuestion,
  isShortContextMessage,
  isTopicChangeMessage,
  mapCityToBranchId,
  parseAiNotes,
  pickFirstDiscountDefenseReply,
  serializeAiNotes,
} from './utils/ai-behavior.util';
import {
  isPaymentProofMessage,
  PAYMENT_PROOF_ACK_REPLY,
} from './utils/payment-proof.util';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { FollowupQueueService } from '../followup/followup-queue.service';
import { ConversationPriority, ConversationStage, FollowUpStatus } from '../followup/followup.enums';
import { AiProfileService } from './ai-profile.service';
import { ProductsService } from '../products/products.service';
import { ProductDemandService } from './product-demand.service';
import { AiLearningInboxService } from './ai-learning-inbox.service';
import { inferStorageChatType } from '../../common/utils/conversation-type.util';
import { resolveCustomerName, resolveCustomerPhone } from '../../common/utils/inbox-display.util';

function isGroupChatId(chatId: string): boolean {
  return inferStorageChatType(chatId) === 'group';
}

export interface IncomingSignalResult {
  intent: AiCustomerIntent;
  signalType: AiSignalType | null;
  skipAgent: boolean;
  escalate: boolean;
  escalationReason?: AiEscalationReason;
  branchId?: string | null;
  deterministicReply?: string | null;
  injectPromptBlock?: string | null;
}

export interface ProcessIncomingOptions {
  lastAssistantMessage?: string | null;
  /** When true, skip hardcoded discount/complaint escalations. */
  unrestricted?: boolean;
  /** Image/document payment proof messages. */
  hasMedia?: boolean;
}

export interface GroupLeadRow {
  id: string;
  detectedIntent: AiCustomerIntent;
  incomingText: string;
  signalType: AiSignalType | null;
  createdAt: Date;
}

export interface GroupLeadsView {
  leads: GroupLeadRow[];
  escalation: {
    id: string;
    status: AiEscalationStatus;
    detail: string | null;
    createdAt: Date;
  } | null;
}

const GROUP_LEAD_INTENTS = new Set<AiCustomerIntent>([
  AiCustomerIntent.PRODUCT_SEARCH,
  AiCustomerIntent.STOCK_REQUEST,
  AiCustomerIntent.PRICE_REQUEST,
  AiCustomerIntent.VARIANT_REQUEST,
  AiCustomerIntent.DISCOUNT_REQUEST,
  AiCustomerIntent.INSTALLMENT_REQUEST,
  AiCustomerIntent.PAYMENT_REQUEST,
  AiCustomerIntent.LOCATION_REQUEST,
  AiCustomerIntent.QUOTE_REQUEST,
]);

@Injectable()
export class AiSignalService {
  constructor(
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    @InjectRepository(AiReplyEvent, 'data')
    private readonly eventRepo: Repository<AiReplyEvent>,
    @InjectRepository(AiEscalation, 'data')
    private readonly escalationRepo: Repository<AiEscalation>,
    @InjectRepository(StockingReminder, 'data')
    private readonly stockingRepo: Repository<StockingReminder>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(FollowupConversation, 'data')
    private readonly followupConvRepo: Repository<FollowupConversation>,
    @InjectRepository(InboxThreadSummary, 'data')
    private readonly threadSummaryRepo: Repository<InboxThreadSummary>,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversation: FollowupConversationService,
    @Inject(forwardRef(() => FollowupQueueService))
    private readonly followupQueue: FollowupQueueService,
    private readonly profileService: AiProfileService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ProductDemandService))
    private readonly productDemand: ProductDemandService,
    @Inject(forwardRef(() => AiLearningInboxService))
    private readonly learningInbox: AiLearningInboxService,
  ) {}

  async processIncoming(
    sessionId: string,
    chatId: string,
    incomingText: string,
    branchId?: string | null,
    options?: ProcessIncomingOptions,
  ): Promise<IncomingSignalResult> {
    const row = await this.getOrCreateCrm(sessionId, chatId);
    let injectPromptBlock: string | null = null;
    let deterministicReply: string | null = null;

    if (isTopicChangeMessage(incomingText)) {
      row.lastProductInterest = null;
      row.lastIntent = null;
      const notes = parseAiNotes(row.aiNotes);
      delete notes.compatibilityAnswer;
      delete notes.compatibilityMode;
      row.aiNotes = Object.keys(notes).length ? serializeAiNotes(notes) : null;
    }

    const intent = detectCustomerIntent(incomingText);
    let signalType = intentToSignal(intent);

    if (
      hasExplicitProductPurchaseIntent(incomingText) &&
      incomingText.trim().length > 4 &&
      !isShortContextMessage(incomingText)
    ) {
      row.lastProductInterest = incomingText.trim().slice(0, 200);
    }

    if (
      options?.lastAssistantMessage &&
      isCompatibilityQuestion(options.lastAssistantMessage) &&
      isCompatibilityModelAnswer(incomingText)
    ) {
      const notes = parseAiNotes(row.aiNotes);
      notes.compatibilityAnswer = incomingText.trim();
      notes.compatibilityMode = true;
      row.aiNotes = serializeAiNotes(notes);
      deterministicReply = buildCompatibilityAckReply(incomingText, row.lastProductInterest);
    }

    const productLookupIntents = new Set([
      AiCustomerIntent.PRODUCT_SEARCH,
      AiCustomerIntent.STOCK_REQUEST,
      AiCustomerIntent.PRICE_REQUEST,
    ]);

    row.lastIntent = intent;
    if (signalType === AiSignalType.INSTALLMENT_REQUEST) row.installmentInterest = true;
    if (signalType === AiSignalType.PAYMENT_CONFIRMATION) row.paymentReadiness = 'ready';

    const profiles = await this.profileService.listProfiles();
    const city = detectCityFromText(incomingText);
    if (city) {
      row.inferredCity = city;
      row.confirmedCity = city;
      row.locationConfidence = 0.9;
      row.lastLocationConfirmedAt = new Date();
      const mapped = mapCityToBranchId(city, profiles);
      if (mapped) row.preferredBranchId = mapped;
    }

    const resolvedBranch = branchId ?? row.preferredBranchId ?? null;

    if (
      !deterministicReply &&
      productLookupIntents.has(intent) &&
      !options?.unrestricted
    ) {
      const productQuery =
        row.lastProductInterest?.trim() ||
        (hasExplicitProductPurchaseIntent(incomingText) ? incomingText.trim() : '');
      if (productQuery.length > 2) {
        const products = await this.productsService.searchForAgent({
          q: productQuery,
          limit: 4,
          inStockOnly: true,
          branchId: resolvedBranch,
        });
        const unavailable = products.find(p => p.id === 'exact-match-unavailable');
        if (unavailable?.relatedAlternatives?.length) {
          deterministicReply = buildOosAlternativesReply(
            productQuery,
            unavailable.relatedAlternatives,
          );
        }
      }
    }

    if (isShortContextMessage(incomingText) && !row.lastProductInterest?.trim()) {
      deterministicReply = CONTEXT_CLARIFICATION_REPLY;
    } else if (
      isShortContextMessage(incomingText) &&
      row.lastProductInterest?.trim()
    ) {
      injectPromptBlock = `Customer short message "${incomingText}" refers to previous product interest: "${row.lastProductInterest}". Answer about that product.`;
    }

    if (
      !deterministicReply &&
      (intent === AiCustomerIntent.LOCATION_REQUEST ||
        intent === AiCustomerIntent.PAYMENT_REQUEST) &&
      !resolvedBranch &&
      !row.confirmedCity &&
      profiles.length > 1
    ) {
      deterministicReply = BRANCH_CITY_ASK_REPLY;
    }

    if (
      !deterministicReply &&
      intent === AiCustomerIntent.LOCATION_REQUEST &&
      resolvedBranch
    ) {
      const profile = await this.profileService.getProfile(resolvedBranch);
      if (profile) {
        const locationBlock = this.profileService.formatLocationBlock(profile);
        if (row.confirmedCity) {
          deterministicReply = buildSoftCityLocationReply(row.confirmedCity, locationBlock);
        } else {
          injectPromptBlock = `Use this branch location (do not hardcode):\n${locationBlock}`;
        }
      }
    }

    if (
      !deterministicReply &&
      intent === AiCustomerIntent.PAYMENT_REQUEST &&
      resolvedBranch
    ) {
      const account = await this.profileService.getDefaultPaymentAccount(resolvedBranch);
      if (account) {
        injectPromptBlock = `Send these payment details from settings:\n${this.profileService.formatPaymentBlock(account)}`;
      }
    }

    if (intent === AiCustomerIntent.INSTALLMENT_REQUEST) {
      const query = row.lastProductInterest?.trim() || incomingText.trim();
      if (query.length > 2) {
        const products = await this.productsService.searchForAgent({
          q: query,
          limit: 3,
          inStockOnly: false,
          branchId: resolvedBranch,
        });
        const target = products[0];
        if (
          target?.installmentEnabled &&
          target.installmentRequiresApproval &&
          !options?.unrestricted
        ) {
          await this.createEscalation({
            sessionId,
            chatId,
            reason: AiEscalationReason.INSTALLMENT_APPROVAL,
            detail: incomingText,
            branchId: resolvedBranch,
          });
          await this.createAiFollowupTask(
            sessionId,
            chatId,
            'installment_approval',
            resolvedBranch,
            incomingText,
          );
          injectPromptBlock =
            'Product installment requires admin approval. Explain terms only after approval — offer to check with team.';
        }
        if (
          target?.installmentEnabled &&
          !target.inStock &&
          target.allowInstallmentWhenOutOfStock
        ) {
          signalType = AiSignalType.OUT_OF_STOCK_INSTALLMENT;
          await this.createStockingReminder({
            productId: target.id,
            productName: target.name,
            sessionId,
            chatId,
            branchId: resolvedBranch,
            reason: StockingReminderReason.INSTALLMENT_OUT_OF_STOCK,
            note: 'Installment interest while product out of stock',
          });
          injectPromptBlock =
            'Product supports installment but is temporarily out of stock internally. Do NOT tell customer it is out of stock. Explain installment terms from product policy only.';
          await this.createAiFollowupTask(sessionId, chatId, 'out_of_stock_installment', resolvedBranch, incomingText);
        }
      }
    }

    if (
      row.installmentInterest &&
      /\b(karibia\s+kumaliza|last\s+payment|malipo\s+ya\s+mwisho|nimekaribia\s+kumaliza)\b/i.test(
        incomingText,
      )
    ) {
      const productName = row.lastProductInterest?.trim() || 'installment product';
      await this.createStockingReminder({
        productName,
        sessionId,
        chatId,
        branchId: resolvedBranch,
        reason: StockingReminderReason.INSTALLMENT_NEAR_COMPLETION,
        note: 'Customer near completing installment — prepare stock',
      });
      await this.createAiFollowupTask(
        sessionId,
        chatId,
        'installment_near_completion',
        resolvedBranch,
        incomingText,
      );
    }

    let paymentProofHandled = false;
    if (isPaymentProofMessage(incomingText, options?.hasMedia)) {
      paymentProofHandled = true;
      row.paymentReadiness = 'pending_confirmation';
      if (!deterministicReply) {
        deterministicReply = PAYMENT_PROOF_ACK_REPLY;
      }
      await this.createAiFollowupTask(
        sessionId,
        chatId,
        'payment_confirmation',
        resolvedBranch,
        incomingText,
      );
    }

    let skipAgent = !!deterministicReply;
    let escalate = false;
    let escalationReason: AiEscalationReason | undefined;

    if (intent === AiCustomerIntent.DISCOUNT_REQUEST) {
      row.discountRequestCount = (row.discountRequestCount ?? 0) + 1;
      const effectiveDiscountCount =
        row.discountNegotiationMarked
          ? Math.max(row.discountRequestCount, 2)
          : row.discountRequestCount;
      if (!options?.unrestricted && row.discountRequestCount === 1) {
        deterministicReply = pickFirstDiscountDefenseReply(chatId);
        skipAgent = true;
      }
      if (!options?.unrestricted && effectiveDiscountCount >= 2) {
        row.aiAutoReplyPaused = true;
        row.autopilotPauseReason = 'repeated_discount';
        row.aiHandlingState = InboxAiHandlingState.WAITING_HUMAN;
        row.aiEscalatedAt = new Date();
        skipAgent = true;
        escalate = true;
        escalationReason = AiEscalationReason.REPEATED_DISCOUNT;
        await this.createEscalation({
          sessionId,
          chatId,
          reason: AiEscalationReason.REPEATED_DISCOUNT,
          detail: incomingText,
          branchId: resolvedBranch,
        });
        await this.createAiFollowupTask(sessionId, chatId, 'discount_request', resolvedBranch, incomingText);
      }
    }

    if (intent === AiCustomerIntent.COMPLAINT && !options?.unrestricted) {
      row.aiAutoReplyPaused = true;
      row.autopilotPauseReason = 'complaint';
      skipAgent = true;
      escalate = true;
      escalationReason = AiEscalationReason.COMPLAINT;
      await this.createEscalation({
        sessionId,
        chatId,
        reason: AiEscalationReason.COMPLAINT,
        detail: incomingText,
        branchId: resolvedBranch,
      });
      await this.createAiFollowupTask(sessionId, chatId, 'ai_escalated', resolvedBranch, incomingText);
    }

    await this.crmRepo.save(row);
    await this.syncFollowupPipeline(sessionId, chatId, intent, row.discountRequestCount ?? 0);

    if (signalType) {
      await this.eventRepo.save(
        this.eventRepo.create({
          sessionId,
          chatId,
          signalType,
          detectedIntent: intent,
          incomingText,
          escalated: escalate,
          branchId: resolvedBranch,
        }),
      );
    }

    if (
      signalType === AiSignalType.PAYMENT_CONFIRMATION &&
      !escalate &&
      !paymentProofHandled
    ) {
      await this.createAiFollowupTask(sessionId, chatId, 'payment_confirmation', resolvedBranch, incomingText);
    }

    void this.productDemand
      .recordFromMessage({
        sessionId,
        chatId,
        branchId: resolvedBranch,
        rawMessage: incomingText,
      })
      .catch(() => undefined);

    void this.learningInbox
      .processOutcomeOnIncoming(sessionId, chatId, incomingText)
      .catch(() => undefined);

    return {
      intent,
      signalType,
      skipAgent,
      escalate,
      escalationReason,
      branchId: resolvedBranch,
      deterministicReply,
      injectPromptBlock,
    };
  }

  async listGroupLeads(sessionId: string, chatId: string): Promise<GroupLeadsView> {
    const events = await this.eventRepo.find({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const leads: GroupLeadRow[] = events
      .filter(
        (e) =>
          e.detectedIntent != null &&
          GROUP_LEAD_INTENTS.has(e.detectedIntent as AiCustomerIntent),
      )
      .map((e) => ({
        id: e.id,
        detectedIntent: e.detectedIntent as AiCustomerIntent,
        incomingText: e.incomingText ?? '',
        signalType: e.signalType,
        createdAt: e.createdAt,
      }));

    const escalation = await this.escalationRepo.findOne({
      where: {
        sessionId,
        chatId,
        reason: AiEscalationReason.GROUP_LEAD,
        status: AiEscalationStatus.OPEN,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      leads,
      escalation: escalation
        ? {
            id: escalation.id,
            status: escalation.status,
            detail: escalation.detail,
            createdAt: escalation.createdAt,
          }
        : null,
    };
  }

  /** Group chats: detect buying intent and create lead — no auto-reply. */
  async processGroupLead(
    sessionId: string,
    chatId: string,
    incomingText: string,
  ): Promise<boolean> {
    const intent = detectCustomerIntent(incomingText);
    if (!GROUP_LEAD_INTENTS.has(intent)) return false;

    const signalType = intentToSignal(intent);
    await this.syncFollowupPipeline(sessionId, chatId, intent, 0);

    const row = await this.getOrCreateCrm(sessionId, chatId);
    row.lastIntent = intent;
    await this.crmRepo.save(row);

    await this.createEscalation({
      sessionId,
      chatId,
      reason: AiEscalationReason.GROUP_LEAD,
      detail: incomingText,
      branchId: row.preferredBranchId ?? null,
    });

    // Group leads are tracked via follow-up pipeline and group_lead escalations.

    if (signalType) {
      await this.eventRepo.save(
        this.eventRepo.create({
          sessionId,
          chatId,
          signalType,
          detectedIntent: intent,
          incomingText,
          escalated: false,
        }),
      );
    }
    return true;
  }

  async recordReply(input: {
    sessionId: string;
    chatId: string;
    incomingText: string;
    replyText: string;
    escalated: boolean;
    branchId?: string | null;
    productId?: string | null;
    signalType?: AiSignalType | null;
    detectedIntent?: AiCustomerIntent | null;
  }): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({
        sessionId: input.sessionId,
        chatId: input.chatId,
        signalType: input.signalType ?? null,
        detectedIntent: input.detectedIntent ?? null,
        incomingText: input.incomingText,
        replyText: input.replyText,
        escalated: input.escalated,
        branchId: input.branchId ?? null,
        productId: input.productId ?? null,
      }),
    );
  }

  async createEscalation(input: {
    sessionId: string;
    chatId: string;
    reason: AiEscalationReason;
    detail?: string;
    branchId?: string | null;
  }): Promise<AiEscalation | null> {
    if (
      isGroupChatId(input.chatId) &&
      input.reason !== AiEscalationReason.GROUP_LEAD
    ) {
      return null;
    }

    const existing = await this.escalationRepo.findOne({
      where: {
        sessionId: input.sessionId,
        chatId: input.chatId,
        status: AiEscalationStatus.OPEN,
      },
    });
    if (existing) return existing;

    const conversation = await this.followupConversation.findByThread(
      input.sessionId,
      input.chatId,
    );

    return this.escalationRepo.save(
      this.escalationRepo.create({
        sessionId: input.sessionId,
        chatId: input.chatId,
        reason: input.reason,
        detail: input.detail ?? null,
        branchId: input.branchId ?? null,
        assignedStaffId: conversation?.assignedStaffId ?? null,
        status: AiEscalationStatus.OPEN,
      }),
    );
  }

  async resolveOpenEscalations(sessionId: string, chatId: string): Promise<void> {
    await this.escalationRepo.update(
      { sessionId, chatId, status: AiEscalationStatus.OPEN },
      { status: AiEscalationStatus.RESOLVED, resolvedAt: new Date() },
    );
  }

  /** Close legacy open escalations on group chats (keep active group_lead records). */
  async resolveOpenGroupEscalations(): Promise<{ resolved: number }> {
    const result = await this.escalationRepo
      .createQueryBuilder()
      .update(AiEscalation)
      .set({ status: AiEscalationStatus.RESOLVED, resolvedAt: new Date() })
      .where('status = :status', { status: AiEscalationStatus.OPEN })
      .andWhere("chatId LIKE :suffix", { suffix: '%@g.us' })
      .andWhere('reason != :groupLead', { groupLead: AiEscalationReason.GROUP_LEAD })
      .execute();
    return { resolved: result.affected ?? 0 };
  }

  private openDirectEscalationsQb() {
    return this.escalationRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: AiEscalationStatus.OPEN })
      .andWhere("e.chatId NOT LIKE :groupSuffix", { groupSuffix: '%@g.us' });
  }

  /** Copy thread assignee onto open escalations that predate assignedStaffId wiring. */
  async backfillOpenEscalationAssignees(): Promise<{ updated: number }> {
    const open = await this.escalationRepo.find({
      where: { status: AiEscalationStatus.OPEN },
    });
    let updated = 0;
    for (const row of open) {
      if (row.assignedStaffId) continue;
      const conversation = await this.followupConversation.findByThread(
        row.sessionId,
        row.chatId,
      );
      if (!conversation?.assignedStaffId) continue;
      row.assignedStaffId = conversation.assignedStaffId;
      await this.escalationRepo.save(row);
      updated++;
    }
    return { updated };
  }

  async createStockingReminder(input: {
    productId?: string;
    variantId?: string;
    productName?: string;
    sessionId?: string;
    chatId?: string;
    branchId?: string | null;
    note?: string;
    reason?: StockingReminderReason;
  }): Promise<StockingReminder> {
    return this.stockingRepo.save(
      this.stockingRepo.create({
        productId: input.productId ?? null,
        variantId: input.variantId ?? null,
        productName: input.productName ?? null,
        sessionId: input.sessionId ?? null,
        chatId: input.chatId ?? null,
        branchId: input.branchId ?? null,
        note: input.note ?? null,
        reason: input.reason ?? null,
        status: StockingReminderStatus.OPEN,
      }),
    );
  }

  async getDashboardSignals(sinceHours = 48): Promise<{
    discountRequests: number;
    installmentRequests: number;
    paymentConfirmations: number;
    openEscalations: number;
    stockingReminders: number;
    recentEscalations: AiEscalationDashboardRow[];
    openStockingReminders: StockingReminderDashboardRow[];
  }> {
    await this.resolveOpenGroupEscalations();

    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const [
      discountRequests,
      installmentRequests,
      paymentConfirmations,
      openEscalations,
      stockingReminders,
      recentEscalations,
      openStockingReminders,
    ] = await Promise.all([
      this.eventRepo.count({
        where: { signalType: AiSignalType.DISCOUNT_REQUEST, createdAt: MoreThan(since) },
      }),
      this.eventRepo.count({
        where: { signalType: AiSignalType.INSTALLMENT_REQUEST, createdAt: MoreThan(since) },
      }),
      this.eventRepo.count({
        where: { signalType: AiSignalType.PAYMENT_CONFIRMATION, createdAt: MoreThan(since) },
      }),
      this.openDirectEscalationsQb().getCount(),
      this.stockingRepo.count({ where: { status: StockingReminderStatus.OPEN } }),
      this.openDirectEscalationsQb().orderBy('e.createdAt', 'DESC').take(10).getMany(),
      this.stockingRepo.find({
        where: { status: StockingReminderStatus.OPEN },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);
    return {
      discountRequests,
      installmentRequests,
      paymentConfirmations,
      openEscalations,
      stockingReminders,
      recentEscalations: await this.enrichEscalationsForDashboard(recentEscalations),
      openStockingReminders: await this.enrichStockingRemindersForDashboard(openStockingReminders),
    };
  }

  private threadKey(sessionId: string, chatId: string): string {
    return `${sessionId}:${chatId}`;
  }

  private async loadThreadDisplayContext(
    threads: Array<{ sessionId: string; chatId: string }>,
  ): Promise<{
    sessionNameById: Map<string, string>;
    convByThread: Map<string, FollowupConversation>;
    summaryByThread: Map<string, InboxThreadSummary>;
  }> {
    if (threads.length === 0) {
      return {
        sessionNameById: new Map(),
        convByThread: new Map(),
        summaryByThread: new Map(),
      };
    }

    const sessionIds = [...new Set(threads.map(t => t.sessionId))];
    const [sessions, conversations, summaries] = await Promise.all([
      this.sessionRepo.find({ where: { id: In(sessionIds) }, select: ['id', 'name'] }),
      this.followupConvRepo.find({
        where: threads,
        select: ['sessionId', 'chatId', 'customerName', 'customerPhone', 'customerHandle'],
      }),
      this.threadSummaryRepo.find({
        where: threads,
        select: ['sessionId', 'chatId', 'displayName'],
      }),
    ]);

    return {
      sessionNameById: new Map(sessions.map(s => [s.id, s.name])),
      convByThread: new Map(conversations.map(c => [this.threadKey(c.sessionId, c.chatId), c])),
      summaryByThread: new Map(summaries.map(s => [this.threadKey(s.sessionId, s.chatId), s])),
    };
  }

  private resolveThreadDisplayFields(
    sessionId: string,
    chatId: string,
    ctx: Awaited<ReturnType<AiSignalService['loadThreadDisplayContext']>>,
  ): ThreadDisplayFields {
    const conv = ctx.convByThread.get(this.threadKey(sessionId, chatId));
    const summary = ctx.summaryByThread.get(this.threadKey(sessionId, chatId));
    return {
      customerName: resolveCustomerName(chatId, conv?.customerName),
      customerPhone: resolveCustomerPhone(chatId, conv?.customerPhone),
      displayName: summary?.displayName?.trim() || conv?.customerHandle?.trim() || null,
      sessionName: ctx.sessionNameById.get(sessionId) ?? null,
    };
  }

  private async enrichEscalationsForDashboard(
    escalations: AiEscalation[],
  ): Promise<AiEscalationDashboardRow[]> {
    if (escalations.length === 0) return [];

    const ctx = await this.loadThreadDisplayContext(
      escalations.map(e => ({ sessionId: e.sessionId, chatId: e.chatId })),
    );

    return escalations.map(esc => ({
      id: esc.id,
      sessionId: esc.sessionId,
      chatId: esc.chatId,
      reason: esc.reason,
      detail: esc.detail,
      status: esc.status,
      assignedStaffId: esc.assignedStaffId,
      createdAt: esc.createdAt,
      ...this.resolveThreadDisplayFields(esc.sessionId, esc.chatId, ctx),
    }));
  }

  private async enrichStockingRemindersForDashboard(
    reminders: StockingReminder[],
  ): Promise<StockingReminderDashboardRow[]> {
    if (reminders.length === 0) return [];

    const threads = reminders
      .filter(r => r.sessionId && r.chatId)
      .map(r => ({ sessionId: r.sessionId!, chatId: r.chatId! }));
    const ctx = await this.loadThreadDisplayContext(threads);

    return reminders.map(reminder => {
      const threadFields =
        reminder.sessionId && reminder.chatId
          ? this.resolveThreadDisplayFields(reminder.sessionId, reminder.chatId, ctx)
          : {
              customerName: null,
              customerPhone: null,
              displayName: null,
              sessionName: reminder.sessionId
                ? (ctx.sessionNameById.get(reminder.sessionId) ?? null)
                : null,
            };

      return {
        id: reminder.id,
        productId: reminder.productId,
        variantId: reminder.variantId,
        productName: reminder.productName,
        sessionId: reminder.sessionId,
        chatId: reminder.chatId,
        branchId: reminder.branchId,
        note: reminder.note,
        reason: reminder.reason,
        status: reminder.status,
        assignedStaffId: reminder.assignedStaffId,
        createdAt: reminder.createdAt,
        ...threadFields,
      };
    });
  }

  private async createAiFollowupTask(
    sessionId: string,
    chatId: string,
    reason: string,
    branchId: string | null | undefined,
    originalMessage: string,
  ): Promise<void> {
    try {
      const conv = await this.followupConversation.getOrCreate(sessionId, chatId);
      await this.followupQueue.createAutopilotQueueItem({
        conversationId: conv.id,
        branchId: branchId ?? conv.branchId ?? null,
        dueAt: new Date(),
        status: FollowUpStatus.PENDING,
        detectedReason: reason,
        recommendedAction: `AI follow-up: ${reason.replace(/_/g, ' ')}`,
        originalCustomerMessage: originalMessage.slice(0, 500),
        stopReason: reason,
      });
    } catch {
      /* best-effort */
    }
  }

  private async syncFollowupPipeline(
    sessionId: string,
    chatId: string,
    intent: AiCustomerIntent,
    discountCount: number,
  ): Promise<void> {
    try {
      const conv = await this.followupConversation.getOrCreate(sessionId, chatId);
      const patch: {
        stage?: ConversationStage;
        priority?: ConversationPriority;
        internalNote?: string;
      } = {};

      switch (intent) {
        case AiCustomerIntent.DISCOUNT_REQUEST:
          patch.stage = ConversationStage.NEGOTIATING;
          patch.priority =
            discountCount >= 2 ? ConversationPriority.HOT : ConversationPriority.HIGH;
          patch.internalNote = 'AI detected discount request';
          break;
        case AiCustomerIntent.INSTALLMENT_REQUEST:
          patch.stage = ConversationStage.NEGOTIATING;
          patch.priority = ConversationPriority.HOT;
          patch.internalNote = 'AI detected installment interest';
          break;
        case AiCustomerIntent.PAYMENT_REQUEST:
          patch.stage = ConversationStage.PAYMENT_PENDING;
          patch.priority = ConversationPriority.HOT;
          patch.internalNote = 'AI detected payment readiness';
          break;
        case AiCustomerIntent.PRODUCT_SEARCH:
        case AiCustomerIntent.STOCK_REQUEST:
        case AiCustomerIntent.PRICE_REQUEST:
          if (conv.stage === ConversationStage.NEW_LEAD) {
            patch.stage = ConversationStage.NEEDS_IDENTIFIED;
            patch.priority = ConversationPriority.NORMAL;
          }
          break;
        default:
          return;
      }

      if (patch.internalNote) {
        patch.internalNote = conv.internalNote
          ? `${conv.internalNote}\n${patch.internalNote}`
          : patch.internalNote;
      }
      await this.followupConversation.update(conv.id, patch);
    } catch {
      /* best-effort */
    }
  }

  private async getOrCreateCrm(sessionId: string, chatId: string): Promise<InboxThreadCrm> {
    let row = await this.crmRepo.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepo.create({ sessionId, chatId, resolved: false });
    }
    return row;
  }
}
