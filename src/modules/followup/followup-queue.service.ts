import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import {
  FollowUpStatus,
  FollowUpQueueFilter,
  FollowUpAttemptMode,
  FollowUpOutcome,
  ConversationStage,
  FollowUpSentBy,
} from './followup.enums';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupTemplateService } from './followup-template.service';
import { renderTemplate, isWithin24HourWindow, TemplateVariables } from './utils/template.util';
import { MessageService } from '../message/message.service';
import { SmsService } from '../sms/sms.service';
import type { SmsSendChannel } from '../sms/sms.enums';
import { ApiKey } from '../auth/entities/api-key.entity';
import { EventsGateway } from '../events/events.gateway';
import { AuthService } from '../auth/auth.service';
import { FollowupRule } from './entities/followup-rule.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { Session } from '../session/entities/session.entity';
import { FollowupAutopilotChannelService } from './followup-autopilot-channel.service';
import { FollowupAutopilotAuditService } from './followup-autopilot-audit.service';
import { uuidVarcharJoin } from '../../common/utils/sql-dialect.util';

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface QueueItemView {
  id: string;
  conversationId: string;
  sessionId: string;
  chatId: string;
  customerName: string | null;
  customerPhone: string | null;
  source: string;
  productInterest: string | null;
  stage: string;
  dueAt: string;
  status: FollowUpStatus;
  templatePreview: string | null;
  recommendedAction: string | null;
  attemptNumber: number;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  branchId: string | null;
  warningAt: string | null;
  escalatedAt: string | null;
  kpiPenaltyFlag: boolean;
  within24hWindow: boolean;
  priority: string;
  lastCustomerMessageAt: string | null;
  isAutopilot?: boolean;
  detectedReason?: string | null;
  customerMood?: string | null;
  riskLevel?: string | null;
  confidenceScore?: number | null;
  suggestedChannel?: string | null;
  suggestedMessage?: string | null;
  originalCustomerMessage?: string | null;
  lastStaffMessage?: string | null;
  stopReason?: string | null;
  channelUsed?: string | null;
  templateName?: string | null;
}

export interface CompleteFollowupDto {
  outcome: FollowUpOutcome;
  messageBody?: string;
  sent?: boolean;
}

export interface RescheduleDto {
  dueAt: string;
  notes?: string;
}

@Injectable()
export class FollowupQueueService {
  private readonly logger = new Logger(FollowupQueueService.name);

  constructor(
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(FollowupAttempt, 'data')
    private readonly attemptRepo: Repository<FollowupAttempt>,
    @InjectRepository(FollowupConversation, 'data')
    private readonly convRepo: Repository<FollowupConversation>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly conversationService: FollowupConversationService,
    private readonly templateService: FollowupTemplateService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly smsService: SmsService,
    private readonly eventsGateway: EventsGateway,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly autopilotChannel: FollowupAutopilotChannelService,
    private readonly autopilotAudit: FollowupAutopilotAuditService,
  ) {}

  private maxSendsPerSessionPerDay(): number {
    return parseInt(process.env.FOLLOWUP_MAX_SENDS_PER_SESSION_PER_DAY || '500', 10);
  }

  private maxSendsPerCustomerPerDay(): number {
    return parseInt(process.env.FOLLOWUP_MAX_SENDS_PER_CUSTOMER_PER_DAY || '10', 10);
  }

  async createQueueItem(params: {
    conversationId: string;
    ruleId?: string | null;
    templateId?: string | null;
    assignedStaffId?: string | null;
    branchId?: string | null;
    dueAt: Date;
    recommendedAction?: string;
    attemptNumber?: number;
  }): Promise<FollowupQueueItem> {
    const item = this.queueRepo.create({
      ...params,
      status: FollowUpStatus.PENDING,
      attemptNumber: params.attemptNumber ?? 1,
    });
    const saved = await this.queueRepo.save(item);

    const conv = await this.conversationService.findById(params.conversationId);
    conv.nextFollowupAt = params.dueAt;
    conv.lastFollowupAt = new Date();
    await this.convRepo.save(conv);

    return saved;
  }

