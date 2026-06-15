import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import {
  FollowUpAttemptMode,
  FollowUpSentBy,
  FollowUpStatus,
  FollowUpStopReason,
} from './followup.enums';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupTemplateService } from './followup-template.service';
import { MessageService } from '../message/message.service';
import { SmsService } from '../sms/sms.service';
import { Session } from '../session/entities/session.entity';
import { FollowupAutopilotSettingsService } from './followup-autopilot-settings.service';
import { FollowupAutopilotAuditService } from './followup-autopilot-audit.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { renderTemplate, TemplateVariables } from './utils/template.util';

export interface SendAutopilotResult {
  success: boolean;
  channels: string[];
  messageBody: string;
  failureReason?: string;
}

@Injectable()
export class FollowupAutopilotChannelService {
  private readonly logger = new Logger(FollowupAutopilotChannelService.name);

  constructor(
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(FollowupAttempt, 'data')
    private readonly attemptRepo: Repository<FollowupAttempt>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly conversationService: FollowupConversationService,
    private readonly templateService: FollowupTemplateService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly smsService: SmsService,
    private readonly settingsService: FollowupAutopilotSettingsService,
    private readonly auditService: FollowupAutopilotAuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async sendAutopilotMessage(
    followupId: string,
    staffId: string | null,
    overrideMessage?: string,
  ): Promise<SendAutopilotResult> {
    const item = await this.queueRepo.findOne({ where: { id: followupId } });
    if (!item) throw new Error(`Follow-up ${followupId} not found`);

    const conv = await this.conversationService.findById(item.conversationId);
    const identity = await this.conversationService.resolveIdentityForThread(
      conv.sessionId,
      conv.chatId,
      conv,
    );
    const settings = await this.settingsService.getSettings();
    const session = await this.sessionRepo.findOne({ where: { id: conv.sessionId } });
    const waReady = session?.status === 'ready';

    let messageBody = overrideMessage ?? item.suggestedMessage ?? '';
    let tpl: FollowupMessageTemplate | null = null;

    if (!messageBody && item.templateId) {
      tpl = await this.templateService.findById(item.templateId);
      const vars: TemplateVariables = {
        customer_name: identity.customerName ?? undefined,
        product_name: conv.productInterest ?? undefined,
      };
      messageBody = renderTemplate(tpl.body, vars);
    } else if (item.templateId) {
      tpl = await this.templateService.findById(item.templateId).catch(() => null);
    }

    if (!messageBody.trim()) {
      await this.markFailed(item, FollowUpStopReason.ACCOUNT_DISCONNECTED, 'empty_message');
      return { success: false, channels: [], messageBody: '', failureReason: 'empty_message' };
    }

    const channelPref = item.suggestedChannel ?? tpl?.channel ?? 'whatsapp';
    const channels: string[] = [];
    let failed = false;
    let failureReason: string | undefined;

    const tryWhatsapp = channelPref === 'whatsapp' || channelPref === 'both';
    const trySms = channelPref === 'sms' || channelPref === 'both';

    if (tryWhatsapp && waReady) {
      try {
        await this.messageService.sendText(conv.sessionId, { chatId: conv.chatId, text: messageBody }, { source: 'followup', actorStaffId: staffId ?? undefined });
        await this.conversationService.recordStaffMessage(conv.sessionId, conv.chatId);
        channels.push('whatsapp');
      } catch (err) {
        this.logger.warn(`WhatsApp autopilot send failed: ${String(err)}`);
        failed = true;
        failureReason = 'whatsapp_failed';
      }
    } else if (tryWhatsapp && !waReady) {
      failed = true;
      failureReason = 'account_disconnected';
    }

    const smsAllowed =
      settings.allowSmsFallback ||
      settings.allowWhatsAppSmsBoth ||
      channelPref === 'sms' ||
      channelPref === 'both';

    if ((failed || channelPref === 'sms') && smsAllowed && identity.customerPhone) {
      if (await this.smsService.isReady()) {
        const smsText =
          tpl?.smsBody && !overrideMessage
            ? renderTemplate(tpl.smsBody, {
                customer_name: identity.customerName ?? undefined,
                product_name: conv.productInterest ?? undefined,
              })
            : messageBody.slice(0, 320);
        try {
          await this.smsService.sendInternal(
            {
              toPhone: identity.customerPhone,
              message: smsText,
              customerId: conv.customerId ?? undefined,
              conversationId: conv.id,
              relatedType: 'followup_autopilot',
              relatedId: item.id,
            },
            null,
          );
          channels.push('sms');
          failed = false;
        } catch (err) {
          this.logger.warn(`SMS autopilot fallback failed: ${String(err)}`);
          failureReason = 'sms_failed';
        }
      } else if (!channels.length) {
        failureReason = 'sms_not_ready';
      }
    }

    if (!channels.length) {
      await this.markFailed(item, FollowUpStopReason.ACCOUNT_DISCONNECTED, failureReason ?? 'send_failed');
      await this.settingsService.recordFailure(conv.sessionId);
      void this.auditService.log(
        {
          followupId: item.id,
          conversationId: conv.id,
          sessionId: conv.sessionId,
          messageSent: messageBody,
          failureReason,
          resultStatus: FollowUpStatus.FAILED,
          sentBy: staffId ? FollowUpSentBy.STAFF : FollowUpSentBy.AUTOPILOT,
        },
        AuditAction.FOLLOWUP_AUTOPILOT_FAILED,
      );
      this.eventsGateway.emitFollowupAlert('followup.autopilot_updated', conv.sessionId, {
        followupId: item.id,
        status: FollowUpStatus.FAILED,
        action: 'failed',
        chatId: conv.chatId,
      });
      return { success: false, channels: [], messageBody, failureReason };
    }

    item.status = staffId ? FollowUpStatus.SENT : FollowUpStatus.AUTO_SENT;
    item.channelUsed = channels.join(',');
    item.sentBy = staffId ? FollowUpSentBy.STAFF : FollowUpSentBy.AUTOPILOT;
    if (staffId) item.approvedBy = staffId;
    item.suggestedMessage = messageBody;
    await this.queueRepo.save(item);

    await this.attemptRepo.save(
      this.attemptRepo.create({
        followupId: item.id,
        conversationId: conv.id,
        staffId,
        sentAt: new Date(),
        mode: FollowUpAttemptMode.AUTO_SEND,
        templateId: item.templateId,
        messageBody,
        deliveryStatus: 'sent',
      }),
    );

    await this.settingsService.recordSuccess(conv.sessionId);
    void this.auditService.log(
      {
        followupId: item.id,
        conversationId: conv.id,
        customerId: conv.customerId,
        sessionId: conv.sessionId,
        templateId: item.templateId,
        channelUsed: item.channelUsed,
        messageSent: messageBody,
        approvedBy: staffId,
        sentBy: item.sentBy,
        resultStatus: item.status,
      },
      AuditAction.FOLLOWUP_AUTOPILOT_AUTO_SENT,
    );

    this.eventsGateway.emitFollowupAlert('followup.autopilot_updated', conv.sessionId, {
      followupId: item.id,
      status: item.status,
      action: staffId ? 'sent' : 'auto_sent',
      chatId: conv.chatId,
    });

    return { success: true, channels, messageBody };
  }

  private async markFailed(
    item: FollowupQueueItem,
    stopReason: FollowUpStopReason,
    failureReason: string,
  ): Promise<void> {
    item.status = FollowUpStatus.FAILED;
    item.stopReason = stopReason;
    item.failureReason = failureReason;
    item.stoppedAt = new Date();
    item.stoppedBy = 'system';
    await this.queueRepo.save(item);
  }
}
