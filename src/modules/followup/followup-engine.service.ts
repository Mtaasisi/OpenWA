import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { FollowupRuleService } from './followup-rule.service';
import { FollowupTemplateService } from './followup-template.service';
import { FollowupQueueService } from './followup-queue.service';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupConversation } from './entities/followup-conversation.entity';
import {
  ConversationStage,
  FollowUpMode,
  FollowUpTriggerEvent,
  TemplateCategory,
  WhatsAppTemplateStatus,
} from './followup.enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupRule } from './entities/followup-rule.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import { MessageService } from '../message/message.service';
import { SmsService } from '../sms/sms.service';
import { renderTemplate, canAutoSendTemplate, TemplateVariables } from './utils/template.util';
import { FollowUpAttemptMode } from './followup.enums';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { InboxCrmService } from '../message/inbox-crm.service';
import { FollowupAutopilotOrchestratorService } from './followup-autopilot-orchestrator.service';

@Injectable()
export class FollowupEngineService implements OnModuleInit {
  private readonly logger = new Logger(FollowupEngineService.name);

  constructor(
    private readonly ruleService: FollowupRuleService,
    private readonly templateService: FollowupTemplateService,
    private readonly queueService: FollowupQueueService,
    private readonly conversationService: FollowupConversationService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly smsService: SmsService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    private readonly autopilotOrchestrator: FollowupAutopilotOrchestratorService,
    @InjectRepository(FollowupConversation, 'data')
    private readonly convRepo: Repository<FollowupConversation>,
    @InjectRepository(FollowupAttempt, 'data')
    private readonly attemptRepo: Repository<FollowupAttempt>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultsIfEmpty();
  }

  async seedDefaultsIfEmpty(): Promise<void> {
    const rules = await this.ruleService.findAll();
    if (rules.length === 0) {
      await this.seedDefaultTemplates();
      await this.seedDefaultRules();
      this.logger.log('Seeded default follow-up templates and rules');
    }
  }

  private async seedDefaultTemplates(): Promise<void> {
    const defaults: Array<{
      name: string;
      category: TemplateCategory;
      body: string;
      smsBody?: string;
      requiresWhatsappApproval: boolean;
      whatsappTemplateStatus: WhatsAppTemplateStatus;
      channel?: string;
    }> = [
      {
        name: 'Price follow-up (2h)',
        category: TemplateCategory.PRICE_FOLLOWUP,
        body: 'Hi {customer_name}, just checking if you had any questions about the {product_name} price we shared. Happy to help!',
        smsBody: 'Hi {customer_name}, any questions on {product_name} price? Reply here.',
        requiresWhatsappApproval: true,
        whatsappTemplateStatus: WhatsAppTemplateStatus.PENDING,
      },
      {
        name: 'Waiting reply (24h)',
        category: TemplateCategory.PRICE_FOLLOWUP,
        body: 'Hello {customer_name}, we are still here to assist with {product_name}. Let us know when you are ready.',
        smsBody: 'Hi {customer_name}, still interested in {product_name}? We are here to help.',
        requiresWhatsappApproval: true,
        whatsappTemplateStatus: WhatsAppTemplateStatus.PENDING,
      },
      {
        name: 'Payment reminder',
        category: TemplateCategory.PAYMENT_PENDING,
        body: 'Hi {customer_name}, friendly reminder about your pending payment for {product_name}. Pay to {payment_number}.',
        smsBody: 'Reminder: payment pending for {product_name}. Pay {payment_number}.',
        requiresWhatsappApproval: false,
        whatsappTemplateStatus: WhatsAppTemplateStatus.NOT_REQUIRED,
      },
      {
        name: 'Out of stock alternative',
        category: TemplateCategory.OUT_OF_STOCK,
        body: 'Hi {customer_name}, {product_name} is currently out of stock. We can suggest similar options — would you like alternatives?',
        smsBody: '{product_name} out of stock. Want similar options?',
        requiresWhatsappApproval: false,
        whatsappTemplateStatus: WhatsAppTemplateStatus.NOT_REQUIRED,
      },
      {
        name: 'Visit branch reminder',
        category: TemplateCategory.VISIT_BRANCH,
        body: 'Good morning {customer_name}! Reminder: visit us at {pickup_location} today. {branch_name} team awaits you.',
        smsBody: 'Visit {branch_name} today at {pickup_location}.',
        requiresWhatsappApproval: true,
        whatsappTemplateStatus: WhatsAppTemplateStatus.PENDING,
      },
      {
        name: 'Dead lead recovery (3 days)',
        category: TemplateCategory.DEAD_LEAD_RECOVERY,
        body: 'Hi {customer_name}, we noticed we have not heard back. Still interested in {product_name}? We are happy to help.',
        smsBody: 'Still interested in {product_name}? Reply if you need help.',
        requiresWhatsappApproval: true,
        whatsappTemplateStatus: WhatsAppTemplateStatus.PENDING,
      },
      {
        name: 'Repair ready (SMS)',
        category: TemplateCategory.REPAIR_READY,
        body: 'Habari {customer_name}, kifaa chako {device_name} kipo tayari kuchukuliwa. Asante.',
        smsBody: 'Habari {customer_name}, {device_name} tayari kuchukuliwa.',
        requiresWhatsappApproval: false,
        whatsappTemplateStatus: WhatsAppTemplateStatus.NOT_REQUIRED,
        channel: 'sms',
      },
    ];

    for (const t of defaults) {
      await this.templateService.create(t);
    }
  }