  async createAutopilotQueueItem(params: {
    conversationId: string;
    ruleId?: string | null;
    templateId?: string | null;
    assignedStaffId?: string | null;
    branchId?: string | null;
    dueAt: Date;
    recommendedAction?: string;
    attemptNumber?: number;
    status: FollowUpStatus;
    detectedReason?: string;
    customerMood?: string;
    riskLevel?: string;
    confidenceScore?: number;
    suggestedChannel?: string;
    suggestedMessage?: string;
    originalCustomerMessage?: string | null;
    lastStaffMessage?: string | null;
    stopReason?: string | null;
    stoppedAt?: Date | null;
    stoppedBy?: string | null;
  }): Promise<FollowupQueueItem> {
    const item = this.queueRepo.create({
      ...params,
      isAutopilot: true,
      attemptNumber: params.attemptNumber ?? 1,
    });
    const saved = await this.queueRepo.save(item);

    const conv = await this.conversationService.findById(params.conversationId);
    conv.nextFollowupAt = params.dueAt;
    conv.lastFollowupAt = new Date();
    await this.convRepo.save(conv);

    this.emitAutopilotUpdated(conv.sessionId, {
      followupId: saved.id,
      status: saved.status,
      action: 'created',
      chatId: conv.chatId,
    });

    return saved;
  }

  private emitAutopilotUpdated(
    sessionId: string,
    data: Record<string, unknown>,
  ): void {
    this.eventsGateway.emitFollowupAlert('followup.autopilot_updated', sessionId, data);
  }

  async approveAndSend(
    followupId: string,
    staffId: string,
    editedMessage?: string,
  ): Promise<{ messageBody: string; channels: string[] }> {
    const item = await this.findQueueItem(followupId);
    if (
      item.status !== FollowUpStatus.NEEDS_APPROVAL &&
      item.status !== FollowUpStatus.AI_SUGGESTED
    ) {
      throw new BadRequestException('Follow-up is not awaiting approval');
    }
    const result = await this.autopilotChannel.sendAutopilotMessage(
      followupId,
      staffId,
      editedMessage ?? item.suggestedMessage ?? undefined,
    );
    if (!result.success) {
      throw new BadRequestException(result.failureReason ?? 'Send failed');
    }
    void this.autopilotAudit.log(
      {
        followupId,
        approvedBy: staffId,
        sentBy: FollowUpSentBy.STAFF,
        resultStatus: FollowUpStatus.SENT,
        messageSent: result.messageBody,
      },
      AuditAction.FOLLOWUP_AUTOPILOT_APPROVED,
    );
    const conv = await this.conversationService.findById(item.conversationId);
    this.emitAutopilotUpdated(conv.sessionId, {
      followupId,
      status: FollowUpStatus.SENT,
      action: 'approved',
      chatId: conv.chatId,
    });
    return { messageBody: result.messageBody, channels: result.channels };
  }

