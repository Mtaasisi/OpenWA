import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import { UpdateInboxThreadCrmDto, InboxThreadCrmDto } from './dto/inbox-thread-crm.dto';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import { resolveCustomerName, resolveCustomerPhone, resolveThreadIdentity, sanitizeStoredPhone } from '../../common/utils/inbox-display.util';
import { SessionService } from '../session/session.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { ConversationStage } from '../followup/followup.enums';
import { InboxAiHandlingState } from '../ai/inbox-ai-handling.enum';
import { InboxResolveOutcome } from './dto/inbox-resolve-outcome.enum';
import { FollowupQueueService } from '../followup/followup-queue.service';
import { FollowupHookService } from '../followup/followup-hook.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AiSignalService } from '../ai/ai-signal.service';
import { ProductDemandService } from '../ai/product-demand.service';
import { InboxThreadEventService } from './inbox-thread-event.service';
import {
  AI_PAUSE_EXPLICIT,
  AI_PAUSE_MANUAL_TAKEOVER,
} from '../ai/ai-pause-reason.constants';
import { formatAiEscalationNote } from './utils/ai-escalation-note.util';

@Injectable()
export class InboxCrmService {
  constructor(
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepository: Repository<InboxThreadCrm>,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
    @Inject(forwardRef(() => FollowupQueueService))
    private readonly followupQueueService: FollowupQueueService,
    @Inject(forwardRef(() => FollowupHookService))
    private readonly followupHookService: FollowupHookService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => AiSignalService))
    private readonly aiSignalService: AiSignalService,
    private readonly threadEvents: InboxThreadEventService,
    @Inject(forwardRef(() => ProductDemandService))
    private readonly productDemandService: ProductDemandService,
  ) {}

  async getThreadCrm(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    await this.sessionService.findOne(sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    const dto = row ? this.toDto(row) : this.emptyDto(sessionId, chatId);
    const followup = await this.followupConversationService.findByThread(sessionId, chatId);
    const identity = resolveThreadIdentity({
      chatId,
      customerName: followup?.customerName,
      customerPhone: followup?.customerPhone,
      crmName: dto.customerName,
      crmPhone: dto.customerPhone,
    });
    return { ...dto, customerName: identity.customerName, customerPhone: identity.customerPhone };
  }

  async upsertThreadCrm(
    sessionId: string,
    chatId: string,
    dto: UpdateInboxThreadCrmDto,
    actorStaffId?: string,
  ): Promise<InboxThreadCrmDto> {
    const session = await this.sessionService.findOne(sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }

    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    const prevHandling = row?.aiHandlingState ?? InboxAiHandlingState.IDLE;
    const prevPaused = row?.aiAutoReplyPaused ?? false;
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }

    if (dto.resolved === true) {
      this.validateResolvePayload(dto);
    }

    if (dto.resolved !== undefined) {
      row.resolved = dto.resolved;
      row.resolvedAt = dto.resolved ? new Date() : null;
      if (!dto.resolved) {
        row.resolvedReason = null;
        row.resolvedNote = null;
        row.outcome = null;
        row.resolvedByStaffId = null;
      } else if (actorStaffId) {
        row.resolvedByStaffId = actorStaffId;
      }
    }
    if (dto.resolvedReason !== undefined) {
      row.resolvedReason = dto.resolvedReason;
    }
    if (dto.resolvedNote !== undefined) {
      row.resolvedNote = dto.resolvedNote;
    }
    if (dto.outcome !== undefined) {
      row.outcome = dto.outcome;
    }
    if (dto.internalNote !== undefined) {
      row.internalNote = dto.internalNote;
    }
    if (dto.followUpAt !== undefined) {
      row.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
      if (!dto.followUpAt) {
        row.followUpReason = null;
        row.followUpNote = null;
      }
    }
    if (dto.followUpReason !== undefined) {
      row.followUpReason = dto.followUpReason?.trim() || null;
    }
    if (dto.followUpNote !== undefined) {
      row.followUpNote = dto.followUpNote?.trim() || null;
    }
    if (dto.customerName !== undefined) {
      row.customerName = dto.customerName;
    }
    if (dto.customerPhone !== undefined) {
      const trimmed = dto.customerPhone?.trim() || null;
      row.customerPhone = trimmed ? sanitizeStoredPhone(chatId, trimmed) : null;
    }
    if (dto.linkedExternalId !== undefined) {
      row.linkedExternalId = dto.linkedExternalId;
    }
    if (dto.aiAutoReplyPaused !== undefined) {
      row.aiAutoReplyPaused = dto.aiAutoReplyPaused;
      if (dto.aiAutoReplyPaused && dto.autopilotPauseReason === undefined) {
        row.autopilotPauseReason = AI_PAUSE_EXPLICIT;
        row.manualTakeoverUntil = null;
      }
      if (!dto.aiAutoReplyPaused) {
        row.manualTakeoverUntil = null;
        if (row.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER) {
          row.autopilotPauseReason = null;
        }
      }
    }
    if (dto.aiOptOut !== undefined) {
      row.aiOptOut = dto.aiOptOut;
      if (dto.aiOptOut) row.aiAutoReplyPaused = true;
    }
    if (dto.clearAiMemory === true) {
      row.lastProductInterest = null;
      row.lastIntent = null;
      row.aiNotes = null;
      row.discountRequestCount = 0;
    }
    if (dto.preferredBranchId !== undefined) row.preferredBranchId = dto.preferredBranchId;
    if (dto.confirmedCity !== undefined) row.confirmedCity = dto.confirmedCity;
    if (dto.lastProductInterest !== undefined) row.lastProductInterest = dto.lastProductInterest;
    if (dto.lastIntent !== undefined) row.lastIntent = dto.lastIntent;
    if (dto.paymentReadiness !== undefined) row.paymentReadiness = dto.paymentReadiness;
    if (dto.aiNotes !== undefined) row.aiNotes = dto.aiNotes;
    if (dto.autopilotPauseReason !== undefined) row.autopilotPauseReason = dto.autopilotPauseReason;
    if (dto.manualTakeoverUntil !== undefined) {
      row.manualTakeoverUntil = dto.manualTakeoverUntil ? new Date(dto.manualTakeoverUntil) : null;
    }
    if (dto.installmentInterest !== undefined) row.installmentInterest = dto.installmentInterest;
    if (dto.buyingPreferences !== undefined) {
      row.buyingPreferences = dto.buyingPreferences?.trim() || null;
    }
    if (dto.discountNegotiationMarked !== undefined) {
      row.discountNegotiationMarked = dto.discountNegotiationMarked;
    }
    if (dto.aiHandlingState !== undefined) {
      row.aiHandlingState = dto.aiHandlingState;
      if (dto.aiHandlingState === InboxAiHandlingState.WAITING_HUMAN) {
        row.aiEscalatedAt = new Date();
        row.aiAutoReplyPaused = true;
      }
      if (dto.aiHandlingState === InboxAiHandlingState.HUMAN_HANDLING) {
        row.aiAutoReplyPaused = true;
      }
      if (dto.aiHandlingState === InboxAiHandlingState.IDLE) {
        row.aiEscalatedAt = null;
      }
    }

    const saved = await this.crmRepository.save(row);
    await this.syncFollowupConversation(sessionId, chatId, saved, dto, actorStaffId);
    if (dto.resolved === true) {
      void this.auditService.logInfo(AuditAction.INBOX_CHAT_RESOLVED, {
        sessionId,
        sessionName: session.name,
        metadata: {
          chatId,
          resolvedReason: saved.resolvedReason,
          outcome: saved.outcome,
          resolvedByStaffId: saved.resolvedByStaffId,
        },
      });
      await this.threadEvents.record({
        sessionId,
        chatId,
        eventType: 'chat_resolved',
        actorType: 'staff',
        actorId: actorStaffId ?? null,
        summary: `${saved.outcome ?? 'resolved'}: ${saved.resolvedReason ?? ''}`.trim(),
        metadata: {
          outcome: saved.outcome,
          lostReason: dto.lostReason ?? null,
        },
      });
      await this.handleResolveOutcomeSideEffects(sessionId, chatId, saved, dto, actorStaffId);
    } else if (dto.resolved === false) {
      await this.threadEvents.record({
        sessionId,
        chatId,
        eventType: 'chat_reopened',
        actorType: 'staff',
        actorId: actorStaffId ?? null,
        summary: 'Chat reopened',
      });
    }

    if (
      saved.aiHandlingState === InboxAiHandlingState.HUMAN_HANDLING &&
      prevHandling !== InboxAiHandlingState.HUMAN_HANDLING &&
      prevHandling !== InboxAiHandlingState.WAITING_HUMAN
    ) {
      void this.auditService.logInfo(AuditAction.INBOX_AI_TAKEOVER, {
        sessionId,
        sessionName: session.name,
        metadata: { chatId, actorStaffId: actorStaffId ?? null, fromState: prevHandling },
      });
    }

    if (
      saved.aiHandlingState === InboxAiHandlingState.IDLE &&
      !saved.aiAutoReplyPaused &&
      (prevHandling === InboxAiHandlingState.HUMAN_HANDLING || prevPaused) &&
      dto.aiHandlingState === InboxAiHandlingState.IDLE
    ) {
      void this.auditService.logInfo(AuditAction.INBOX_AI_RESUMED, {
        sessionId,
        sessionName: session.name,
        metadata: { chatId, actorStaffId: actorStaffId ?? null },
      });
    }

    return this.toDto(saved);
  }

  private validateResolvePayload(dto: UpdateInboxThreadCrmDto): void {
    if (!dto.resolvedReason?.trim()) {
      throw new BadRequestException('Resolution reason is required when resolving a chat');
    }
    if (!dto.outcome) {
      throw new BadRequestException('Outcome is required when resolving a chat');
    }
    if (dto.outcome === InboxResolveOutcome.LOST && !dto.lostReason) {
      throw new BadRequestException('Lost reason is required when outcome is lost');
    }
    if (
      (dto.outcome === InboxResolveOutcome.FOLLOW_UP_LATER ||
        dto.outcome === InboxResolveOutcome.WAITING_PAYMENT) &&
      !dto.followUpAt
    ) {
      throw new BadRequestException('Follow-up date is required for this outcome');
    }
  }

  private async syncFollowupConversation(
    sessionId: string,
    chatId: string,
    crm: InboxThreadCrm,
    dto?: UpdateInboxThreadCrmDto,
    actorStaffId?: string,
  ): Promise<void> {
    try {
      const conv = await this.followupConversationService.getOrCreate(sessionId, chatId);
      await this.followupConversationService.update(conv.id, {
        customerName: crm.customerName,
        customerPhone: crm.customerPhone,
        customerId: crm.linkedExternalId,
        internalNote: crm.internalNote,
      });

      if (dto?.followUpAt === null && !crm.followUpAt) {
        await this.followupQueueService.cancelPendingForConversation(conv.id, 'follow_up_cleared');
      }

      if (crm.resolved && dto?.outcome) {
        const stage = this.stageForOutcome(dto.outcome);
        await this.followupHookService.handleStageChange(sessionId, chatId, stage);
        await this.followupConversationService.update(conv.id, {
          outcome: dto.outcome,
          lostReason: dto.lostReason ?? null,
          nextFollowupAt:
            dto.followUpAt ??
            (crm.followUpAt ? crm.followUpAt.toISOString() : null),
        });

        if (
          dto.outcome === InboxResolveOutcome.FOLLOW_UP_LATER ||
          dto.outcome === InboxResolveOutcome.WAITING_PAYMENT ||
          dto.outcome === InboxResolveOutcome.WAITING_STOCK
        ) {
          let dueAt = dto.followUpAt ? new Date(dto.followUpAt) : crm.followUpAt;
          if (!dueAt && dto.outcome === InboxResolveOutcome.WAITING_STOCK) {
            dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          }
          if (dueAt) {
            const action =
              this.buildScheduledFollowUpAction(crm.followUpReason, crm.followUpNote) ||
              `Resolved as ${dto.outcome}`;
            await this.followupQueueService.createQueueItem({
              conversationId: conv.id,
              assignedStaffId: actorStaffId ?? conv.assignedStaffId,
              branchId: conv.branchId,
              dueAt,
              recommendedAction: action,
            });
          }
        }
      } else if (crm.followUpAt && crm.followUpAt > new Date()) {
        const action = this.buildScheduledFollowUpAction(crm.followUpReason, crm.followUpNote);
        await this.followupConversationService.update(conv.id, {
          followupRequired: true,
          nextFollowupAt: crm.followUpAt.toISOString(),
        });
        await this.followupHookService.handleStageChange(
          sessionId,
          chatId,
          ConversationStage.FOLLOWUP_NEEDED,
        );
        await this.followupQueueService.cancelPendingForConversation(conv.id, 'rescheduled_from_inbox');
        await this.followupQueueService.createQueueItem({
          conversationId: conv.id,
          assignedStaffId: actorStaffId ?? conv.assignedStaffId,
          branchId: conv.branchId,
          dueAt: crm.followUpAt,
          recommendedAction: action,
        });
      }
    } catch {
      // follow-up sync is best-effort
    }
  }

  private buildScheduledFollowUpAction(reason: string | null, note: string | null): string {
    const reasonPart = reason ? reason.replace(/_/g, ' ') : 'Follow-up';
    const trimmed = note?.trim();
    return trimmed ? `${reasonPart}: ${trimmed}` : reasonPart;
  }

  private async handleResolveOutcomeSideEffects(
    sessionId: string,
    chatId: string,
    crm: InboxThreadCrm,
    dto: UpdateInboxThreadCrmDto,
    _actorStaffId?: string,
  ): Promise<void> {
    if (!dto.outcome) return;

    if (dto.outcome === InboxResolveOutcome.WAITING_PAYMENT) {
      crm.paymentReadiness = 'waiting';
      await this.crmRepository.save(crm);
    }

    if (dto.outcome !== InboxResolveOutcome.WAITING_STOCK) return;

    try {
      const conv = await this.followupConversationService.getOrCreate(sessionId, chatId);
      const interest = crm.lastProductInterest?.trim() || conv.productInterest?.trim();
      if (!interest) return;
      await this.productDemandService.recordFromMessage({
        sessionId,
        chatId,
        conversationId: conv.id,
        customerId: crm.linkedExternalId,
        branchId: conv.branchId,
        rawMessage: `Inbox resolve waiting_stock: ${interest}`,
      });
    } catch {
      // product demand sync is best-effort
    }
  }

  private stageForOutcome(outcome: InboxResolveOutcome): ConversationStage {
    switch (outcome) {
      case InboxResolveOutcome.WON:
        return ConversationStage.WON;
      case InboxResolveOutcome.LOST:
      case InboxResolveOutcome.SPAM:
      case InboxResolveOutcome.NO_RESPONSE:
        return ConversationStage.LOST;
      case InboxResolveOutcome.WAITING_PAYMENT:
        return ConversationStage.PAYMENT_PENDING;
      case InboxResolveOutcome.WAITING_STOCK:
        return ConversationStage.PRODUCT_SUGGESTED;
      case InboxResolveOutcome.FOLLOW_UP_LATER:
      default:
        return ConversationStage.FOLLOWUP_NEEDED;
    }
  }

  async getPreferredBranchId(sessionId: string, chatId: string): Promise<string | null> {
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    return row?.preferredBranchId ?? null;
  }

  async isAiAutoReplyPaused(sessionId: string, chatId: string): Promise<boolean> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) return false;
    if (row.aiOptOut) return true;
    row = await this.maybeExpireManualTakeover(row);
    if (
      row.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER &&
      row.manualTakeoverUntil &&
      row.manualTakeoverUntil.getTime() > Date.now()
    ) {
      return true;
    }
    if (
      row.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER &&
      (!row.manualTakeoverUntil || row.manualTakeoverUntil.getTime() <= Date.now())
    ) {
      return false;
    }
    return row.aiAutoReplyPaused === true;
  }

  /** Remaining ms until temporary staff-reply takeover expires (0 if not active). */
  async getManualTakeoverRemainingMs(sessionId: string, chatId: string): Promise<number> {
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row || row.autopilotPauseReason !== AI_PAUSE_MANUAL_TAKEOVER || !row.manualTakeoverUntil) {
      return 0;
    }
    return Math.max(0, row.manualTakeoverUntil.getTime() - Date.now());
  }

  private async maybeExpireManualTakeover(row: InboxThreadCrm): Promise<InboxThreadCrm> {
    if (row.autopilotPauseReason !== AI_PAUSE_MANUAL_TAKEOVER) return row;
    if (!row.manualTakeoverUntil || row.manualTakeoverUntil.getTime() > Date.now()) return row;
    row.aiAutoReplyPaused = false;
    row.aiHandlingState = InboxAiHandlingState.IDLE;
    row.manualTakeoverUntil = null;
    row.autopilotPauseReason = null;
    return this.crmRepository.save(row);
  }

  /** Clear human_handling left behind when pause flags were already cleared. */
  private async healStaleHumanHandling(row: InboxThreadCrm): Promise<InboxThreadCrm> {
    if (row.aiOptOut) return row;
    if (row.aiHandlingState !== InboxAiHandlingState.HUMAN_HANDLING) return row;
    if (row.aiAutoReplyPaused && row.autopilotPauseReason === AI_PAUSE_EXPLICIT) return row;
    if (
      row.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER &&
      row.manualTakeoverUntil &&
      row.manualTakeoverUntil.getTime() > Date.now()
    ) {
      return row;
    }
    row.aiHandlingState = InboxAiHandlingState.IDLE;
    row.aiAutoReplyPaused = false;
    if (row.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER) {
      row.autopilotPauseReason = null;
      row.manualTakeoverUntil = null;
    }
    return this.crmRepository.save(row);
  }

  /**
   * Normalize CRM row before auto-reply (expire staff takeover timer, heal stale states).
   */
  async refreshAutoReplyGate(
    sessionId: string,
    chatId: string,
  ): Promise<{
    handlingState: InboxAiHandlingState;
    paused: boolean;
    optedOut: boolean;
    canAutoReply: boolean;
    blockReason?: string;
  }> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      return {
        handlingState: InboxAiHandlingState.IDLE,
        paused: false,
        optedOut: false,
        canAutoReply: true,
      };
    }

    if (row.aiOptOut) {
      return {
        handlingState: (row.aiHandlingState as InboxAiHandlingState) ?? InboxAiHandlingState.IDLE,
        paused: true,
        optedOut: true,
        canAutoReply: false,
        blockReason: 'customer opted out of AI',
      };
    }

    row = await this.maybeExpireManualTakeover(row);
    row = await this.healStaleHumanHandling(row);

    const handlingState =
      (row.aiHandlingState as InboxAiHandlingState) ?? InboxAiHandlingState.IDLE;

    if (handlingState === InboxAiHandlingState.WAITING_HUMAN) {
      return {
        handlingState,
        paused: true,
        optedOut: false,
        canAutoReply: false,
        blockReason: `state=${handlingState}`,
      };
    }

    if (handlingState === InboxAiHandlingState.HUMAN_HANDLING) {
      return {
        handlingState,
        paused: row.aiAutoReplyPaused === true,
        optedOut: false,
        canAutoReply: false,
        blockReason: `state=${handlingState}`,
      };
    }

    const paused = await this.isAiAutoReplyPaused(sessionId, chatId);
    if (paused) {
      return {
        handlingState,
        paused: true,
        optedOut: false,
        canAutoReply: false,
        blockReason: 'paused for this chat',
      };
    }

    return {
      handlingState,
      paused: false,
      optedOut: false,
      canAutoReply: true,
    };
  }

  /** Heal stale human_handling rows across active sessions (startup / maintenance). */
  async healAllStaleAutoReplyStates(sessionId?: string): Promise<{ healed: number }> {
    const qb = this.crmRepository
      .createQueryBuilder('crm')
      .where('crm.aiOptOut = :optOut', { optOut: false })
      .andWhere(
        '(crm.aiHandlingState = :human OR crm.autopilotPauseReason = :manual)',
        {
          human: InboxAiHandlingState.HUMAN_HANDLING,
          manual: AI_PAUSE_MANUAL_TAKEOVER,
        },
      );
    if (sessionId) {
      qb.andWhere('crm.sessionId = :sessionId', { sessionId });
    }
    const rows = await qb.getMany();
    let healed = 0;
    for (const row of rows) {
      const before = `${row.aiHandlingState}:${row.aiAutoReplyPaused}`;
      const gate = await this.refreshAutoReplyGate(row.sessionId, row.chatId);
      if (gate.canAutoReply && before !== `${gate.handlingState}:false`) healed += 1;
    }
    return { healed };
  }

  async isAiOptOut(sessionId: string, chatId: string): Promise<boolean> {
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    return row?.aiOptOut === true;
  }

  async isFollowupAutopilotPaused(sessionId: string, chatId: string): Promise<boolean> {
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row?.followupAutopilotPaused) return false;
    if (row.followupAutopilotPausedUntil && row.followupAutopilotPausedUntil.getTime() <= Date.now()) {
      row.followupAutopilotPaused = false;
      row.followupAutopilotPausedUntil = null;
      await this.crmRepository.save(row);
      return false;
    }
    return true;
  }

  async pauseFollowupAutopilot(
    sessionId: string,
    chatId: string,
    staffId: string,
    pauseMinutes = 120,
  ): Promise<InboxThreadCrmDto> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }
    row.followupAutopilotPaused = true;
    row.followupAutopilotPausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000);
    row.followupAutopilotPausedBy = staffId;
    const saved = await this.crmRepository.save(row);
    void this.auditService.logInfo(AuditAction.FOLLOWUP_AUTOPILOT_PAUSED, {
      sessionId,
      metadata: { chatId, staffId, pauseMinutes },
    });
    return this.toDto(saved);
  }

  async resumeFollowupAutopilot(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }
    row.followupAutopilotPaused = false;
    row.followupAutopilotPausedUntil = null;
    row.followupAutopilotPausedBy = null;
    const saved = await this.crmRepository.save(row);
    return this.toDto(saved);
  }

  async getAiHandlingState(sessionId: string, chatId: string): Promise<InboxAiHandlingState> {
    const gate = await this.refreshAutoReplyGate(sessionId, chatId);
    return gate.handlingState;
  }

  async setAiHandlingState(
    sessionId: string,
    chatId: string,
    state: InboxAiHandlingState,
  ): Promise<InboxThreadCrmDto> {
    return this.upsertThreadCrm(sessionId, chatId, { aiHandlingState: state });
  }

  async escalateToHuman(sessionId: string, chatId: string, reason?: string): Promise<InboxThreadCrmDto> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }
    row.aiHandlingState = InboxAiHandlingState.WAITING_HUMAN;
    row.aiEscalatedAt = new Date();
    row.aiAutoReplyPaused = true;
    if (reason?.trim()) {
      const stamp = formatAiEscalationNote(reason);
      row.internalNote = row.internalNote ? `${row.internalNote}\n${stamp}` : stamp;
    }
    const saved = await this.crmRepository.save(row);
    await this.syncFollowupConversation(sessionId, chatId, saved);
    return this.toDto(saved);
  }

  async recordAiFailure(sessionId: string, chatId: string): Promise<number> {
    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }
    row.aiFailureCount = (row.aiFailureCount ?? 0) + 1;
    await this.crmRepository.save(row);
    return row.aiFailureCount;
  }

  async resetAiFailures(sessionId: string, chatId: string): Promise<void> {
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row || row.aiFailureCount === 0) return;
    row.aiFailureCount = 0;
    await this.crmRepository.save(row);
  }

  async takeOverFromAi(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    await this.aiSignalService.resolveOpenEscalations(sessionId, chatId);
    return this.upsertThreadCrm(sessionId, chatId, {
      aiHandlingState: InboxAiHandlingState.HUMAN_HANDLING,
      aiAutoReplyPaused: true,
      autopilotPauseReason: AI_PAUSE_EXPLICIT,
    });
  }

  /** Temporary pause after staff sends a manual message — auto-resumes after `minutes`. */
  async takeOverFromStaffReply(
    sessionId: string,
    chatId: string,
    minutes = 15,
  ): Promise<InboxThreadCrmDto> {
    const bounded = Math.min(Math.max(minutes, 1), 240);
    const existing = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    const baseMs =
      existing?.manualTakeoverUntil &&
      existing.autopilotPauseReason === AI_PAUSE_MANUAL_TAKEOVER &&
      existing.manualTakeoverUntil.getTime() > Date.now()
        ? existing.manualTakeoverUntil.getTime()
        : Date.now();
    const until = new Date(baseMs + bounded * 60 * 1000);
    return this.upsertThreadCrm(sessionId, chatId, {
      aiHandlingState: InboxAiHandlingState.HUMAN_HANDLING,
      aiAutoReplyPaused: true,
      autopilotPauseReason: AI_PAUSE_MANUAL_TAKEOVER,
      manualTakeoverUntil: until.toISOString(),
    });
  }

  async resumeAi(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    await this.aiSignalService.resolveOpenEscalations(sessionId, chatId);
    return this.upsertThreadCrm(sessionId, chatId, {
      aiHandlingState: InboxAiHandlingState.IDLE,
      aiAutoReplyPaused: false,
      aiOptOut: false,
      autopilotPauseReason: null,
      manualTakeoverUntil: null,
    });
  }

  /** Customer requested no AI — permanent until staff clears opt-out. */
  async customerOptOutOfAi(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    return this.upsertThreadCrm(sessionId, chatId, {
      aiOptOut: true,
      aiAutoReplyPaused: true,
      aiHandlingState: InboxAiHandlingState.HUMAN_HANDLING,
    });
  }

  /** Resume AI on all paused threads (except customer opt-out) for a session or globally. */
  async bulkResumeAiThreads(sessionId?: string): Promise<{ resumed: number }> {
    const qb = this.crmRepository
      .createQueryBuilder('crm')
      .where('crm.aiAutoReplyPaused = :paused', { paused: true })
      .andWhere('(crm.aiOptOut IS NULL OR crm.aiOptOut = :optOut)', { optOut: false });
    if (sessionId) {
      qb.andWhere('crm.sessionId = :sessionId', { sessionId });
    }
    const rows = await qb.getMany();
    for (const row of rows) {
      await this.aiSignalService.resolveOpenEscalations(row.sessionId, row.chatId);
      await this.upsertThreadCrm(row.sessionId, row.chatId, {
        aiHandlingState: InboxAiHandlingState.IDLE,
        aiAutoReplyPaused: false,
        aiOptOut: false,
        autopilotPauseReason: null,
        clearAiMemory: true,
      });
    }
    return { resumed: rows.length };
  }

  async getCrmMapForSession(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, InboxThreadCrm>> {
    if (chatIds.length === 0) return new Map();
    const rows = await this.crmRepository.find({
      where: { sessionId, chatId: In(chatIds) },
    });
    return new Map(rows.map(r => [r.chatId, r]));
  }

  private toDto(row: InboxThreadCrm): InboxThreadCrmDto {
    return {
      sessionId: row.sessionId,
      chatId: row.chatId,
      resolved: row.resolved,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      internalNote: row.internalNote,
      followUpAt: row.followUpAt?.toISOString() ?? null,
      followUpReason: row.followUpReason,
      followUpNote: row.followUpNote,
      customerName: resolveCustomerName(row.chatId, row.customerName),
      customerPhone: resolveCustomerPhone(row.chatId, row.customerPhone),
      linkedExternalId: row.linkedExternalId,
      aiAutoReplyPaused: row.aiAutoReplyPaused,
      aiHandlingState: (row.aiHandlingState as InboxAiHandlingState) ?? InboxAiHandlingState.IDLE,
      aiEscalatedAt: row.aiEscalatedAt?.toISOString() ?? null,
      aiOptOut: row.aiOptOut,
      followupAutopilotPaused: row.followupAutopilotPaused,
      followupAutopilotPausedUntil: row.followupAutopilotPausedUntil?.toISOString() ?? null,
      resolvedReason: row.resolvedReason,
      resolvedNote: row.resolvedNote,
      outcome: row.outcome,
      resolvedByStaffId: row.resolvedByStaffId,
      updatedAt: row.updatedAt.toISOString(),
      preferredBranchId: row.preferredBranchId,
      confirmedCity: row.confirmedCity,
      lastProductInterest: row.lastProductInterest,
      lastIntent: row.lastIntent,
      discountRequestCount: row.discountRequestCount ?? 0,
      installmentInterest: row.installmentInterest ?? false,
      paymentReadiness: row.paymentReadiness,
      aiNotes: row.aiNotes,
      autopilotPauseReason: row.autopilotPauseReason,
      manualTakeoverUntil: row.manualTakeoverUntil?.toISOString() ?? null,
      buyingPreferences: row.buyingPreferences,
      discountNegotiationMarked: row.discountNegotiationMarked ?? false,
    };
  }

  private emptyDto(sessionId: string, chatId: string): InboxThreadCrmDto {
    return {
      sessionId,
      chatId,
      resolved: false,
      resolvedAt: null,
      internalNote: null,
      followUpAt: null,
      followUpReason: null,
      followUpNote: null,
      customerName: null,
      customerPhone: null,
      linkedExternalId: null,
      aiAutoReplyPaused: false,
      aiHandlingState: InboxAiHandlingState.IDLE,
      aiEscalatedAt: null,
      aiOptOut: false,
      followupAutopilotPaused: false,
      followupAutopilotPausedUntil: null,
      resolvedReason: null,
      resolvedNote: null,
      outcome: null,
      resolvedByStaffId: null,
      updatedAt: new Date(0).toISOString(),
      preferredBranchId: null,
      confirmedCity: null,
      lastProductInterest: null,
      lastIntent: null,
      discountRequestCount: 0,
      installmentInterest: false,
      paymentReadiness: null,
      aiNotes: null,
      autopilotPauseReason: null,
      manualTakeoverUntil: null,
      buyingPreferences: null,
      discountNegotiationMarked: false,
    };
  }
}