  private async seedDefaultRules(): Promise<void> {
    const templates = await this.templateService.findAll();
    const byCategory = (cat: TemplateCategory) => templates.find(t => t.category === cat);

    const priceTpl = byCategory(TemplateCategory.PRICE_FOLLOWUP);
    const paymentTpl = byCategory(TemplateCategory.PAYMENT_PENDING);
    const oosTpl = byCategory(TemplateCategory.OUT_OF_STOCK);
    const visitTpl = byCategory(TemplateCategory.VISIT_BRANCH);
    const deadTpl = byCategory(TemplateCategory.DEAD_LEAD_RECOVERY);

    const defaults = [
      {
        name: 'Price sent — no reply 2h',
        triggerEvent: FollowUpTriggerEvent.NO_CUSTOMER_REPLY,
        stage: ConversationStage.PRICE_SENT,
        delayMinutes: 120,
        templateId: priceTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
      },
      {
        name: 'Waiting customer reply — 24h',
        triggerEvent: FollowUpTriggerEvent.NO_CUSTOMER_REPLY,
        stage: ConversationStage.WAITING_CUSTOMER_REPLY,
        delayMinutes: 1440,
        templateId: priceTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
      },
      {
        name: 'Payment pending — 30min',
        triggerEvent: FollowUpTriggerEvent.NO_PAYMENT,
        stage: ConversationStage.PAYMENT_PENDING,
        delayMinutes: 30,
        templateId: paymentTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
      },
      {
        name: 'Out of stock — immediate',
        triggerEvent: FollowUpTriggerEvent.OUT_OF_STOCK,
        stage: ConversationStage.PRODUCT_SUGGESTED,
        delayMinutes: 0,
        templateId: oosTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
        condition: 'out_of_stock',
      },
      {
        name: 'Visit branch — next morning',
        triggerEvent: FollowUpTriggerEvent.VISIT_SCHEDULED,
        stage: null,
        delayMinutes: 480,
        templateId: visitTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
      },
      {
        name: 'Dead lead — 3 days no reply',
        triggerEvent: FollowUpTriggerEvent.STALE_CONVERSATION,
        stage: null,
        delayMinutes: 4320,
        templateId: deadTpl?.id ?? null,
        mode: FollowUpMode.CREATE_TASK,
      },
    ];

    for (const r of defaults) {
      await this.ruleService.create(r);
    }
  }