  async rejectAutopilot(followupId: string, staffId: string, reason?: string): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    item.status = FollowUpStatus.REJECTED;
    item.stoppedAt = new Date();
    item.stoppedBy = FollowUpSentBy.STAFF;
    item.stopReason = reason ?? 'staff_rejected';
    item.approvedBy = staffId;
    const saved = await this.queueRepo.save(item);
    void this.autopilotAudit.log(
      { followupId, approvedBy: staffId, resultStatus: FollowUpStatus.REJECTED, decisionReason: reason },
      AuditAction.FOLLOWUP_AUTOPILOT_REJECTED,
    );
    const conv = await this.conversationService.findById(item.conversationId);
    this.emitAutopilotUpdated(conv.sessionId, {
      followupId,
      status: FollowUpStatus.REJECTED,
      action: 'rejected',
      chatId: conv.chatId,
    });
    return saved;
  }

  async scheduleAutopilotLater(followupId: string, dueAt: string): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    item.dueAt = new Date(dueAt);
    item.status = FollowUpStatus.SCHEDULED;
    const saved = await this.queueRepo.save(item);
    const conv = await this.conversationService.findById(item.conversationId);
    conv.nextFollowupAt = item.dueAt;
    await this.convRepo.save(conv);
    this.emitAutopilotUpdated(conv.sessionId, {
      followupId,
      status: FollowUpStatus.SCHEDULED,
      action: 'scheduled',
      chatId: conv.chatId,
      dueAt,
    });
    return saved;
  }

  async stopItem(
    followupId: string,
    stopReason: string,
    stoppedBy: string,
  ): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    item.status = FollowUpStatus.STOPPED;
    item.stopReason = stopReason;
    item.stoppedAt = new Date();
    item.stoppedBy = stoppedBy;
    return this.queueRepo.save(item);
  }

  async getQueue(filter: FollowUpQueueFilter, branchId?: string, staffId?: string): Promise<QueueItemView[]> {
    const autopilotFilters = [
      FollowUpQueueFilter.AI_SUGGESTED,
      FollowUpQueueFilter.NEEDS_APPROVAL,
      FollowUpQueueFilter.SCHEDULED,
      FollowUpQueueFilter.AUTO_SENT,
      FollowUpQueueFilter.FAILED,
      FollowUpQueueFilter.STOPPED,
      FollowUpQueueFilter.CONVERTED,
    ];
    const isAutopilotFilter = autopilotFilters.includes(filter);

    const qb = this.queueRepo
      .createQueryBuilder('q')
      .innerJoin(FollowupConversation, 'c', uuidVarcharJoin('c.id', 'q.conversationId'));

    if (isAutopilotFilter) {
      qb.where('q.status = :status', { status: filter });
    } else {
      qb.where('q.status IN (:...statuses)', {
        statuses: [FollowUpStatus.PENDING, FollowUpStatus.DUE, FollowUpStatus.IN_PROGRESS, FollowUpStatus.ESCALATED],
      });
    }

    if (branchId) qb.andWhere('(q.branchId = :branchId OR q.branchId IS NULL)', { branchId });
    if (staffId) qb.andWhere('q.assignedStaffId = :staffId', { staffId });

    this.applyQueueFilter(qb, filter);

    qb.orderBy('q.dueAt', 'ASC');
    const items = await qb.getMany();
    return this.enrichQueueItems(items);
  }

  async getFilterCounts(branchId?: string, staffId?: string): Promise<Record<FollowUpQueueFilter, number>> {
    const counts = {} as Record<FollowUpQueueFilter, number>;
    for (const filter of Object.values(FollowUpQueueFilter)) {
      const autopilotFilters = [
        FollowUpQueueFilter.AI_SUGGESTED,
        FollowUpQueueFilter.NEEDS_APPROVAL,
        FollowUpQueueFilter.SCHEDULED,
        FollowUpQueueFilter.AUTO_SENT,
        FollowUpQueueFilter.FAILED,
        FollowUpQueueFilter.STOPPED,
        FollowUpQueueFilter.CONVERTED,
      ];
      const isAutopilotFilter = autopilotFilters.includes(filter);

      const qb = this.queueRepo
        .createQueryBuilder('q')
        .innerJoin(FollowupConversation, 'c', uuidVarcharJoin('c.id', 'q.conversationId'));

      if (isAutopilotFilter) {
        qb.where('q.status = :status', { status: filter });
      } else {
        qb.where('q.status IN (:...statuses)', {
          statuses: [FollowUpStatus.PENDING, FollowUpStatus.DUE, FollowUpStatus.IN_PROGRESS, FollowUpStatus.ESCALATED],
        });
      }
      if (branchId) qb.andWhere('(q.branchId = :branchId OR q.branchId IS NULL)', { branchId });
      if (staffId) qb.andWhere('q.assignedStaffId = :staffId', { staffId });
      this.applyQueueFilter(qb, filter);
      counts[filter] = await qb.getCount();
    }
    return counts;
  }

  private applyQueueFilter(
    qb: ReturnType<Repository<FollowupQueueItem>['createQueryBuilder']>,
    filter: FollowUpQueueFilter,
  ): void {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    switch (filter) {
      case FollowUpQueueFilter.DUE_NOW:
        qb.andWhere('q.dueAt <= :now', { now });
        break;
      case FollowUpQueueFilter.DUE_TODAY:
        qb.andWhere('q.dueAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay });
        break;
      case FollowUpQueueFilter.OVERDUE:
        qb.andWhere('q.dueAt < :now', { now });
        break;
      case FollowUpQueueFilter.HOT_LEADS:
        qb.andWhere('c.stage IN (:...stages)', {
          stages: [ConversationStage.NEGOTIATING, ConversationStage.PAYMENT_PENDING, ConversationStage.PRICE_SENT],
        });
        break;
      case FollowUpQueueFilter.PAYMENT_PENDING:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.PAYMENT_PENDING });
        break;
      case FollowUpQueueFilter.STOCK_REMINDERS:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.PRODUCT_SUGGESTED });
        break;
      case FollowUpQueueFilter.WAITING_CUSTOMER_REPLY:
        qb.andWhere('c.stage = :stage', { stage: ConversationStage.WAITING_CUSTOMER_REPLY });
        break;
    }
  }

  private async enrichQueueItems(items: FollowupQueueItem[]): Promise<QueueItemView[]> {
    if (items.length === 0) return [];

    const convIds = [...new Set(items.map(i => i.conversationId))];
    const convs = await this.convRepo.find({ where: { id: In(convIds) } });
    const convMap = new Map(convs.map(c => [c.id, c]));
    const crmMap = await this.conversationService.getCrmMapForConversations(convs);

    const templateIds = items.map(i => i.templateId).filter(Boolean) as string[];
    const templates =
      templateIds.length > 0
        ? await this.templateService.findAll().then(all => all.filter(t => templateIds.includes(t.id)))
        : [];
    const tplMap = new Map(templates.map(t => [t.id, t]));

    const staffNameMap = new Map<string, string>();
    try {
      const keys = await this.authService.findAll();
      for (const k of keys) staffNameMap.set(k.id, k.name);
    } catch {
      // staff names optional
    }

    return items.map(item => {
      const conv = convMap.get(item.conversationId);
      const crm = conv ? crmMap.get(`${conv.sessionId}:${conv.chatId}`) : undefined;
      const identity = conv
        ? this.conversationService.resolveIdentity(conv, crm)
        : { customerName: null, customerPhone: null };
      const tpl = item.templateId ? tplMap.get(item.templateId) : null;
      const vars: TemplateVariables = {
        customer_name: identity.customerName ?? undefined,
        product_name: conv?.productInterest ?? undefined,
      };
      return {
        id: item.id,
        conversationId: item.conversationId,
        sessionId: conv?.sessionId ?? '',
        chatId: conv?.chatId ?? '',
        customerName: identity.customerName,
        customerPhone: identity.customerPhone,
        source: conv?.source ?? 'whatsapp',
        productInterest: conv?.productInterest ?? null,
        stage: conv?.stage ?? '',
        dueAt: toIsoString(item.dueAt) ?? new Date().toISOString(),
        status: item.status,
        templatePreview: tpl ? renderTemplate(tpl.body, vars) : null,
        recommendedAction: item.recommendedAction,
        attemptNumber: item.attemptNumber,
        assignedStaffId: item.assignedStaffId,
        assignedStaffName: item.assignedStaffId
          ? (staffNameMap.get(item.assignedStaffId) ?? null)
          : null,
        branchId: item.branchId,
        warningAt: toIsoString(item.warningAt),
        escalatedAt: toIsoString(item.escalatedAt),
        kpiPenaltyFlag: item.kpiPenaltyFlag,
        within24hWindow: isWithin24HourWindow(conv?.lastCustomerMessageAt ?? null),
        priority: conv?.priority ?? 'normal',
        lastCustomerMessageAt: toIsoString(conv?.lastCustomerMessageAt),
        isAutopilot: item.isAutopilot,
        detectedReason: item.detectedReason,
        customerMood: item.customerMood,
        riskLevel: item.riskLevel,
        confidenceScore: item.confidenceScore,
        suggestedChannel: item.suggestedChannel,
        suggestedMessage: item.suggestedMessage,
        originalCustomerMessage: item.originalCustomerMessage,
        lastStaffMessage: item.lastStaffMessage,
        stopReason: item.stopReason,
        channelUsed: item.channelUsed,
        templateName: tpl?.name ?? null,
      };
    });
  }

  async sendMessage(
    followupId: string,
    staffId: string,
    variables?: TemplateVariables,
    channel: SmsSendChannel = 'whatsapp',
    apiKey?: ApiKey,
  ): Promise<{ messageBody: string; sent: boolean; channels: string[] }> {
    const item = await this.queueRepo.findOne({ where: { id: followupId } });
    if (!item) throw new NotFoundException(`Follow-up ${followupId} not found`);

    const conv = await this.conversationService.findById(item.conversationId);
    const identity = await this.conversationService.resolveIdentityForThread(
      conv.sessionId,
      conv.chatId,
      conv,
    );
    let messageBody = '';
    let sentChannels: string[] = [];

    if (item.templateId) {
      const tpl = await this.templateService.findById(item.templateId);
      const vars: TemplateVariables = {
        customer_name: identity.customerName ?? undefined,
        product_name: conv.productInterest ?? undefined,
        staff_name: variables?.staff_name,
        branch_name: variables?.branch_name,
        price: variables?.price,
        lower_price: variables?.lower_price,
        payment_number: variables?.payment_number,
        pickup_location: variables?.pickup_location,
        device_name: variables?.device_name,
        ...variables,
      };
      messageBody = renderTemplate(tpl.body, vars);

      const sendWhatsapp = channel === 'whatsapp' || channel === 'both';
      const sendSms = channel === 'sms' || channel === 'both';

      if (sendWhatsapp) {
        if (tpl.requiresWhatsappApproval && tpl.whatsappTemplateStatus !== 'approved') {
          throw new BadRequestException(
            'Outside 24h window requires approved WhatsApp template. Template not approved.',
          );
        }
        if (!isWithin24HourWindow(conv.lastCustomerMessageAt) && !tpl.requiresWhatsappApproval) {
          throw new BadRequestException(
            'Outside 24-hour customer care window. Use an approved WhatsApp template.',
          );
        }
      }

      if (sendSms && !identity.customerPhone) {
        throw new BadRequestException('Customer phone required for SMS follow-up');
      }

      if (sendSms && !apiKey) {
        throw new BadRequestException('API key required for SMS follow-up');
      }

      if (sendWhatsapp) {
        await this.messageService.sendText(conv.sessionId, {
          chatId: conv.chatId,
          text: messageBody,
        }, { actorStaffId: staffId, source: 'followup' });
        await this.conversationService.recordStaffMessage(conv.sessionId, conv.chatId);
        sentChannels.push('whatsapp');
      }

      if (sendSms && apiKey) {
        await this.smsService.send(
          {
            toPhone: identity.customerPhone!,
            message: messageBody,
            customerId: conv.customerId ?? undefined,
            conversationId: conv.id,
            relatedType: 'followup',
            relatedId: item.id,
          },
          apiKey,
        );
        sentChannels.push('sms');
      }
    } else {
      throw new BadRequestException('No template or message body provided');
    }

    await this.recordAttempt(item, staffId, FollowUpAttemptMode.MANUAL, messageBody, 'sent');

    return { messageBody, sent: true, channels: sentChannels.length ? sentChannels : ['whatsapp'] };
  }

  async complete(followupId: string, staffId: string, dto: CompleteFollowupDto): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    const now = new Date();
    const onTime = now <= item.dueAt;

    item.status = onTime ? FollowUpStatus.COMPLETED : FollowUpStatus.COMPLETED;
    await this.queueRepo.save(item);

    await this.recordAttempt(
      item,
      staffId,
      FollowUpAttemptMode.TASK,
      dto.messageBody ?? null,
      dto.sent ? 'sent' : 'task_completed',
      dto.outcome,
    );

    const conv = await this.conversationService.findById(item.conversationId);
    conv.followupCompletedBeforeClose = true;
    conv.followupCompleted = true;
    await this.convRepo.save(conv);

    return item;
  }

  async reschedule(followupId: string, dto: RescheduleDto): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    item.dueAt = new Date(dto.dueAt);
    item.status = FollowUpStatus.PENDING;
    if (dto.notes) item.notes = dto.notes;
    return this.queueRepo.save(item);
  }

  async assign(followupId: string, staffId: string): Promise<FollowupQueueItem> {
    const item = await this.findQueueItem(followupId);
    item.assignedStaffId = staffId;
    return this.queueRepo.save(item);
  }

  async getHistory(conversationId: string): Promise<FollowupAttempt[]> {
    return this.attemptRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelPendingForConversation(conversationId: string, reason: string): Promise<number> {
    const activeStatuses = [
      FollowUpStatus.PENDING,
      FollowUpStatus.DUE,
      FollowUpStatus.IN_PROGRESS,
      FollowUpStatus.ESCALATED,
      FollowUpStatus.AI_SUGGESTED,
      FollowUpStatus.NEEDS_APPROVAL,
      FollowUpStatus.SCHEDULED,
    ];
    const pending = await this.queueRepo.find({
      where: {
        conversationId,
        status: In(activeStatuses),
      },
    });
    if (pending.length === 0) return 0;

    for (const item of pending) {
      if (item.isAutopilot) {
        item.status = FollowUpStatus.STOPPED;
        item.stopReason = reason;
        item.stoppedAt = new Date();
        item.stoppedBy = 'system';
      } else {
        item.status = FollowUpStatus.CANCELLED;
        item.notes = item.notes ? `${item.notes}\n[cancelled: ${reason}]` : `[cancelled: ${reason}]`;
      }
    }
    await this.queueRepo.save(pending);

    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    void this.auditService.logInfo(AuditAction.FOLLOWUP_CANCELLED, {
      sessionId: conv?.sessionId ?? undefined,
      metadata: { conversationId, reason, count: pending.length },
    });

    return pending.length;
  }

  async hasPendingForConversationStage(
    conversationId: string,
    stage: ConversationStage,
  ): Promise<boolean> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv || conv.stage !== stage) return false;

    const pending = await this.queueRepo.findOne({
      where: {
        conversationId,
        status: In([
          FollowUpStatus.PENDING,
          FollowUpStatus.DUE,
          FollowUpStatus.IN_PROGRESS,
          FollowUpStatus.ESCALATED,
          FollowUpStatus.AI_SUGGESTED,
          FollowUpStatus.NEEDS_APPROVAL,
          FollowUpStatus.SCHEDULED,
        ]),
      },
    });
    return Boolean(pending);
  }

  async isWithinAutomatedSendLimits(sessionId: string, customerPhone: string | null): Promise<boolean> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sessionLimit = this.maxSendsPerSessionPerDay();
    const customerLimit = this.maxSendsPerCustomerPerDay();

    const sessionSends = await this.attemptRepo
      .createQueryBuilder('a')
      .innerJoin(FollowupConversation, 'c', uuidVarcharJoin('c.id', 'a.conversationId'))
      .where('c.sessionId = :sessionId', { sessionId })
      .andWhere('a.mode = :mode', { mode: FollowUpAttemptMode.AUTO_SEND })
      .andWhere('a.sentAt >= :since', { since })
      .getCount();

    if (sessionSends >= sessionLimit) {
      this.logger.warn(`Follow-up session send limit reached for ${sessionId}`);
      return false;
    }

    if (customerPhone) {
      const customerSends = await this.attemptRepo
        .createQueryBuilder('a')
        .innerJoin(FollowupConversation, 'c', uuidVarcharJoin('c.id', 'a.conversationId'))
        .where('c.customerPhone = :customerPhone', { customerPhone })
        .andWhere('a.mode = :mode', { mode: FollowUpAttemptMode.AUTO_SEND })
        .andWhere('a.sentAt >= :since', { since })
        .getCount();

      if (customerSends >= customerLimit) {
        this.logger.warn(`Follow-up customer send limit reached for ${customerPhone}`);
        return false;
      }
    }

    return true;
  }

  async logAutoSend(sessionId: string, conversationId: string, followupId: string): Promise<void> {
    void this.auditService.logInfo(AuditAction.FOLLOWUP_AUTO_SENT, {
      sessionId,
      metadata: { conversationId, followupId },
    });
  }

  async canApplyRule(conversationId: string, rule: FollowupRule): Promise<boolean> {
    const pending = await this.findPendingForConversationRule(conversationId, rule.id);
    if (pending) return false;

    if (rule.stage) {
      const stagePending = await this.hasPendingForConversationStage(conversationId, rule.stage);
      if (stagePending) return false;
    }

    const attemptCount = await this.queueRepo.count({
      where: { conversationId, ruleId: rule.id },
    });
    if (attemptCount >= rule.maxAttempts) return false;

    const last = await this.queueRepo.findOne({
      where: { conversationId, ruleId: rule.id },
      order: { updatedAt: 'DESC' },
    });
    if (last && [FollowUpStatus.COMPLETED, FollowUpStatus.CANCELLED, FollowUpStatus.MISSED].includes(last.status)) {
      const cooldownMs = rule.delayMinutes * 60 * 1000;
      if (Date.now() - last.updatedAt.getTime() < cooldownMs) return false;
    }

    return true;
  }

  async findPendingForConversationRule(
    conversationId: string,
    ruleId: string,
  ): Promise<FollowupQueueItem | null> {
    return this.queueRepo.findOne({
      where: {
        conversationId,
        ruleId,
        status: In([
          FollowUpStatus.PENDING,
          FollowUpStatus.DUE,
          FollowUpStatus.IN_PROGRESS,
          FollowUpStatus.ESCALATED,
          FollowUpStatus.AI_SUGGESTED,
          FollowUpStatus.NEEDS_APPROVAL,
          FollowUpStatus.SCHEDULED,
        ]),
      },
    });
  }

  async processEscalations(): Promise<void> {
    const now = new Date();
    const overdue = await this.queueRepo.find({
      where: {
        status: In([FollowUpStatus.PENDING, FollowUpStatus.DUE, FollowUpStatus.IN_PROGRESS]),
        dueAt: LessThanOrEqual(now),
      },
    });

    for (const item of overdue) {
      const overdueMs = now.getTime() - item.dueAt.getTime();
      const thirtyMin = 30 * 60 * 1000;
      const twoHours = 2 * 60 * 60 * 1000;
      const oneDay = 24 * 60 * 60 * 1000;

      const conv = await this.convRepo.findOne({ where: { id: item.conversationId } });
      const sessionId = conv?.sessionId ?? '*';
      const session =
        conv?.sessionId && conv.sessionId !== 'manual'
          ? await this.sessionRepo.findOne({ where: { id: conv.sessionId } })
          : null;
      const identity = conv
        ? await this.conversationService.resolveIdentityForThread(conv.sessionId, conv.chatId, conv)
        : { customerName: null, customerPhone: null };
      const alertBase = {
        followupId: item.id,
        conversationId: item.conversationId,
        customerName: identity.customerName,
        customerPhone: identity.customerPhone,
        sessionName: session?.name ?? conv?.sessionId ?? null,
        stage: conv?.stage ?? null,
      };

      if (overdueMs >= thirtyMin && !item.warningAt) {
        item.warningAt = now;
        item.status = FollowUpStatus.DUE;
        this.eventsGateway.emitFollowupAlert('followup.warning', sessionId, {
          ...alertBase,
          dueAt: item.dueAt.toISOString(),
        });
      }
      if (overdueMs >= twoHours && !item.escalatedAt) {
        item.escalatedAt = now;
        item.status = FollowUpStatus.ESCALATED;
        this.logger.warn(`Follow-up ${item.id} escalated to manager`);
        this.eventsGateway.emitFollowupAlert('followup.escalated', '*', {
          ...alertBase,
          assignedStaffId: item.assignedStaffId,
          dueAt: item.dueAt.toISOString(),
        });
      }
      if (overdueMs >= oneDay && !item.kpiPenaltyFlag) {
        item.kpiPenaltyAt = now;
        item.kpiPenaltyFlag = true;
        this.eventsGateway.emitFollowupAlert('followup.kpi_penalty', sessionId, {
          ...alertBase,
          assignedStaffId: item.assignedStaffId,
        });
      }
      await this.queueRepo.save(item);
    }
  }

  private async findQueueItem(id: string): Promise<FollowupQueueItem> {
    const item = await this.queueRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Follow-up ${id} not found`);
    return item;
  }

  private async recordAttempt(
    item: FollowupQueueItem,
    staffId: string,
    mode: FollowUpAttemptMode,
    messageBody: string | null,
    deliveryStatus: string,
    outcome?: FollowUpOutcome,
  ): Promise<FollowupAttempt> {
    const attempt = this.attemptRepo.create({
      followupId: item.id,
      conversationId: item.conversationId,
      staffId,
      sentAt: new Date(),
      mode,
      templateId: item.templateId,
      messageBody,
      deliveryStatus,
      outcome: outcome ?? null,
    });
    return this.attemptRepo.save(attempt);
  }
}
