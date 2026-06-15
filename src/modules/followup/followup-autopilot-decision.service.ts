import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import { FollowupAutopilotSettings } from './entities/followup-autopilot-settings.entity';
import {
  ConversationStage,
  FollowUpAutopilotMode,
  FollowUpRiskLevel,
  FollowUpStatus,
  FollowUpStopReason,
} from './followup.enums';
import type { FollowupAiAnalysis } from './followup-ai.service';
import { isGroupChatId, isSafeMessage } from './utils/followup-risk.util';
import { canAutoSendTemplate, isWithin24HourWindow } from './utils/template.util';
import { isWithinBusinessHours } from '../ai/utils/ai-business-hours.util';
import { InboxCrmService } from '../message/inbox-crm.service';
import { Session } from '../session/entities/session.entity';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { FollowUpAttemptMode } from './followup.enums';

export type AutopilotDecisionAction =
  | 'auto_send'
  | 'needs_approval'
  | 'ai_suggested'
  | 'stopped';

export interface AutopilotDecision {
  action: AutopilotDecisionAction;
  stopReason?: FollowUpStopReason;
  decisionReason: string;
}

@Injectable()
export class FollowupAutopilotDecisionService {
  constructor(
    @InjectRepository(FollowupQueueItem, 'data')
    private readonly queueRepo: Repository<FollowupQueueItem>,
    @InjectRepository(FollowupAttempt, 'data')
    private readonly attemptRepo: Repository<FollowupAttempt>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
  ) {}