  async onStageChange(conversation: FollowupConversation, newStage: ConversationStage): Promise<void> {
    const rules = await this.ruleService.findActive(conversation.branchId ?? undefined);
    const matching = rules.filter(
      r =>
        r.triggerEvent === FollowUpTriggerEvent.STAGE_ENTERED &&
        r.stage === newStage,
    );
    for (const rule of matching) {
      await this.applyRule(conversation, rule);
    }
  }

  async evaluateStaleConversations(): Promise<void> {
    const rules = await this.ruleService.findActive();
    const staleRules = rules.filter(r => r.triggerEvent === FollowUpTriggerEvent.STALE_CONVERSATION);
    if (staleRules.length === 0) return;

    const minDelayMinutes = Math.min(...staleRules.map(r => r.delayMinutes));
    const staleCutoff = new Date(Date.now() - minDelayMinutes * 60 * 1000);
    const convs = await this.convRepo
      .createQueryBuilder('conv')
      .where('conv.linkedSaleId IS NULL')
      .andWhere('conv.stage NOT IN (:...closedStages)', {
        closedStages: [ConversationStage.WON, ConversationStage.LOST],
      })
      .andWhere(
        '(conv.lastCustomerMessageAt IS NOT NULL OR conv.lastStaffMessageAt IS NOT NULL)',
      )
      .andWhere(
        'COALESCE(conv.lastCustomerMessageAt, conv.lastStaffMessageAt) <= :staleCutoff',
        { staleCutoff },
      )
      .getMany();

    const now = Date.now();
    for (const conv of convs) {
      if (conv.linkedSaleId) continue;
      if (conv.stage === ConversationStage.WON || conv.stage === ConversationStage.LOST) continue;

      const lastMsg = conv.lastCustomerMessageAt ?? conv.lastStaffMessageAt;
      if (!lastMsg) continue;

      for (const rule of staleRules) {
        const thresholdMs = rule.delayMinutes * 60 * 1000;
        if (now - lastMsg.getTime() >= thresholdMs) {
          if (rule.stopIfCustomerReplied && conv.lastCustomerMessageAt) {
            const staffAfter = conv.lastStaffMessageAt && conv.lastStaffMessageAt > conv.lastCustomerMessageAt;
            if (!staffAfter && now - conv.lastCustomerMessageAt.getTime() < thresholdMs) continue;
          }
          await this.applyRule(conv, rule);
        }
      }
    }
  }

  async evaluateNoReplyRules(): Promise<void> {
    const rules = await this.ruleService.findActive();
    const noReplyRules = rules.filter(r => r.triggerEvent === FollowUpTriggerEvent.NO_CUSTOMER_REPLY);

    for (const rule of noReplyRules) {
      if (!rule.stage) continue;
      const convs = await this.conversationService.listByStage(rule.stage, rule.branchId ?? undefined);

      for (const conv of convs) {
        if (rule.stopIfSaleLinked && conv.linkedSaleId) continue;
        if (rule.stopIfCustomerReplied && conv.lastCustomerMessageAt) {
          if (conv.lastStaffMessageAt && conv.lastCustomerMessageAt > conv.lastStaffMessageAt) continue;
        }

        const reference = conv.lastStaffMessageAt ?? conv.createdAt;
        const elapsed = Date.now() - reference.getTime();
        if (elapsed >= rule.delayMinutes * 60 * 1000) {
          await this.applyRule(conv, rule);
        }
      }
    }
  }

  async triggerManual(conversationId: string, ruleId: string): Promise<void> {
    const conv = await this.conversationService.findById(conversationId);
    const rule = await this.ruleService.findById(ruleId);
    await this.applyRule(conv, rule);
  }

