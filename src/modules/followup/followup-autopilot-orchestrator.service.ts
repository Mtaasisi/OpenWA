import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupRule } from './entities/followup-rule.entity';
import { FollowupQueueService } from './followup-queue.service';
import { FollowupTemplateService } from './followup-template.service';
import { FollowupAiService } from './followup-ai.service';
import { FollowupAutopilotSettingsService } from './followup-autopilot-settings.service';
import { FollowupAutopilotDecisionService } from './followup-autopilot-decision.service';
import { FollowupAutopilotAuditService } from './followup-autopilot-audit.service';
import {
  FollowUpAutopilotMode,
  FollowUpSentBy,
  FollowUpStatus,
  FollowUpStopReason,
} from './followup.enums';
import { renderTemplate, TemplateVariables } from './utils/template.util';
import { Session } from '../session/entities/session.entity';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { FollowupAutopilotChannelService } from './followup-autopilot-channel.service';
import { FollowupConversationService } from './followup-conversation.service';

@Injectable()
export class FollowupAutopilotOrchestratorService {
  private readonly logger = new Logger(FollowupAutopilotOrchestratorService.name);

  constructor(
    private readonly settingsService: FollowupAutopilotSettingsService,
    private readonly aiService: FollowupAiService,
    private readonly decisionService: FollowupAutopilotDecisionService,
    private readonly auditService: FollowupAutopilotAuditService,
    private readonly templateService: FollowupTemplateService,
    private readonly channelService: FollowupAutopilotChannelService,
    @Inject(forwardRef(() => FollowupQueueService))
    private readonly queueService: FollowupQueueService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly conversationService: FollowupConversationService,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async handleRuleTriggered(conv: FollowupConversation, rule: FollowupRule): Promise<boolean> {
    const settings = await this.settingsService.getSettings();
    const session = await this.sessionRepo.findOne({ where: { id: conv.sessionId } });
    const aiConfigured = await this.aiService.isAiConfigured();
    const effectiveMode = this.settingsService.resolveEffectiveMode(settings, session, aiConfigured);

    if (effectiveMode === FollowUpAutopilotMode.OFF) {
      return false;
    }

    const templateId = rule.templateId;
    const template = templateId ? await this.templateService.findById(templateId).catch(() => null) : null;
    const identity = await this.conversationService.resolveIdentityForThread(
      conv.sessionId,
      conv.chatId,
      conv,
    );
    const vars: TemplateVariables = {
      customer_name: identity.customerName ?? undefined,
      product_name: conv.productInterest ?? undefined,
    };
    const analysis = await this.aiService.analyze({ conv, rule, template, variables: vars });
    const decision = await this.decisionService.evaluate({
      conv,
      settings,
      effectiveMode,
      analysis,
      template,
    });

    const dueAt = new Date(Date.now() + rule.delayMinutes * 60 * 1000);
    let status: FollowUpStatus;

    switch (decision.action) {
      case 'auto_send':
        status = FollowUpStatus.SCHEDULED;
        break;
      case 'needs_approval':
        status = FollowUpStatus.NEEDS_APPROVAL;
        break;
      case 'ai_suggested':
        status = FollowUpStatus.AI_SUGGESTED;
        break;
      case 'stopped':
        status = FollowUpStatus.STOPPED;
        break;
      default:
        status = FollowUpStatus.NEEDS_APPROVAL;
    }

    const item = await this.queueService.createAutopilotQueueItem({
      conversationId: conv.id,
      ruleId: rule.id,
      templateId: template?.id ?? rule.templateId,
      assignedStaffId: conv.assignedStaffId,
      branchId: conv.branchId ?? rule.branchId,
      dueAt: decision.action === 'auto_send' ? new Date() : dueAt,
      recommendedAction: `Autopilot: ${rule.name}`,
      status,
      detectedReason: analysis.detectedReason,
      customerMood: analysis.customerMood,
      riskLevel: analysis.riskLevel,
      confidenceScore: analysis.confidenceScore,
      suggestedChannel: analysis.suggestedChannel,
      suggestedMessage: analysis.suggestedMessage,
      originalCustomerMessage: analysis.originalCustomerMessage,
      lastStaffMessage: analysis.lastStaffMessage,
      stopReason: decision.stopReason ?? null,
      stoppedAt: decision.action === 'stopped' ? new Date() : null,
      stoppedBy: decision.action === 'stopped' ? 'system' : null,
    });

    void this.auditService.log(
      {
        followupId: item.id,
        conversationId: conv.id,
        customerId: conv.customerId,
        sessionId: conv.sessionId,
        ruleId: rule.id,
        templateId: template?.id ?? null,
        aiConfidence: analysis.confidenceScore,
        riskLevel: analysis.riskLevel,
        decisionReason: decision.decisionReason,
        resultStatus: status,
        metadata: { effectiveMode, action: decision.action },
      },
      decision.action === 'auto_send'
        ? AuditAction.FOLLOWUP_AUTOPILOT_AUTO_SENT
        : AuditAction.FOLLOWUP_AUTOPILOT_SUGGESTED,
    );

    if (decision.action === 'auto_send') {
      await this.channelService.sendAutopilotMessage(item.id, null, analysis.suggestedMessage);
    }

    return true;
  }
}