  async evaluate(params: {
    conv: FollowupConversation;
    settings: FollowupAutopilotSettings;
    effectiveMode: FollowUpAutopilotMode;
    analysis: FollowupAiAnalysis;
    template: FollowupMessageTemplate | null;
    queueItem?: FollowupQueueItem | null;
  }): Promise<AutopilotDecision> {
    const { conv, settings, effectiveMode, analysis, template, queueItem } = params;

    if (effectiveMode === FollowUpAutopilotMode.OFF) {
      return { action: 'stopped', stopReason: FollowUpStopReason.AUTOPILOT_PAUSED, decisionReason: 'autopilot_off' };
    }

    if (!settings.allowGroupAutopilot && isGroupChatId(conv.chatId)) {
      return { action: 'stopped', stopReason: FollowUpStopReason.GROUP_CHAT, decisionReason: 'group_chat' };
    }

    if (queueItem && conv.lastCustomerMessageAt && conv.lastCustomerMessageAt > queueItem.createdAt) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.CUSTOMER_REPLIED,
        decisionReason: 'customer_replied_after_scheduled',
      };
    }

    if (await this.inboxCrmService.isAiOptOut(conv.sessionId, conv.chatId)) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.CUSTOMER_OPTED_OUT,
        decisionReason: 'customer_opted_out',
      };
    }

    if (conv.customerRefusedFollowup) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.CUSTOMER_OPTED_OUT,
        decisionReason: 'customer_refused_followup',
      };
    }

    if (
      conv.stage === ConversationStage.WON ||
      conv.stage === ConversationStage.LOST ||
      conv.closedAt
    ) {
      const reason =
        conv.stage === ConversationStage.WON
          ? FollowUpStopReason.CUSTOMER_ALREADY_BOUGHT
          : FollowUpStopReason.LEAD_MARKED_LOST;
      return { action: 'stopped', stopReason: reason, decisionReason: 'won_lost_closed' };
    }

    const crm = await this.inboxCrmService.getThreadCrm(conv.sessionId, conv.chatId);
    if (crm?.resolved) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.CONVERSATION_CLOSED,
        decisionReason: 'conversation_resolved',
      };
    }

    if (await this.inboxCrmService.isFollowupAutopilotPaused(conv.sessionId, conv.chatId)) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.STAFF_TAKEOVER,
        decisionReason: 'autopilot_paused_for_thread',
      };
    }

    const session = await this.sessionRepo.findOne({ where: { id: conv.sessionId } });
    if (!session || session.status !== 'ready') {
      if (!settings.allowSmsFallback) {
        return {
          action: 'stopped',
          stopReason: FollowUpStopReason.ACCOUNT_DISCONNECTED,
          decisionReason: 'account_disconnected',
        };
      }
    }

    if (settings.businessHoursOnly) {
      const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
      const [endH] = settings.quietHoursEnd.split(':').map(Number);
      const inHours = isWithinBusinessHours(
        {
          timezone: settings.timezone,
          startHour: startH,
          endHour: endH,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
        },
        new Date(),
      );
      if (!inHours) {
        return {
          action: 'stopped',
          stopReason: FollowUpStopReason.OUTSIDE_HOURS,
          decisionReason: 'outside_business_hours',
        };
      }
    }

    const withinLimits = await this.isWithinAutopilotLimits(
      conv,
      settings.maxFollowupsPerCustomerPerDay,
      settings.maxFollowupsPerLead,
    );
    if (!withinLimits) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.MAX_FOLLOWUP_LIMIT,
        decisionReason: 'max_followup_limit',
      };
    }

    if (analysis.suggestedMessage && (await this.isDuplicateToday(conv.id, analysis.suggestedMessage))) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.DUPLICATE_TODAY,
        decisionReason: 'duplicate_message_today',
      };
    }

    if (analysis.riskLevel === FollowUpRiskLevel.BLOCKED || analysis.stopReason) {
      return {
        action: 'stopped',
        stopReason: FollowUpStopReason.COMPLAINT_DETECTED,
        decisionReason: analysis.stopReason ?? 'blocked_risk',
      };
    }

    if (analysis.riskLevel === FollowUpRiskLevel.HIGH) {
      if (settings.requireApprovalForHighRisk || effectiveMode !== FollowUpAutopilotMode.FULL_AUTOPILOT) {
        return { action: 'needs_approval', decisionReason: 'high_risk_requires_approval' };
      }
    }

    if (analysis.riskLevel === FollowUpRiskLevel.MEDIUM) {
      if (settings.requireApprovalForMediumRisk && effectiveMode !== FollowUpAutopilotMode.FULL_AUTOPILOT) {
        return { action: 'needs_approval', decisionReason: 'medium_risk_requires_approval' };
      }
    }

    if (template) {
      const canSend = canAutoSendTemplate(
        template.requiresWhatsappApproval,
        template.whatsappTemplateStatus,
        conv.lastCustomerMessageAt,
      );
      if (!canSend) {
        return { action: 'needs_approval', decisionReason: 'template_not_approved_or_outside_24h' };
      }
    }

    if (!analysis.suggestedMessage?.trim() || !isSafeMessage(analysis.suggestedMessage)) {
      return { action: 'needs_approval', decisionReason: 'empty_or_unsafe_message' };
    }

    if (effectiveMode === FollowUpAutopilotMode.SUGGEST_ONLY) {
      return { action: 'ai_suggested', decisionReason: 'suggest_only_mode' };
    }

    if (
      analysis.riskLevel === FollowUpRiskLevel.LOW &&
      analysis.confidenceScore >= 0.7 &&
      (effectiveMode === FollowUpAutopilotMode.AUTO_SEND_SAFE ||
        effectiveMode === FollowUpAutopilotMode.FULL_AUTOPILOT)
    ) {
      return { action: 'auto_send', decisionReason: 'low_risk_high_confidence' };
    }

    if (effectiveMode === FollowUpAutopilotMode.FULL_AUTOPILOT && analysis.riskLevel === FollowUpRiskLevel.MEDIUM) {
      return { action: 'auto_send', decisionReason: 'full_autopilot_medium' };
    }

    return { action: 'needs_approval', decisionReason: 'default_needs_approval' };
  }

  private async isWithinAutopilotLimits(
    conv: FollowupConversation,
    perCustomerPerDay: number,
    perLead: number,
  ): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await this.attemptRepo
      .createQueryBuilder('a')
      .where('a.conversationId = :id', { id: conv.id })
      .andWhere('a.mode = :mode', { mode: FollowUpAttemptMode.AUTO_SEND })
      .andWhere('a.sentAt >= :start', { start: startOfDay })
      .getCount();

    if (todayCount >= perCustomerPerDay) return false;

    const leadCount = await this.attemptRepo.count({
      where: { conversationId: conv.id, mode: FollowUpAttemptMode.AUTO_SEND },
    });
    return leadCount < perLead;
  }

  private async isDuplicateToday(conversationId: string, message: string): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const attempts = await this.attemptRepo.find({
      where: { conversationId },
      order: { sentAt: 'DESC' },
      take: 10,
    });
    return attempts.some(
      a =>
        a.messageBody === message &&
        a.sentAt &&
        a.sentAt >= startOfDay,
    );
  }
}