  private async applyRule(conv: FollowupConversation, rule: FollowupRule): Promise<void> {
    if (!(await this.queueService.canApplyRule(conv.id, rule))) return;

    if (conv.stage === ConversationStage.WON || conv.stage === ConversationStage.LOST) return;

    if (await this.inboxCrmService.isAiOptOut(conv.sessionId, conv.chatId)) {
      this.logger.debug(`Skipping follow-up for opted-out chat ${conv.sessionId}:${conv.chatId}`);
      return;
    }

    const handledByAutopilot = await this.autopilotOrchestrator.handleRuleTriggered(conv, rule);
    if (handledByAutopilot) return;

    const dueAt = new Date(Date.now() + rule.delayMinutes * 60 * 1000);

    if (rule.mode === FollowUpMode.AUTO_SEND && rule.templateId) {
      const tpl = await this.templateService.findById(rule.templateId);
      const canSend = canAutoSendTemplate(
        tpl.requiresWhatsappApproval,
        tpl.whatsappTemplateStatus,
        conv.lastCustomerMessageAt,
      );
      if (!canSend) {
        this.logger.warn(`Auto-send blocked for rule ${rule.name} — using create_task instead`);
      } else {
        await this.autoSend(conv, rule, tpl);
        return;
      }
    }

    await this.queueService.createQueueItem({
      conversationId: conv.id,
      ruleId: rule.id,
      templateId: rule.templateId,
      assignedStaffId: conv.assignedStaffId,
      branchId: conv.branchId ?? rule.branchId,
      dueAt,
      recommendedAction: `Follow up: ${rule.name}`,
    });
  }

  private async autoSend(
    conv: FollowupConversation,
    rule: FollowupRule,
    tpl: FollowupMessageTemplate,
  ): Promise<void> {
    const identity = await this.conversationService.resolveIdentityForThread(
      conv.sessionId,
      conv.chatId,
      conv,
    );
    if (!(await this.queueService.isWithinAutomatedSendLimits(conv.sessionId, identity.customerPhone))) {
      return;
    }

    const vars: TemplateVariables = {
      customer_name: identity.customerName ?? undefined,
      product_name: conv.productInterest ?? undefined,
    };
    const body = renderTemplate(tpl.body, vars);

    const item = await this.queueService.createQueueItem({
      conversationId: conv.id,
      ruleId: rule.id,
      templateId: rule.templateId,
      assignedStaffId: conv.assignedStaffId,
      branchId: conv.branchId ?? rule.branchId,
      dueAt: new Date(),
      recommendedAction: `Auto-sent: ${rule.name}`,
    });

    try {
      const tplChannel = tpl.channel ?? 'whatsapp';

      if (tplChannel === 'sms' || tplChannel === 'both') {
        if (!identity.customerPhone) {
          this.logger.warn(`Auto-send SMS skipped — no phone for conversation ${conv.id}`);
        } else if (await this.smsService.isReady()) {
          await this.smsService.sendInternal(
            {
              toPhone: identity.customerPhone,
              message: body,
              customerId: conv.customerId ?? undefined,
              conversationId: conv.id,
              relatedType: 'followup_auto',
              relatedId: item.id,
            },
            null,
          );
        }
      }

      if (tplChannel === 'whatsapp' || tplChannel === 'both') {
        await this.messageService.sendText(conv.sessionId, { chatId: conv.chatId, text: body }, { source: 'followup' });
        await this.conversationService.recordStaffMessage(conv.sessionId, conv.chatId);
      }

      await this.attemptRepo.save(
        this.attemptRepo.create({
          followupId: item.id,
          conversationId: conv.id,
          staffId: null,
          sentAt: new Date(),
          mode: FollowUpAttemptMode.AUTO_SEND,
          templateId: tpl.id,
          messageBody: body,
          deliveryStatus: 'sent',
        }),
      );
      await this.queueService.logAutoSend(conv.sessionId, conv.id, item.id);
    } catch (err) {
      this.logger.error(`Auto-send failed for conversation ${conv.id}: ${String(err)}`);
    }
  }
}
